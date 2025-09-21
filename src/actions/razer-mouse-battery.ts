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
	 * Gets battery info for mouse devices using the service method.
	 */
	protected async getBatteryInfo(forceRefresh: boolean): Promise<{batteryLevel: number | null, deviceName: string, productId: number, isCharging?: boolean} | null> {
		return await this.batteryService.getMouseBatteryInfo(forceRefresh);
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