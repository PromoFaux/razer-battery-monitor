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
	 * Gets battery info for keyboard devices using the service method.
	 */
	protected async getBatteryInfo(forceRefresh: boolean): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		return await this.batteryService.getKeyboardBatteryInfo(forceRefresh);
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