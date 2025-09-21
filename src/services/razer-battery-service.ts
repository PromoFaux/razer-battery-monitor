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

		streamDeck.logger.debug('Starting persistent USB worker...');
		
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
				if (output && !output.startsWith('{')) { // Don't log JSON responses
					streamDeck.logger.debug('Worker stdout:', output);
				}
			});
		}

		if (this.worker.stderr) {
			this.worker.stderr.on('data', (data) => {
				streamDeck.logger.warn('Worker stderr:', data.toString());
			});
		}

		streamDeck.logger.debug('Persistent USB worker started');
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
	 * Gets available Razer devices on the system.
	 */
	async getAvailableDevices(): Promise<Array<{productId: number, name: string, id: string}>> {
		try {
			const result = await this.sendMessage('list', [], 5000);
			return result.devices || [];
		} catch (error) {
			streamDeck.logger.error('Failed to get available devices:', error);
			return [];
		}
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
			const args = [];
			if (targetProductId !== undefined) {
				args.push(`0x${targetProductId.toString(16)}`);
			}
			return await this.sendMessage('battery', args, 6000);
		} catch (error) {
			streamDeck.logger.error('Failed to get battery info:', error);
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

		streamDeck.logger.debug('Shutting down USB worker...');
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
				streamDeck.logger.warn('Force killing worker process');
				this.worker.kill('SIGKILL');
			}
		}, 5000);

		this.worker = null;
		streamDeck.logger.debug('USB worker shutdown complete');
	}
}