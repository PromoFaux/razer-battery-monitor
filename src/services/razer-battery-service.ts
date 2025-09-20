import { spawn } from 'child_process';
import { join } from 'path';
import streamDeck from "@elgato/streamdeck";
import http from 'http';
import { PrivilegedServiceManager } from './privileged-service-manager.js';

/**
 * Service for communicating with Razer devices to retrieve battery information.
 * Uses a CommonJS worker process to handle USB communication and avoid ES module issues.
 */
export class RazerBatteryService {
	private readonly workerPath = join(process.cwd(), 'bin', 'usb-worker.cjs');
	private readonly nodeExecutable = process.execPath;
	private readonly privilegedService = new PrivilegedServiceManager();
	
	// Cache USB access state to avoid repeated failures
	private usbAccessFailed = false;
	private lastUsbCheck = 0;
	private readonly USB_RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes

	/**
	 * Check if we should try direct USB access or skip to privileged service
	 */
	private shouldTryDirectUSB(): boolean {
		// If USB access never failed, try it
		if (!this.usbAccessFailed) {
			return true;
		}
		
		// If it failed recently, don't retry
		const now = Date.now();
		if (now - this.lastUsbCheck < this.USB_RETRY_INTERVAL) {
			streamDeck.logger.debug('Skipping direct USB access (failed recently), using privileged service');
			return false;
		}
		
		// It's been a while, let's try again
		streamDeck.logger.debug('Retrying direct USB access after timeout');
		return true;
	}

	/**
	 * Mark USB access as failed
	 */
	private markUsbAccessFailed(): void {
		this.usbAccessFailed = true;
		this.lastUsbCheck = Date.now();
		streamDeck.logger.debug('Marked direct USB access as failed, will use privileged service for next 5 minutes');
	}

	/**
	 * Mark USB access as successful (reset failure state)
	 */
	private markUsbAccessSuccess(): void {
		if (this.usbAccessFailed) {
			streamDeck.logger.info('Direct USB access recovered!');
			this.usbAccessFailed = false;
			this.lastUsbCheck = 0;
		}
	}

	/**
	 * Gets available Razer devices on the system.
	 */
	async getAvailableDevices(): Promise<Array<{productId: number, name: string, id: string}>> {
		// Check if we should try direct USB
		if (this.shouldTryDirectUSB()) {
			// Try direct USB first
			const result = await this.executeWorker(['list'], 5000);
			
			// If direct access succeeds
			if (result && Array.isArray(result) && result.length > 0) {
				this.markUsbAccessSuccess();
				return result;
			}
			
			// Mark as failed if we got no results
			if (!result || (Array.isArray(result) && result.length === 0)) {
				this.markUsbAccessFailed();
			}
		}
		
		// Use privileged service fallback
		streamDeck.logger.info('Using privileged service for device listing');
		await this.privilegedService.ensureServiceRunning();
		const result = await this.tryPrivilegedService('/devices');
		return result || [];
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
		const args = ['battery'];
		if (targetProductId !== undefined) {
			args.push(`0x${targetProductId.toString(16)}`);
		}
		
		// Check if we should try direct USB
		if (this.shouldTryDirectUSB()) {
			// Try direct USB first
			const result = await this.executeWorker(args, 6000);
			
			// If direct access succeeds
			if (result) {
				this.markUsbAccessSuccess();
				return result;
			}
			
			// Mark as failed
			this.markUsbAccessFailed();
		}
		
		// Use privileged service fallback
		streamDeck.logger.info('Using privileged service for battery info');
		await this.privilegedService.ensureServiceRunning();
		const deviceParam = targetProductId ? `?device=${targetProductId.toString(16)}` : '';
		const result = await this.tryPrivilegedService(`/battery${deviceParam}`);
		return result;
	}

	/**
	 * Generic worker execution method to eliminate code duplication.
	 */
	private async executeWorker(args: string[], timeout: number): Promise<any> {
		return new Promise((resolve) => {
			const worker = spawn(this.nodeExecutable, [this.workerPath, ...args], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			let hasResult = false;

			worker.stdout.on('data', (data) => {
				const output = data.toString();
				const lines = output.trim().split('\n');
				
				for (const line of lines) {
					if (line.startsWith('{')) {
						try {
							const result = JSON.parse(line);
							if ((result.devices !== undefined || 'batteryLevel' in result) && !hasResult) {
								hasResult = true;
								worker.kill();
								resolve(args[0] === 'list' ? result.devices : result);
								return;
							}
						} catch (parseError) {
							// Continue looking for valid JSON
						}
					}
				}
			});

			worker.stderr.on('data', (data) => {
				streamDeck.logger.warn('Worker stderr:', data.toString());
			});

			worker.on('close', (code) => {
				if (!hasResult) {
					resolve(args[0] === 'list' ? [] : null);
				}
			});

			worker.on('error', (error) => {
				streamDeck.logger.error('Worker error:', error.message);
				if (error.message.includes('ENOENT') || (error as any).code === 'ENOENT') {
					streamDeck.logger.error('FATAL: Stream Deck Node.js runtime not found. Try restarting Stream Deck.');
				}
				if (!hasResult) {
					hasResult = true;
					resolve(args[0] === 'list' ? [] : null);
				}
			});

			setTimeout(() => {
				if (!hasResult && !worker.killed) {
					worker.kill();
					resolve(args[0] === 'list' ? [] : null);
				}
			}, timeout);
		});
	}

	/**
	 * Attempts to use privileged service as fallback for macOS USB access issues.
	 */
	private async tryPrivilegedService(endpoint: string): Promise<any> {
		return new Promise((resolve) => {
			const request = http.get(`http://localhost:3847${endpoint}`, (response) => {
				let data = '';
				
				response.on('data', (chunk) => {
					data += chunk;
				});
				
				response.on('end', () => {
					try {
						const result = JSON.parse(data);
						
						if (endpoint === '/devices') {
							resolve(result.devices || []);
						} else if (endpoint.startsWith('/battery')) {
							resolve(result);
						} else {
							resolve(result);
						}
					} catch (error) {
						streamDeck.logger.error('Failed to parse privileged service response:', error);
						resolve(null);
					}
				});
			});
			
			request.on('error', (error) => {
				streamDeck.logger.debug('Privileged service not available:', error.message);
				resolve(null);
			});
			
			request.setTimeout(3000, () => {
				request.destroy();
				resolve(null);
			});
		});
	}
}