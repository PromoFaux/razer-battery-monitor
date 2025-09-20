import { action } from "@elgato/streamdeck";
import { RazerBatteryAction, BatterySettings } from "./base-razer-battery-action";
import { WIRELESS_KEYBOARDS } from "../constants/device-ids";

/**
 * An action that displays the battery level of connected Razer keyboard devices.
 */
@action({ UUID: "com.promofaux.razer-battery.keyboard-battery" })
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
	 * Checks if a device is a keyboard with wireless/battery capability.
	 */
	protected isTargetDevice(productId: number): boolean {
		return WIRELESS_KEYBOARDS.has(productId);
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