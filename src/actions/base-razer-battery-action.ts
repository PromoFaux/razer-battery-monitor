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
		streamDeck.logger.info(`${deviceType} battery action appeared`);
		
		// Set initial display
		await this.updateBatteryDisplay(ev);
		
		// Set up periodic updates with device-specific default interval
		const updateIntervalMs = (ev.payload.settings.updateInterval ?? this.getDefaultInterval()) * 1000;
		streamDeck.logger.debug(`${deviceType} battery: ${updateIntervalMs}ms update interval`);
		
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
	 */
	   override async onKeyDown(ev: KeyDownEvent<T>): Promise<void> {
		   const deviceType = this.getDeviceType();
		   streamDeck.logger.info(`${deviceType} battery: Manual refresh`);
		   try {
			   await this.updateBatteryDisplay(ev);
		   } catch (error) {
			   streamDeck.logger.error(`${deviceType} battery: Manual update failed:`, error);
		   }
	   }

	/**
	 * Updates the action display with current battery level.
	 */
	   protected async updateBatteryDisplay(ev: WillAppearEvent<T> | KeyDownEvent<T>): Promise<void> {
		   const deviceType = this.getDeviceType();
		   try {
			   // Get devices matching this action type
			   const devices = await this.batteryService.getAvailableDevices();
			   const targetDevice = devices.find(device => this.isTargetDevice(device.productId));
			   if (targetDevice) {
				   streamDeck.logger.debug(`Found ${deviceType.toLowerCase()}: ${targetDevice.name}`);
				   const batteryInfo = await this.batteryService.getBatteryInfo(targetDevice.productId);
				   // Set device name, batteryLevel, and charging state in settings so PI can receive them
				   const newSettings = {
					   ...ev.payload.settings,
					   deviceName: targetDevice.name,
					   batteryLevel: batteryInfo?.batteryLevel ?? null,
					   charging: batteryInfo?.isCharging ?? null
				   };
				   await ev.action.setSettings(newSettings);
				   if (batteryInfo !== null) {
					   if (batteryInfo.isCharging && batteryInfo.batteryLevel === null) {
						   // Device is charging but battery level is unreliable
						   const displayText = this.formatDisplayText(0, true);
						   streamDeck.logger.info(`${deviceType} battery: charging (level unavailable)`);
						   await ev.action.setTitle(displayText);
					   } else if (batteryInfo.batteryLevel !== null) {
						   // Normal case with valid battery level
						   const batteryPercent = Math.round(batteryInfo.batteryLevel);
						   const displayText = this.formatDisplayText(batteryPercent, batteryInfo.isCharging ?? false);
						   streamDeck.logger.info(`${deviceType} battery: ${batteryPercent}%${batteryInfo.isCharging ? ' (charging)' : ''}`);
						   await ev.action.setTitle(displayText);
						   // Set battery level icon
						   const iconPath = this.getBatteryIconPath(batteryInfo.batteryLevel);
						   if (iconPath) {
							   await ev.action.setImage(iconPath);
						   }
					   } else {
						   await ev.action.setTitle(`${this.getDisplayPrefix()}\nNo Data`);
					   }
				   } else {
					   await ev.action.setTitle(`${this.getDisplayPrefix()}\nNo Data`);
				   }
			   } else {
				   await ev.action.setTitle(`${this.getDisplayPrefix()}\nNo Device`);
			   }
		   } catch (error) {
			   streamDeck.logger.error(`${deviceType} battery display update failed:`, error);
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
	protected abstract isTargetDevice(productId: number): boolean;
	protected abstract formatDisplayText(batteryPercent: number, isCharging: boolean): string;
	protected abstract getDisplayPrefix(): string;
}

/**
 * Base settings interface for battery actions.
 */
export interface BatterySettings extends JsonObject {
	updateInterval?: number; // Update interval in seconds
}