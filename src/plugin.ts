import streamDeck from "@elgato/streamdeck";

import { RazerMouseBattery } from "./actions/razer-mouse-battery";
import { RazerKeyboardBattery } from "./actions/razer-keyboard-battery";

// Register the device-specific battery actions.
streamDeck.actions.registerAction(new RazerMouseBattery());
streamDeck.actions.registerAction(new RazerKeyboardBattery());

// Finally, connect to the Stream Deck.
streamDeck.connect();
