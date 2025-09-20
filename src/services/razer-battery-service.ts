import { spawn } from 'child_process';
import { join } from 'path';
import streamDeck from "@elgato/streamdeck";

/**
 * Service for communicating with Razer devices to retrieve battery information.
 * Uses a CommonJS worker process to handle USB communication and avoid ES module issues.
 */
export class RazerBatteryService {
	private readonly workerPath = join(process.cwd(), 'bin', 'usb-worker.cjs');
	private readonly nodeExecutable = process.execPath;

	/**
	 * Gets available Razer devices on the system.
	 */
	async getAvailableDevices(): Promise<Array<{productId: number, name: string, id: string}>> {
		return this.executeWorker(['list'], 5000);
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
		return this.executeWorker(args, 6000);
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
}