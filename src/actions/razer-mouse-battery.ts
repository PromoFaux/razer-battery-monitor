import { action } from "@elgato/streamdeck";
import { RazerBatteryAction, BatterySettings } from "./base-razer-battery-action";
import { WIRELESS_MICE } from "../constants/device-ids";

/**
 * An action that displays the battery level of connected Razer mouse devices.
 */
@action({ UUID: "com.promofaux.razer-battery.mouse-battery" })
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
	 * Checks if a device is a mouse with wireless/battery capability.
	 */
	protected isTargetDevice(productId: number): boolean {
		return WIRELESS_MICE.has(productId);
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