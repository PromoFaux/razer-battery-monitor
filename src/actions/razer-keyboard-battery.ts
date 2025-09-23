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
	protected async getBatteryInfo(forceRefresh: boolean): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean, isSleeping?: boolean} | null> {
		return await this.batteryService.getKeyboardBatteryLevel();
	}

	/**
	 * Formats the display text for keyboard with charging indicator.
	 */
	protected formatDisplayText(batteryPercent: number, isCharging: boolean, isSleeping?: boolean): string {
		if (isSleeping) {
			// Keyboards don't currently support sleep detection, but included for consistency
			return `Keyb\nSleeping\n💤`;
		}
		if (isCharging) {
			// When charging, just show the lightning bolt emoji
			return `Keyb\n⚡`;
		} else {
            // Normal battery display (not charging)
            const percentText = batteryPercent !== null ? batteryPercent.toFixed(1) : "--";
            return `Keyb\n${percentText}%`;
		}
	}
}

/**
 * Settings for {@link RazerKeyboardBattery}.
 */
interface KeyboardBatterySettings extends BatterySettings {
	// Keyboard-specific settings can be added here if needed
}