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
	 * NOTE: This base implementation should not be used - subclasses should override this method.
	 */
	   protected async updateBatteryDisplay(ev: WillAppearEvent<T> | KeyDownEvent<T>, forceRefresh: boolean = false): Promise<void> {
		   const deviceType = this.getDeviceType();
		   streamDeck.logger.error(`[   Service] ${deviceType}: Base updateBatteryDisplay called - this should be overridden by subclass`);
		   await ev.action.setTitle(`${this.getDisplayPrefix()}\nError`);
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