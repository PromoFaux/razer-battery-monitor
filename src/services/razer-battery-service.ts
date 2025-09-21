import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import streamDeck from "@elgato/streamdeck";

/**
 * Service for communicating with Razer devices to retrieve battery information.
 * Uses a persistent CommonJS worker process to handle USB communication efficiently.
 */
export class RazerBatteryService {
	private readonly workerPath = join(process.cwd(), 'bin', 'usb-worker.cjs');
	private readonly nodeExecutable = process.execPath;
	private worker: ChildProcess | null = null;
	private messageId = 0;
	private pendingMessages = new Map<number, {
		resolve: (value: any) => void;
		reject: (error: Error) => void;
		timeout: NodeJS.Timeout;
	}>();
	private isShuttingDown = false;

	// Device list caching
	private deviceListCache: Array<{productId: number, name: string, id: string}> | null = null;
	private deviceListCacheTime = 0;
	private readonly DEVICE_CACHE_RETRY_INTERVAL = 5000; // Retry failed requests after 5 seconds
	private lastDeviceListError = 0;
	private deviceEnumerationPromise: Promise<Array<{productId: number, name: string, id: string}>> | null = null; // Prevent concurrent enumerations

	/**
	 * Starts the persistent worker process if not already running.
	 */
	private async startWorker(): Promise<void> {
		if (this.worker && !this.worker.killed) {
			return; // Worker already running
		}

		streamDeck.logger.info('Starting persistent USB worker...');
		
		this.worker = fork(this.workerPath, [], {
			stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
			execPath: this.nodeExecutable,
		});

		// Handle worker messages
		this.worker.on('message', (message: any) => {
			const { id, success, result, error } = message;
			const pendingMessage = this.pendingMessages.get(id);
			
			if (pendingMessage) {
				clearTimeout(pendingMessage.timeout);
				this.pendingMessages.delete(id);
				
				if (success) {
					pendingMessage.resolve(result);
				} else {
					pendingMessage.reject(new Error(error || 'Unknown worker error'));
				}
			}
		});

		// Handle worker errors
		this.worker.on('error', (error) => {
			streamDeck.logger.error('Worker error:', error.message);
			if (error.message.includes('ENOENT') || (error as any).code === 'ENOENT') {
				streamDeck.logger.error('FATAL: Stream Deck Node.js runtime not found. Try restarting Stream Deck.');
			}
			this.handleWorkerExit();
		});

		// Handle worker exit
		this.worker.on('exit', (code, signal) => {
			if (!this.isShuttingDown) {
				streamDeck.logger.warn(`Worker process exited with code ${code}, signal ${signal}`);
			}
			this.handleWorkerExit();
		});

		// Handle stdout/stderr for debugging
		if (this.worker.stdout) {
			this.worker.stdout.on('data', (data) => {
				const output = data.toString().trim();
				if (output) {
					// Split multiple lines and log each separately
					const lines = output.split('\n').filter((line: string) => line.trim());
					lines.forEach((line: string) => {
						if (!line.startsWith('{') && !line.startsWith('[')) { // Don't log JSON responses
							streamDeck.logger.info(`[USB Worker] ${line}`); // Changed from debug to info with prefix
						}
					});
				}
			});
		}

		if (this.worker.stderr) {
			this.worker.stderr.on('data', (data) => {
				const output = data.toString().trim();
				if (output) {
					// Split multiple lines and log each separately
					const lines = output.split('\n').filter((line: string) => line.trim());
					lines.forEach((line: string) => {
						streamDeck.logger.warn(`[USB Worker ERROR] ${line}`);
					});
				}
			});
		}

		streamDeck.logger.info('Persistent USB worker started'); // Changed from debug to info
	}

	/**
	 * Handles worker exit by cleaning up pending messages.
	 */
	private handleWorkerExit(): void {
		// Reject all pending messages
		for (const [id, pendingMessage] of this.pendingMessages) {
			clearTimeout(pendingMessage.timeout);
			pendingMessage.reject(new Error('Worker process terminated'));
		}
		this.pendingMessages.clear();
		
		if (this.worker) {
			this.worker.removeAllListeners();
			this.worker = null;
		}
	}

	/**
	 * Sends a message to the worker and waits for response.
	 */
	private async sendMessage(command: string, args: string[] = [], timeout: number = 6000): Promise<any> {
		await this.startWorker();
		
		if (!this.worker || this.worker.killed) {
			throw new Error('Worker process not available');
		}

		const id = ++this.messageId;
		
		return new Promise((resolve, reject) => {
			const timeoutHandle = setTimeout(() => {
				this.pendingMessages.delete(id);
				reject(new Error(`Worker timeout after ${timeout}ms for command: ${command}`));
			}, timeout);

			this.pendingMessages.set(id, {
				resolve,
				reject,
				timeout: timeoutHandle
			});

			// Send message to worker
			this.worker!.send({ id, command, args });
		});
	}

	/**
	 * Gets available Razer devices on the system with intelligent caching.
	 * Device list is cached until manually invalidated or plugin restart.
	 */
	async getAvailableDevices(): Promise<Array<{productId: number, name: string, id: string}>> {
		const now = Date.now();
		
		// Return cached result if available (cache never expires automatically)
		if (this.deviceListCache !== null) {
			streamDeck.logger.info(`Using cached device list (${this.deviceListCache.length} devices, cached for ${now - this.deviceListCacheTime}ms)`); // Changed from debug to info
			return this.deviceListCache;
		}

		// If there's already an enumeration in progress, wait for it
		if (this.deviceEnumerationPromise !== null) {
			streamDeck.logger.info('Device enumeration already in progress, waiting for it to complete...');
			try {
				return await this.deviceEnumerationPromise;
			} catch (error) {
				// If the concurrent enumeration failed, we'll start a new one below
				streamDeck.logger.warn('Concurrent device enumeration failed, starting new enumeration:', error);
				this.deviceEnumerationPromise = null;
			}
		}

		// Don't retry too frequently if the last request failed
		if (this.lastDeviceListError > 0 && 
			(now - this.lastDeviceListError) < this.DEVICE_CACHE_RETRY_INTERVAL) {
			streamDeck.logger.info(`Skipping device list refresh, too soon after error (${now - this.lastDeviceListError}ms ago)`); // Changed from debug to info
			return [];
		}

		// Start new enumeration
		this.deviceEnumerationPromise = this.performDeviceEnumeration();
		
		try {
			const devices = await this.deviceEnumerationPromise;
			this.deviceEnumerationPromise = null; // Clear the promise on success
			return devices;
		} catch (error) {
			this.deviceEnumerationPromise = null; // Clear the promise on error
			throw error;
		}
	}

	/**
	 * Performs the actual device enumeration.
	 */
	private async performDeviceEnumeration(): Promise<Array<{productId: number, name: string, id: string}>> {
		const now = Date.now();
		
		try {
			streamDeck.logger.info('Refreshing device list cache...');
			const result = await this.sendMessage('list', [], 10000); // Increased timeout from 5s to 10s
			const devices = result.devices || [];
			
			// Update cache
			this.deviceListCache = devices;
			this.deviceListCacheTime = now;
			this.lastDeviceListError = 0; // Clear error timestamp on success
			
			streamDeck.logger.info(`Device list cache updated: found ${devices.length} devices`);
			return devices;
		} catch (error) {
			streamDeck.logger.error('Failed to get available devices:', error);
			this.lastDeviceListError = now;
			
			// Return empty array on error since we have no stale cache to fall back to
			return [];
		}
	}

	/**
	 * Invalidates the device list cache, forcing a refresh on the next request.
	 * This should be called when:
	 * - User manually refreshes (key press)
	 * - A specific device is expected but not found
	 * - User has connected/disconnected a device
	 */
	invalidateDeviceCache(): void {
		streamDeck.logger.info('Device list cache invalidated - will refresh on next request');
		this.deviceListCache = null;
		this.deviceListCacheTime = 0;
		this.lastDeviceListError = 0;
		this.deviceEnumerationPromise = null; // Clear any ongoing enumeration
	}

	/**
	 * Gets a specific device from the cache, refreshing if not found.
	 */
	private async findDevice(productId: number): Promise<{productId: number, name: string, id: string} | null> {
		// First try cached devices
		let devices = await this.getAvailableDevices();
		let targetDevice = devices.find(device => device.productId === productId);
		
		if (!targetDevice && this.deviceListCache !== null) {
			// Device not found in cache, try refreshing once
			streamDeck.logger.info(`Device 0x${productId.toString(16)} not found in cache, refreshing...`); // Changed from debug to info
			this.invalidateDeviceCache();
			devices = await this.getAvailableDevices();
			targetDevice = devices.find(device => device.productId === productId);
		}
		
		return targetDevice || null;
	}

	/**
	 * Gets the battery level for a specific device, or the first available device if no product ID is specified.
	 */
	async getBatteryLevel(targetProductId?: number): Promise<number | null> {
		const result = await this.getBatteryInfo(targetProductId);
		return result?.batteryLevel ?? null;
	}

	/**
	 * Gets detailed battery information for a specific device.
	 */
	async getBatteryInfo(targetProductId?: number): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		try {
			// If a specific device is requested, check if it exists in our cache first
			if (targetProductId !== undefined) {
				const targetDevice = await this.findDevice(targetProductId);
				if (!targetDevice) {
					streamDeck.logger.warn(`Requested device 0x${targetProductId.toString(16)} not found in cache`);
					return null;
				}
				streamDeck.logger.info(`Getting battery for cached device: ${targetDevice.name}`); // Changed from debug to info
			}

			const args = [];
			if (targetProductId !== undefined) {
				args.push(`0x${targetProductId.toString(16)}`);
			}
			
			const result = await this.sendMessage('battery', args, 6000);
			
			// If the worker returns null for a specific device (device not found), 
			// but our cache said it should exist, invalidate cache and retry once
			if (result === null && targetProductId !== undefined && this.deviceListCache !== null) {
				streamDeck.logger.info(`Battery query failed for device 0x${targetProductId.toString(16)} (device may have changed mode), invalidating cache and retrying...`);
				this.invalidateDeviceCache();
				
				try {
					// Retry with fresh device cache
					const devices = await this.getAvailableDevices();
					const freshTargetDevice = devices.find(device => this.deviceMatches(device.productId, targetProductId));
					
					if (freshTargetDevice) {
						streamDeck.logger.info(`Found similar device after cache refresh: ${freshTargetDevice.name} (0x${freshTargetDevice.productId.toString(16)})`);
						// Retry with the new device ID
						const retryArgs = [`0x${freshTargetDevice.productId.toString(16)}`];
						return await this.sendMessage('battery', retryArgs, 6000);
					} else {
						streamDeck.logger.warn(`No matching device found after cache refresh for 0x${targetProductId.toString(16)}`);
						return null;
					}
				} catch (retryError) {
					streamDeck.logger.error('Failed to get battery info after cache refresh:', retryError);
					return null;
				}
			}
			
			return result;
		} catch (error) {
			streamDeck.logger.error('Failed to get battery info:', error);
			return null;
		}
	}

	/**
	 * Checks if two device product IDs represent the same physical device in different modes.
	 * Only includes confirmed device pairs - add more as they're discovered and verified.
	 */
	private deviceMatches(deviceProductId: number, targetProductId: number): boolean {
		// Direct match
		if (deviceProductId === targetProductId) {
			return true;
		}
		
		// Check for known device mode pairs (wired/wireless variants of same device)
		// Only include pairs that have been confirmed through actual testing
		const confirmedDevicePairs = [
			[0x7a, 0x7b], // Razer Viper Ultimate (Wired/Wireless) - CONFIRMED
			// Add more pairs here as they're discovered and verified
			// [0x007C, 0x007D], // Razer DeathAdder V2 Pro (Wired/Wireless) - UNCONFIRMED
			// [0x0086, 0x0088], // Razer Basilisk Ultimate (Wired/Wireless) - UNCONFIRMED
		];
		
		return confirmedDevicePairs.some(pair => 
			(pair[0] === deviceProductId && pair[1] === targetProductId) ||
			(pair[1] === deviceProductId && pair[0] === targetProductId)
		);
	}

	/**
	 * Gets battery information for the first device matching the filter function.
	 * This is more efficient than getting all devices and filtering client-side.
	 */
	async getBatteryInfoForDeviceType(isTargetDevice: (productId: number) => boolean): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		try {
			// Get available devices from cache
			const devices = await this.getAvailableDevices();
			const targetDevice = devices.find(device => isTargetDevice(device.productId));
			
			if (!targetDevice) {
				streamDeck.logger.info('No matching device found in cache'); // Changed from debug to info
				return null;
			}

			streamDeck.logger.info(`Getting battery for ${targetDevice.name} (0x${targetDevice.productId.toString(16)})`); // Changed from debug to info;
			return await this.getBatteryInfo(targetDevice.productId);
		} catch (error) {
			streamDeck.logger.error('Failed to get battery info for device type:', error);
			return null;
		}
	}

	/**
	 * Shuts down the persistent worker process.
	 */
	async shutdown(): Promise<void> {
		if (!this.worker || this.worker.killed) {
			return;
		}

		streamDeck.logger.info('Shutting down USB worker...'); // Changed from debug to info
		this.isShuttingDown = true;

		// Clear caches
		this.deviceListCache = null;
		this.deviceListCacheTime = 0;
		this.lastDeviceListError = 0;

		// Cancel all pending messages
		for (const [id, pendingMessage] of this.pendingMessages) {
			clearTimeout(pendingMessage.timeout);
			pendingMessage.reject(new Error('Service shutting down'));
		}
		this.pendingMessages.clear();

		// Gracefully terminate worker
		this.worker.kill('SIGTERM');
		
		// Force kill after 5 seconds if still running
		setTimeout(() => {
			if (this.worker && !this.worker.killed) {
				streamDeck.logger.warn('Force killing worker process');
				this.worker.kill('SIGKILL');
			}
		}, 5000);

		this.worker = null;
		streamDeck.logger.info('USB worker shutdown complete'); // Changed from debug to info
	}
}