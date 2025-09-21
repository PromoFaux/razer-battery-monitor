import { action, KeyDownEvent, WillAppearEvent, streamDeck } from "@elgato/streamdeck";
import { RazerBatteryAction, BatterySettings } from "./base-razer-battery-action";

/**
 * An action that displays the battery level of connected Razer mouse devices.
 * The USB worker handles device type detection and filtering.
 */
@action({ UUID: "com.promofaux.razer-battery-monitor.mouse-battery" })
export class RazerMouseBattery extends RazerBatteryAction<MouseBatterySettings> {
	protected getDeviceType(): string {
		return "Mouse";
	}

	protected getDefaultInterval(): number {
		return 30; // 30 seconds for mice
	}

	protected getDisplayPrefix(): string {
		return "Mouse";
	}

	/**
	 * Updates the action display with current mouse battery level.
	 * Uses the device-type-specific service method.
	 */
	   protected override async updateBatteryDisplay(ev: WillAppearEvent<MouseBatterySettings> | KeyDownEvent<MouseBatterySettings>, forceRefresh: boolean = false): Promise<void> {
		   try {
			   // Get mouse battery info directly - USB worker handles device filtering
			   const batteryInfo = await this.batteryService.getMouseBatteryInfo(forceRefresh);
			   
		   if (batteryInfo) {
			   streamDeck.logger.info(`[   Service] Found mouse: ${batteryInfo.deviceName}`);
				   // Set device name, batteryLevel, and charging state in settings so PI can receive them
				   const newSettings = {
					   ...ev.payload.settings,
					   deviceName: batteryInfo.deviceName,
					   batteryLevel: batteryInfo.batteryLevel,
					   charging: batteryInfo.isCharging ?? null
				   };
				   await ev.action.setSettings(newSettings);
				   
				   if (batteryInfo.isCharging && batteryInfo.batteryLevel === null) {
					   // Device is charging but battery level is unreliable
					   const displayText = this.formatDisplayText(0, true);
					   streamDeck.logger.info(`[   Service] Mouse battery: charging (level unavailable)`);
					   await ev.action.setTitle(displayText);
				   } else if (batteryInfo.batteryLevel !== null) {
					   // Normal case with valid battery level
					   const batteryPercent = Math.round(batteryInfo.batteryLevel);
					   const displayText = this.formatDisplayText(batteryPercent, batteryInfo.isCharging ?? false);
					   streamDeck.logger.info(`[   Service] Mouse battery: ${batteryPercent}%${batteryInfo.isCharging ? ' (charging)' : ''}`);
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
				   streamDeck.logger.info(`[   Service] No mouse devices found, invalidating cache`);
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
			   streamDeck.logger.error(`[   Service] Error updating mouse battery display:`, error);
			   await ev.action.setTitle(`${this.getDisplayPrefix()}\nError`);
		   }
	   }

	/**
	 * Mice don't need device type detection - the service method handles filtering.
	 * All mice are valid targets for the mouse battery action.
	 */
	protected isTargetDevice(productId: number): boolean {
		return true; // USB worker filters to mouse devices only
	}

	/**
	 * Formats the display text for mouse with charging indicator on separate line.
	 */
	protected formatDisplayText(batteryPercent: number, isCharging: boolean): string {
		return isCharging 
			? `Mouse\n${batteryPercent}%\n⚡`
			: `Mouse\n${batteryPercent}%`;
	}
}

/**
 * Settings for {@link RazerMouseBattery}.
 */
interface MouseBatterySettings extends BatterySettings {
	// Mouse-specific settings can be added here if needed
}