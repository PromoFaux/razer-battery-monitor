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
	
	// Battery status caching per device (short-term cache to avoid redundant queries)
	private batteryCache = new Map<number, {
		batteryLevel: number | null,
		deviceName: string,
		productId: number,
		isCharging?: boolean,
		timestamp: number
	}>();
	private readonly BATTERY_CACHE_DURATION = 10000; // Cache battery status for 10 seconds
	private retryAttempted = false; // Prevent infinite retry loops

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
	 * Gets the list of available Razer devices.
	 * Now directly delegates to the USB worker which handles caching.
	 */
	async getAvailableDevices(): Promise<Array<{productId: number, name: string, id: string}>> {
		try {
			const result = await this.sendMessage('list', [], 10000);
			const devices = result.devices || [];
			streamDeck.logger.debug(`Retrieved device list: found ${devices.length} devices`);
			return devices;
		} catch (error) {
			streamDeck.logger.error('Failed to get device list:', error);
			throw error;
		}
	}

	/**
	 * Invalidates cached data when devices change.
	 */
	invalidateDeviceCache(): void {
		streamDeck.logger.info('Device cache invalidated - clearing battery cache');
		this.batteryCache.clear(); // Clear battery cache when devices change
	}

	/**
	 * Gets a specific device, with automatic refresh if not found.
	 */
	private async findDevice(productId: number): Promise<{productId: number, name: string, id: string} | null> {
		// First try to find device
		let devices = await this.getAvailableDevices();
		let targetDevice = devices.find(device => device.productId === productId);
		
		if (!targetDevice) {
			// Device not found, try refreshing once
			streamDeck.logger.info(`Device 0x${productId.toString(16)} not found, refreshing...`);
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
				
				// Check battery cache first (short-term cache to avoid redundant USB queries)
				const now = Date.now();
				const cachedBattery = this.batteryCache.get(targetProductId);
				if (cachedBattery && (now - cachedBattery.timestamp) < this.BATTERY_CACHE_DURATION) {
					streamDeck.logger.info(`Using cached battery for ${targetDevice.name} (${now - cachedBattery.timestamp}ms old)`);
					return cachedBattery;
				}
				
				streamDeck.logger.info(`Getting battery for cached device: ${targetDevice.name}`); // Changed from debug to info
			}

			const args = [];
			if (targetProductId !== undefined) {
				args.push(`0x${targetProductId.toString(16)}`);
			}
			
			const result = await this.sendMessage('battery', args, 6000);
			
			// Cache the result if we have a specific device
			if (result && targetProductId !== undefined) {
				this.batteryCache.set(targetProductId, {
					...result,
					timestamp: Date.now()
				});
			}
			
			// If the worker returns null for a specific device (device not found), 
			// but we expected it to exist, invalidate cache and retry once
			if (result === null && targetProductId !== undefined && !this.retryAttempted) {
				streamDeck.logger.info(`Battery query failed for device 0x${targetProductId.toString(16)} (device may have changed mode), invalidating cache and retrying...`);
				this.retryAttempted = true; // Prevent infinite retry loop
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
			
			// Reset retry flag after successful operation
			this.retryAttempted = false;
			return result;
		} catch (error) {
			streamDeck.logger.error('Failed to get battery info:', error);
			return null;
		}
	}

	/**
	 * Internal method to get battery info when we already know the device exists.
	 * Skips device verification to avoid redundant getAvailableDevices() calls.
	 */
	private async getBatteryInfoInternal(targetProductId: number, deviceName: string): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		try {
			// Check battery cache first (short-term cache to avoid redundant USB queries)
			const now = Date.now();
			const cachedBattery = this.batteryCache.get(targetProductId);
			if (cachedBattery && (now - cachedBattery.timestamp) < this.BATTERY_CACHE_DURATION) {
				streamDeck.logger.info(`Using cached battery for ${deviceName} (${now - cachedBattery.timestamp}ms old)`);
				return cachedBattery;
			}
			
			streamDeck.logger.info(`Getting battery for cached device: ${deviceName}`);
			
			const args = [`0x${targetProductId.toString(16)}`];
			const result = await this.sendMessage('battery', args, 6000);
			
			// Cache the result
			if (result) {
				this.batteryCache.set(targetProductId, {
					...result,
					timestamp: Date.now()
				});
			}
			
			// Reset retry flag after successful operation
			this.retryAttempted = false;
			return result;
		} catch (error) {
			streamDeck.logger.error('Failed to get battery info internal:', error);
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
				streamDeck.logger.info('No matching device found');
				return null;
			}

			// Call internal battery method that skips device verification since we already found it
			return await this.getBatteryInfoInternal(targetDevice.productId, targetDevice.name);
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

		streamDeck.logger.info('Shutting down USB worker...');
		this.isShuttingDown = true;

		// Clear battery cache only (USB worker handles device caching)
		this.batteryCache.clear();
		this.retryAttempted = false;

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