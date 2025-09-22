import { KeyDownEvent, SingletonAction, WillAppearEvent, streamDeck, JsonObject } from "@elgato/streamdeck";
import { RazerBatteryService } from "../services/razer-battery-service";

// Shared service instance to avoid creating multiple instances
const sharedBatteryService = new RazerBatteryService();

// Export the shared service for shutdown handling
export { sharedBatteryService };

/**
 * Base class for Razer battery actions with common functionality.
 */
export abstract class RazerBatteryAction<T extends BatterySettings> extends SingletonAction<T> {
	protected readonly batteryService = sharedBatteryService;
	protected updateInterval?: NodeJS.Timeout;

	/**
	 * Called when the action appears. Sets up periodic battery level updates.
	 */
	override async onWillAppear(ev: WillAppearEvent<T>): Promise<void> {
		const deviceType = this.getDeviceType();
		streamDeck.logger.info(`[   Service] ${deviceType} battery action appeared`);
		
		// Set initial display
		await this.updateBatteryDisplay(ev);
		
		// Set up periodic updates with device-specific default interval
		const updateIntervalMs = (ev.payload.settings.updateInterval ?? this.getDefaultInterval()) * 1000;
		streamDeck.logger.info(`[   Service] ${deviceType} battery: ${updateIntervalMs}ms update interval`); // Changed from debug to info
		
		   this.updateInterval = setInterval(async () => {
			   await this.updateBatteryDisplay(ev);
		   }, updateIntervalMs);
	}

	/**
	 * Called when the action disappears. Cleans up the update interval.
	 */
	override onWillDisappear(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = undefined;
		}
	}

	/**
	 * Handles key press events. Immediately updates the battery level.
	 * Invalidation is handled by the forceRefresh parameter in updateBatteryDisplay.
	 */
	   override async onKeyDown(ev: KeyDownEvent<T>): Promise<void> {
		   const deviceType = this.getDeviceType();
		   streamDeck.logger.info(`[   Service] ${deviceType} battery: Manual refresh`);
		   try {
			   // Force refresh will handle cache invalidation internally
			   await this.updateBatteryDisplay(ev, true); // Force refresh on manual button press
		   } catch (error) {
			   streamDeck.logger.error(`${deviceType} battery: Manual update failed:`, error);
		   }
	   }

	/**
	 * Updates the action display with current battery level.
	 * Common implementation for all device types.
	 */
	   protected async updateBatteryDisplay(ev: WillAppearEvent<T> | KeyDownEvent<T>, forceRefresh: boolean = false): Promise<void> {
		   const deviceType = this.getDeviceType();
		   try {
			   // Get device-specific battery info - subclasses provide the appropriate service method call
			   const batteryInfo = await this.getBatteryInfo(forceRefresh);
			   
		   if (batteryInfo) {
			   streamDeck.logger.info(`[   Service] Found ${deviceType.toLowerCase()}: ${batteryInfo.deviceName}`);
				   // Set device name, batteryLevel, and charging state in settings so PI can receive them
				   const newSettings = {
					   ...ev.payload.settings,
					   deviceName: batteryInfo.deviceName,
					   batteryLevel: batteryInfo.batteryLevel,
					   charging: batteryInfo.isCharging ?? null
				   };
				   await ev.action.setSettings(newSettings);
				   
				   if (batteryInfo.isSleeping) {
					   // Device is sleeping
					   const displayText = this.formatDisplayText(0, false, true);
					   streamDeck.logger.info(`[   Service] ${deviceType} is sleeping`);
					   await ev.action.setTitle(displayText);
				   } else if (batteryInfo.isCharging && batteryInfo.batteryLevel === null) {
					   // Device is charging but battery level is unreliable
					   const displayText = this.formatDisplayText(0, true, false);
					   streamDeck.logger.info(`[   Service] ${deviceType} battery: charging (level unavailable)`);
					   await ev.action.setTitle(displayText);
				   } else if (batteryInfo.batteryLevel !== null) {
					   // Normal case with valid battery level
					   const batteryPercent = Math.round(batteryInfo.batteryLevel);
					   const displayText = this.formatDisplayText(batteryPercent, batteryInfo.isCharging ?? false, false);
					   streamDeck.logger.info(`[   Service] ${deviceType} battery: ${batteryPercent}%${batteryInfo.isCharging ? ' (charging)' : ''}`);
					   await ev.action.setTitle(displayText);
					   // Set battery level icon
					   const iconPath = this.getBatteryIconPath(batteryInfo.batteryLevel);
					   if (iconPath) {
						   await ev.action.setImage(iconPath);
					   }
				   } else {
					   // Device found but no battery data - update settings to reflect this
					   const newSettings = {
						   ...ev.payload.settings,
						   deviceName: null,
						   batteryLevel: null,
						   charging: null
					   };
					   await ev.action.setSettings(newSettings);
					   await ev.action.setTitle(`${this.getDisplayPrefix()}\nNo Data`);
				   }
			   } else {
				   // No matching device found - invalidate cache to force fresh enumeration
				   streamDeck.logger.info(`[   Service] No ${deviceType.toLowerCase()} devices found, invalidating cache`);
				   await this.batteryService.invalidateCache();
				   const newSettings = {
					   ...ev.payload.settings,
					   deviceName: null,
					   batteryLevel: null,
					   charging: null
				   };
				   await ev.action.setSettings(newSettings);
				   await ev.action.setTitle(`${this.getDisplayPrefix()}\nNo Device`);
			   }
		   } catch (error) {
			   streamDeck.logger.error(`[   Service] Error updating ${deviceType.toLowerCase()} battery display:`, error);
			   await ev.action.setTitle(`${this.getDisplayPrefix()}\nError`);
		   }
	   }

	/**
	 * Gets the appropriate icon path based on battery level.
	 */
	protected getBatteryIconPath(batteryLevel: number): string | null {
		if (batteryLevel > 80) return "imgs/actions/battery/battery_90.png";
		if (batteryLevel > 60) return "imgs/actions/battery/battery_75.png";
		if (batteryLevel > 40) return "imgs/actions/battery/battery_50.png";
		if (batteryLevel > 20) return "imgs/actions/battery/battery_25.png";
		return "imgs/actions/battery/battery_10.png";
	}

	// Abstract methods that subclasses must implement
	protected abstract getDeviceType(): string;
	protected abstract getDefaultInterval(): number;
	protected abstract formatDisplayText(batteryPercent: number, isCharging: boolean, isSleeping?: boolean): string;
	protected abstract getDisplayPrefix(): string;
	
	/**
	 * Abstract method to get battery info for the specific device type.
	 * Subclasses should call the appropriate service method (getMouseBatteryInfo or getKeyboardBatteryInfo).
	 */
	protected abstract getBatteryInfo(forceRefresh: boolean): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean, isSleeping?: boolean} | null>;
}

/**
 * Base settings interface for battery actions.
 */
export interface BatterySettings extends JsonObject {
	updateInterval?: number; // Update interval in seconds
}