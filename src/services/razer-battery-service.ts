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

	/**
	 * Starts the persistent worker process if not already running.
	 */
	private async startWorker(): Promise<void> {
		if (this.worker && !this.worker.killed) {
			return; // Worker already running
		}

		streamDeck.logger.info('[   Service] Starting persistent USB worker...');
		
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
			streamDeck.logger.error('[   Service] Worker error:', error.message);
			if (error.message.includes('ENOENT') || (error as any).code === 'ENOENT') {
				streamDeck.logger.error('[   Service] FATAL: Stream Deck Node.js runtime not found. Try restarting Stream Deck.');
			}
			this.handleWorkerExit();
		});

		// Handle worker exit
		this.worker.on('exit', (code, signal) => {
			if (!this.isShuttingDown) {
				streamDeck.logger.warn(`[   Service] Worker process exited with code ${code}, signal ${signal}`);
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

		streamDeck.logger.info('[   Service] Persistent USB worker started'); // Changed from debug to info
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
			streamDeck.logger.debug(`[   Service] Retrieved device list: found ${devices.length} devices`);
			return devices;
		} catch (error) {
			streamDeck.logger.error('[   Service] Failed to get device list:', error);
			throw error;
		}
	}

	/**
	 * Invalidates cached data when devices change.
	 */
	async invalidateDeviceCache(): Promise<void> {
		try {
			await this.sendMessage('invalidate', [], 3000);
			streamDeck.logger.info('[   Service] Device cache invalidated');
		} catch (error) {
			streamDeck.logger.error('[   Service] Failed to invalidate device cache:', error);
		}
	}

	/**
	 * Public method to invalidate the device cache.
	 * Alias for invalidateDeviceCache for easier access from actions.
	 */
	async invalidateCache(): Promise<void> {
		return await this.invalidateDeviceCache();
	}

	/**
	 * Gets a specific device by product ID.
	 */
	private async findDevice(productId: number): Promise<{productId: number, name: string, id: string} | null> {
		const devices = await this.getAvailableDevices();
		return devices.find(device => device.productId === productId) || null;
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
					streamDeck.logger.warn(`[   Service] Requested device 0x${targetProductId.toString(16)} not found in cache`);
					return null;
				}
				
				streamDeck.logger.info(`[   Service] Getting battery for device: ${targetDevice.name}`); // Changed from debug to info
			}

			const args = [];
			if (targetProductId !== undefined) {
				args.push(`0x${targetProductId.toString(16)}`);
			}
			
			return await this.sendMessage('battery', args, 6000);
		} catch (error) {
			streamDeck.logger.error('[   Service] Failed to get battery info:', error);
			return null;
		}
	}

	/**
	 * Gets battery information for the first available mouse device.
	 * Uses simple cache invalidation: if no mouse found or communication failed, invalidate cache and retry once.
	 */
	async getMouseBatteryInfo(forceRefresh: boolean = false): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		try {
			// Force cache invalidation if requested (manual refresh button press)  
			if (forceRefresh) {
				streamDeck.logger.info('[   Service] Manual refresh - invalidating cache...');
				await this.invalidateDeviceCache();
			}

		// Try to get mouse battery info
		let result = await this.sendMessage('mouse');
		
		// If no mouse found, or result is null/invalid, and we haven't already invalidated the cache, try once more with fresh enumeration
		// Note: Don't treat charging mice (batteryLevel: null, isCharging: true) as missing devices
		if ((!result || (result.batteryLevel === null && !result.isCharging)) && !forceRefresh) {
			streamDeck.logger.info('[   Service] No mouse found or communication failed - invalidating cache and retrying...');
			await this.invalidateDeviceCache();
			result = await this.sendMessage('mouse');
		}
		
		// Accept valid results: either have battery level OR are charging
		if (result && (result.batteryLevel !== null || result.isCharging)) {
			// Log appropriate message based on device state
			if (result.isCharging && result.batteryLevel === null) {
				streamDeck.logger.info(`[   Service] Found charging mouse: ${result.deviceName || 'Unknown'}`);
			} else {
				streamDeck.logger.info(`[   Service] Found mouse: ${result.deviceName || 'Unknown'}`);
				if (result.batteryLevel !== null) {
					streamDeck.logger.info(`[   Service] Mouse battery: ${Math.round(result.batteryLevel)}%`);
				}
			}
			
			return {
				batteryLevel: result.batteryLevel,
				deviceName: result.deviceName || 'Unknown Mouse',
				productId: result.productId || 0,
				isCharging: result.isCharging
			};
		}
		
		streamDeck.logger.info('[   Service] No mouse devices found, invalidating cache');
		await this.invalidateDeviceCache();
		return null;
		} catch (error) {
			streamDeck.logger.error('[   Service] Failed to get mouse battery info:', error);
			return null;
		}
	}

	/**
	 * Gets battery information for the first available keyboard device.
	 * Uses simple cache invalidation: if no keyboard found or communication failed, invalidate cache and retry once.
	 */
	async getKeyboardBatteryInfo(forceRefresh: boolean = false): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		try {
			// Force cache invalidation if requested (manual refresh button press)
			if (forceRefresh) {
				streamDeck.logger.info('[   Service] Manual refresh - invalidating cache...');
				await this.invalidateDeviceCache();
			}

		// Try to get keyboard battery info
		let result = await this.sendMessage('keyboard');
		
		// If no keyboard found, or result is null/invalid, and we haven't already invalidated the cache, try once more with fresh enumeration
		// Note: Don't treat charging keyboards (batteryLevel: null, isCharging: true) as missing devices
		if ((!result || (result.batteryLevel === null && !result.isCharging)) && !forceRefresh) {
			streamDeck.logger.info('[   Service] No keyboard found or communication failed - invalidating cache and retrying...');
			await this.invalidateDeviceCache();
			result = await this.sendMessage('keyboard');
		}
		
		// Accept valid results: either have battery level OR are charging
		if (result && (result.batteryLevel !== null || result.isCharging)) {
			// Log appropriate message based on device state
			if (result.isCharging && result.batteryLevel === null) {
				streamDeck.logger.info(`[   Service] Found charging keyboard: ${result.deviceName || 'Unknown'}`);
			} else {
				streamDeck.logger.info(`[   Service] Found keyboard: ${result.deviceName || 'Unknown'}`);
				if (result.batteryLevel !== null) {
					streamDeck.logger.info(`[   Service] Keyboard battery: ${Math.round(result.batteryLevel)}%`);
				}
			}
			
			return {
				batteryLevel: result.batteryLevel,
				deviceName: result.deviceName || 'Unknown Keyboard',
				productId: result.productId || 0,
				isCharging: result.isCharging
			};
		}
		
		streamDeck.logger.info('[   Service] No keyboard devices found, invalidating cache');
		await this.invalidateDeviceCache();
		return null;
		} catch (error) {
			streamDeck.logger.error('[   Service] Failed to get keyboard battery info:', error);
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

		streamDeck.logger.info('[   Service] Shutting down USB worker...');
		this.isShuttingDown = true;

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
				streamDeck.logger.warn('[   Service] Force killing worker process');
				this.worker.kill('SIGKILL');
			}
		}, 5000);

		this.worker = null;
		streamDeck.logger.info('[   Service] USB worker shutdown complete'); // Changed from debug to info
	}
}