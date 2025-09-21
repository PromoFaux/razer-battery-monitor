import { action, KeyDownEvent, WillAppearEvent, streamDeck } from "@elgato/streamdeck";
import { RazerBatteryAction, BatterySettings } from "./base-razer-battery-action";

/**
 * An action that displays the battery level of connected Razer keyboard devices.
 * The USB worker handles device type detection and filtering.
 */
@action({ UUID: "com.promofaux.razer-battery-monitor.keyboard-battery" })
export class RazerKeyboardBattery extends RazerBatteryAction<KeyboardBatterySettings> {
	protected getDeviceType(): string {
		return "Keyboard";
	}

	protected getDefaultInterval(): number {
		return 300; // 5 minutes for keyboards to minimize power impact
	}

	protected getDisplayPrefix(): string {
		return "Keyb";
	}

	/**
	 * Updates the action display with current keyboard battery level.
	 * Uses the device-type-specific service method.
	 */
	   protected override async updateBatteryDisplay(ev: WillAppearEvent<KeyboardBatterySettings> | KeyDownEvent<KeyboardBatterySettings>, forceRefresh: boolean = false): Promise<void> {
		   try {
			   // Get keyboard battery info directly - USB worker handles device filtering
			   const batteryInfo = await this.batteryService.getKeyboardBatteryInfo(forceRefresh);
			   
		   if (batteryInfo) {
			   streamDeck.logger.info(`[   Service] Found keyboard: ${batteryInfo.deviceName}`);
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
					   streamDeck.logger.info(`[   Service] Keyboard battery: charging (level unavailable)`);
					   await ev.action.setTitle(displayText);
				   } else if (batteryInfo.batteryLevel !== null) {
					   // Normal case with valid battery level
					   const batteryPercent = Math.round(batteryInfo.batteryLevel);
					   const displayText = this.formatDisplayText(batteryPercent, batteryInfo.isCharging ?? false);
					   streamDeck.logger.info(`[   Service] Keyboard battery: ${batteryPercent}%${batteryInfo.isCharging ? ' (charging)' : ''}`);
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
				   streamDeck.logger.info(`[   Service] No keyboard devices found, invalidating cache`);
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
			   streamDeck.logger.error(`[   Service] Error updating keyboard battery display:`, error);
			   await ev.action.setTitle(`${this.getDisplayPrefix()}\nError`);
		   }
	   }

	/**
	 * Keyboards don't need device type detection - the service method handles filtering.
	 * All keyboards are valid targets for the keyboard battery action.
	 */
	protected isTargetDevice(productId: number): boolean {
		return true; // USB worker filters to keyboard devices only
	}

	/**
	 * Formats the display text for keyboard with charging indicator.
	 */
	protected formatDisplayText(batteryPercent: number, isCharging: boolean): string {
		if (isCharging) {
			// When charging, just show the lightning bolt emoji
			return `Keyb\n⚡`;
		} else {
			// Normal battery display (not charging)
			return `Keyb\n${batteryPercent}%`;
		}
	}
}

/**
 * Settings for {@link RazerKeyboardBattery}.
 */
interface KeyboardBatterySettings extends BatterySettings {
	// Keyboard-specific settings can be added here if needed
}