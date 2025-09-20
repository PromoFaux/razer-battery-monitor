/**
 * Razer device ID constants for wireless devices with battery support.
 * These IDs are extracted from the USB worker to avoid duplication.
 */

// Tested mouse devices (prioritize known working devices)
export const TESTED_WIRELESS_MICE = new Set([
	0x007A, // Viper Ultimate Dongle
	0x007B, // Viper Ultimate Wired (the one we've been testing)
	0x0078, // Viper Ultimate Wireless
]);

// Comprehensive wireless mouse list from OpenRazer
export const WIRELESS_MICE = new Set([
	...TESTED_WIRELESS_MICE,
	// Viper Series (wireless variants)
	0x009E, 0x009F, 0x00A5, 0x00A6, 0x00B8, 0x00C0, 0x00C1,
	// DeathAdder Series (wireless variants)  
	0x007C, 0x007D, 0x009C, 0x00B6, 0x00B7, 0x00C2, 0x00C3, 0x00C4, 0x00C5,
	// Basilisk Series (wireless variants)
	0x0083, 0x0086, 0x0088, 0x00AA, 0x00AB, 0x00B9, 0x00CC, 0x00CD,
	// Naga Series (wireless variants)
	0x008F, 0x0090, 0x00A7, 0x00A8, 0x00B4,
	// Cobra Series (wireless variants)
	0x00AF, 0x00B0,
	// Orochi & Pro Click Series
	0x0094, 0x0095, 0x0077, 0x0080, 0x009A,
	// Special devices
	0x00B3  // HyperPolling Wireless Dongle
]);

// Tested keyboard devices (prioritize known working devices)
export const TESTED_WIRELESS_KEYBOARDS = new Set([
	0x025C, // BlackWidow V3 Pro Wireless
]);

// Comprehensive wireless keyboard list from OpenRazer
export const WIRELESS_KEYBOARDS = new Set([
	...TESTED_WIRELESS_KEYBOARDS,
	// BlackWidow V3 Series (wireless variants)
	0x025A, // BlackWidow V3 Pro Wired
	0x0271, // BlackWidow V3 Mini Wireless
	// DeathStalker V2 Series (wireless variants)
	0x0290, // DeathStalker V2 Pro Wireless
	0x0292, // DeathStalker V2 Pro Wired
	0x0296, // DeathStalker V2 Pro TKL Wireless
	0x0298, // DeathStalker V2 Pro TKL Wired
]);