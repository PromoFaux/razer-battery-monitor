import streamDeck from "@elgato/streamdeck";

import { RazerMouseBattery } from "./actions/razer-mouse-battery";
import { RazerKeyboardBattery } from "./actions/razer-keyboard-battery";
import { sharedBatteryService } from "./actions/base-razer-battery-action";

// Register the device-specific battery actions.
streamDeck.actions.registerAction(new RazerMouseBattery());
streamDeck.actions.registerAction(new RazerKeyboardBattery());

// Handle graceful shutdown to clean up the persistent worker
const handleShutdown = async () => {
	streamDeck.logger.info('Plugin shutting down, cleaning up worker...');
	try {
		await sharedBatteryService.shutdown();
	} catch (error) {
		streamDeck.logger.error('Error during worker cleanup:', error);
	}
	process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
process.on('exit', handleShutdown);

// Finally, connect to the Stream Deck.
streamDeck.connect();
