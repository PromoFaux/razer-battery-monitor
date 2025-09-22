import streamDeck from "@elgato/streamdeck";
import { 
	getAvailableDevices, 
	getBatteryLevel, 
	getMouseBatteryLevel, 
	getKeyboardBatteryLevel, 
	invalidateDeviceCache 
} from './usb-worker.js';

/**
 * Modern service for communicating with Razer devices to retrieve battery information.
 * Uses direct ES module imports instead of spawning child processes.
 */
export class RazerBatteryService {
	private isShuttingDown = false;

	/**
	 * Gets the list of available Razer devices.
	 */
	async getAvailableDevices(): Promise<{ devices: Array<{ productId: string; deviceName: string; hasWireless: boolean; isKeyboard: boolean }> }> {
		try {
			streamDeck.logger.info('[   Service] Getting available devices...');
			const result = await getAvailableDevices();
			streamDeck.logger.info(`[   Service] Found ${result.devices.length} available devices`);
			return result;
		} catch (error) {
			streamDeck.logger.error('[   Service] Error getting available devices:', (error as Error).message);
			throw error;
		}
	}

	/**
	 * Gets battery level for a specific device or the first available wireless device.
	 * 
	 * @param targetProductId Optional hex string of the target product ID (e.g., "007B")
	 * @param timeout Optional timeout in milliseconds (kept for API compatibility)
	 * @returns Battery information or null if no device found
	 */
	async getBatteryLevel(targetProductId?: string, timeout: number = 6000): Promise<any> {
		try {
			const productId = targetProductId ? parseInt(targetProductId, 16) : undefined;
			streamDeck.logger.info(`[   Service] Getting battery level${productId ? ` for device 0x${productId.toString(16)}` : ''}...`);
			
			const result = await getBatteryLevel(productId, streamDeck.logger);
			
			if (result) {
				streamDeck.logger.info(`[   Service] Battery: ${result.batteryLevel}%, charging: ${result.isCharging}, device: ${result.deviceName}`);
			} else {
				streamDeck.logger.warn('[   Service] No battery data available');
			}
			
			return result;
		} catch (error) {
			streamDeck.logger.error('[   Service] Error getting battery level:', (error as Error).message);
			throw error;
		}
	}

	/**
	 * Gets battery level specifically for mouse devices.
	 * 
	 * @param timeout Optional timeout in milliseconds (kept for API compatibility)
	 * @returns Battery information or null if no mouse found
	 */
	async getMouseBatteryLevel(timeout: number = 6000): Promise<any> {
		try {
			streamDeck.logger.info('[   Service] Getting mouse battery level...');
			
			const result = await getMouseBatteryLevel(streamDeck.logger);
			
			if (result) {
				streamDeck.logger.info(`[   Service] Mouse battery: ${result.batteryLevel}%, charging: ${result.isCharging}, device: ${result.deviceName}`);
			} else {
				streamDeck.logger.warn('[   Service] No mouse battery data available');
			}
			
			return result;
		} catch (error) {
			streamDeck.logger.error('[   Service] Error getting mouse battery level:', (error as Error).message);
			throw error;
		}
	}

	/**
	 * Gets battery level specifically for keyboard devices.
	 * 
	 * @param timeout Optional timeout in milliseconds (kept for API compatibility)
	 * @returns Battery information or null if no keyboard found
	 */
	async getKeyboardBatteryLevel(timeout: number = 6000): Promise<any> {
		try {
			streamDeck.logger.info('[   Service] Getting keyboard battery level...');
			
			const result = await getKeyboardBatteryLevel(streamDeck.logger);
			
			if (result) {
				streamDeck.logger.info(`[   Service] Keyboard battery: ${result.batteryLevel}%, charging: ${result.isCharging}, device: ${result.deviceName}`);
			} else {
				streamDeck.logger.warn('[   Service] No keyboard battery data available');
			}
			
			return result;
		} catch (error) {
			streamDeck.logger.error('[   Service] Error getting keyboard battery level:', (error as Error).message);
			throw error;
		}
	}

	/**
	 * Invalidates the device cache to force fresh device enumeration.
	 * Useful when devices are connected/disconnected.
	 */
	async invalidateCache(): Promise<void> {
		try {
			streamDeck.logger.info('[   Service] Invalidating device cache...');
			invalidateDeviceCache();
			streamDeck.logger.info('[   Service] Device cache invalidated');
		} catch (error) {
			streamDeck.logger.error('[   Service] Error invalidating cache:', (error as Error).message);
			throw error;
		}
	}

	/**
	 * Shuts down the service.
	 * This is much simpler now since we don't have child processes to manage.
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.isShuttingDown = true;
		streamDeck.logger.info('[   Service] Shutting down service...');
		
		// Clear any cached data
		invalidateDeviceCache();
		
		streamDeck.logger.info('[   Service] Service shutdown complete');
	}

	/**
	 * Checks if the service is currently shutting down.
	 */
	isServiceShuttingDown(): boolean {
		return this.isShuttingDown;
	}
}