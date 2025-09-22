// Modern ES module for USB communication
import { WebUSB } from 'usb';

// Razer product definitions with their transaction IDs (from OpenRazer + test.js)
const RAZER_VENDOR_ID = 0x1532;

// USB Worker device caching 
let cachedDevices: RazerDevice[] | null = null;
let deviceCacheTimestamp: number | null = null;
let deviceEnumerationPromise: Promise<RazerDevice[]> | null = null;
// No TTL - cache persists until explicitly invalidated (devices don't change often)// Device categories for better organization
const RAZER_MICE = {
	// Viper Series
	0x0078: { name: 'Razer Viper', transactionId: 0x3f, hasWireless: false },
	0x007A: { name: 'Razer Viper Ultimate (Wired)', transactionId: 0x3f, hasWireless: true },
	0x007B: { name: 'Razer Viper Ultimate (Wireless)', transactionId: 0x3f, hasWireless: true },
	0x008A: { name: 'Razer Viper Mini', transactionId: 0x1f, hasWireless: false },
	0x0091: { name: 'Razer Viper 8K', transactionId: 0x1f, hasWireless: false },
	0x009E: { name: 'Razer Viper Mini SE (Wired)', transactionId: 0x1f, hasWireless: true },
	0x009F: { name: 'Razer Viper Mini SE (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x00A5: { name: 'Razer Viper V2 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00A6: { name: 'Razer Viper V2 Pro (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x00B8: { name: 'Razer Viper V3 HyperSpeed', transactionId: 0x1f, hasWireless: true },
	0x00C0: { name: 'Razer Viper V3 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00C1: { name: 'Razer Viper V3 Pro (Wireless)', transactionId: 0x1f, hasWireless: true },

	// DeathAdder Series
	0x007C: { name: 'Razer DeathAdder V2 Pro (Wired)', transactionId: 0x3f, hasWireless: true },
	0x007D: { name: 'Razer DeathAdder V2 Pro (Wireless)', transactionId: 0x3f, hasWireless: true },
	0x0084: { name: 'Razer DeathAdder V2', transactionId: 0x1f, hasWireless: false },
	0x008C: { name: 'Razer DeathAdder V2 Mini', transactionId: 0x1f, hasWireless: false },
	0x0098: { name: 'Razer DeathAdder Essential (2021)', transactionId: 0x1f, hasWireless: false },
	0x009C: { name: 'Razer DeathAdder V2 X HyperSpeed', transactionId: 0x1f, hasWireless: true },
	0x00A1: { name: 'Razer DeathAdder V2 Lite', transactionId: 0x1f, hasWireless: false },
	0x00B2: { name: 'Razer DeathAdder V3', transactionId: 0x1f, hasWireless: false },
	0x00B6: { name: 'Razer DeathAdder V3 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00B7: { name: 'Razer DeathAdder V3 Pro (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x00C2: { name: 'Razer DeathAdder V3 Pro (Wired Alt)', transactionId: 0x1f, hasWireless: true },
	0x00C3: { name: 'Razer DeathAdder V3 Pro (Wireless Alt)', transactionId: 0x1f, hasWireless: true },
	0x00C4: { name: 'Razer DeathAdder V3 HyperSpeed (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00C5: { name: 'Razer DeathAdder V3 HyperSpeed (Wireless)', transactionId: 0x1f, hasWireless: true },

	// Basilisk Series
	0x0064: { name: 'Razer Basilisk', transactionId: 0x1f, hasWireless: false },
	0x0083: { name: 'Razer Basilisk X HyperSpeed', transactionId: 0x1f, hasWireless: true },
	0x0085: { name: 'Razer Basilisk V2', transactionId: 0x1f, hasWireless: false },
	0x0086: { name: 'Razer Basilisk Ultimate (Wired)', transactionId: 0x1f, hasWireless: true },
	0x0088: { name: 'Razer Basilisk Ultimate (Receiver)', transactionId: 0x1f, hasWireless: true },
	0x0099: { name: 'Razer Basilisk V3', transactionId: 0x1f, hasWireless: false },
	0x00AA: { name: 'Razer Basilisk V3 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00AB: { name: 'Razer Basilisk V3 Pro (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x00B9: { name: 'Razer Basilisk V3 X HyperSpeed', transactionId: 0x1f, hasWireless: true },
	0x00CB: { name: 'Razer Basilisk V3 35K', transactionId: 0x1f, hasWireless: false },
	0x00CC: { name: 'Razer Basilisk V3 Pro 35K (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00CD: { name: 'Razer Basilisk V3 Pro 35K (Wireless)', transactionId: 0x1f, hasWireless: true },

	// Naga Series
	0x008F: { name: 'Razer Naga Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x0090: { name: 'Razer Naga Pro (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x0096: { name: 'Razer Naga X', transactionId: 0x1f, hasWireless: false },
	0x00A7: { name: 'Razer Naga V2 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00A8: { name: 'Razer Naga V2 Pro (Wireless)', transactionId: 0x1f, hasWireless: true },
	0x00B4: { name: 'Razer Naga V2 HyperSpeed (Receiver)', transactionId: 0x1f, hasWireless: true },

	// Cobra Series
	0x00A3: { name: 'Razer Cobra', transactionId: 0x1f, hasWireless: false },
	0x00AF: { name: 'Razer Cobra Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x00B0: { name: 'Razer Cobra Pro (Wireless)', transactionId: 0x1f, hasWireless: true },

	// Orochi Series
	0x0094: { name: 'Razer Orochi V2 (Receiver)', transactionId: 0x1f, hasWireless: true },
	0x0095: { name: 'Razer Orochi V2 (Bluetooth)', transactionId: 0x1f, hasWireless: true },

	// Pro Click Series
	0x0077: { name: 'Razer Pro Click (Receiver)', transactionId: 0x1f, hasWireless: true },
	0x0080: { name: 'Razer Pro Click (Wired)', transactionId: 0x1f, hasWireless: true },
	0x009A: { name: 'Razer Pro Click Mini (Receiver)', transactionId: 0x1f, hasWireless: true },

	// Special/Other
	0x00A4: { name: 'Razer Mouse Dock Pro', transactionId: 0x1f, hasWireless: false },
	0x00B3: { name: 'Razer HyperPolling Wireless Dongle', transactionId: 0x1f, hasWireless: true },
} as const;

const RAZER_KEYBOARDS = {
	// BlackWidow V3 Series
	0x024E: { name: 'Razer BlackWidow V3', transactionId: 0x1f, hasWireless: false },
	0x025A: { name: 'Razer BlackWidow V3 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x025C: { name: 'Razer BlackWidow V3 Pro (Wireless)', transactionId: 0x9f, hasWireless: true },
	0x0258: { name: 'Razer BlackWidow V3 Mini', transactionId: 0x1f, hasWireless: false },
	0x0271: { name: 'Razer BlackWidow V3 Mini (Wireless)', transactionId: 0x9f, hasWireless: true },
	0x0A24: { name: 'Razer BlackWidow V3 TK', transactionId: 0x1f, hasWireless: false },

	// BlackWidow V4 Series
	0x0287: { name: 'Razer BlackWidow V4', transactionId: 0x1f, hasWireless: false },
	0x028D: { name: 'Razer BlackWidow V4 Pro', transactionId: 0x1f, hasWireless: false },
	0x0293: { name: 'Razer BlackWidow V4 X', transactionId: 0x1f, hasWireless: false },
	0x02A5: { name: 'Razer BlackWidow V4 75%', transactionId: 0x1f, hasWireless: false },

	// DeathStalker V2 Series
	0x0290: { name: 'Razer DeathStalker V2 Pro (Wireless)', transactionId: 0x9f, hasWireless: true },
	0x0292: { name: 'Razer DeathStalker V2 Pro (Wired)', transactionId: 0x1f, hasWireless: true },
	0x0295: { name: 'Razer DeathStalker V2', transactionId: 0x1f, hasWireless: false },
	0x0296: { name: 'Razer DeathStalker V2 Pro TKL (Wireless)', transactionId: 0x9f, hasWireless: true },
	0x0298: { name: 'Razer DeathStalker V2 Pro TKL (Wired)', transactionId: 0x1f, hasWireless: true },

	// Huntsman Series
	0x0226: { name: 'Razer Huntsman Elite', transactionId: 0x1f, hasWireless: false },
	0x0227: { name: 'Razer Huntsman', transactionId: 0x1f, hasWireless: false },
	0x0243: { name: 'Razer Huntsman Tournament Edition', transactionId: 0x1f, hasWireless: false },
	0x0257: { name: 'Razer Huntsman Mini', transactionId: 0x1f, hasWireless: false },
	0x0266: { name: 'Razer Huntsman V2 Analog', transactionId: 0x1f, hasWireless: false },
	0x026B: { name: 'Razer Huntsman V2 Tenkeyless', transactionId: 0x1f, hasWireless: false },
	0x026C: { name: 'Razer Huntsman V2', transactionId: 0x1f, hasWireless: false },
	0x0282: { name: 'Razer Huntsman Mini Analog', transactionId: 0x1f, hasWireless: false },
	0x02A6: { name: 'Razer Huntsman V3 Pro', transactionId: 0x1f, hasWireless: false },
	0x02A7: { name: 'Razer Huntsman V3 Pro TKL', transactionId: 0x1f, hasWireless: false },

	// Ornata Series
	0x021E: { name: 'Razer Ornata Chroma', transactionId: 0x1f, hasWireless: false },
	0x025D: { name: 'Razer Ornata V2', transactionId: 0x1f, hasWireless: false },
	0x02A1: { name: 'Razer Ornata V3', transactionId: 0x1f, hasWireless: false },
	0x02A3: { name: 'Razer Ornata V3 Tenkeyless', transactionId: 0x1f, hasWireless: false },
	0x0294: { name: 'Razer Ornata V3 X', transactionId: 0x1f, hasWireless: false },
} as const;

// Combine all devices for easier lookup
const RAZER_PRODUCTS = { ...RAZER_MICE, ...RAZER_KEYBOARDS } as const;

// Devices that have wireless/battery capability
const WIRELESS_DEVICES = new Set(
	Object.entries(RAZER_PRODUCTS)
		.filter(([id, info]) => info.hasWireless)
		.map(([id, info]) => parseInt(id))
);

// Type definitions
interface DeviceInfo {
	name: string;
	transactionId: number;
	hasWireless: boolean;
}

interface RazerDevice {
	device: any; // USB device object
	productId: number;
	deviceName: string;
	hasWireless: boolean;
	isKeyboard: boolean;
}

interface BatteryResult {
	batteryLevel: number | null;
	isCharging: boolean;
	deviceName: string;
	productId: number;
}

interface USBRequestParams {
	request: number;
	value: number;
	index: number;
}

interface Logger {
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
}

/**
 * Check if a device is a keyboard by checking if it's in the keyboards object
 */
function isKeyboardDevice(productId: number): boolean {
	return productId in RAZER_KEYBOARDS;
}

/**
 * Try to get battery level from keyboard using single-request approach with format detection
 * This is more power-efficient since keyboards use response format to indicate charging status
 */
async function getBatteryFromKeyboard(device: any, productId: number, logger?: Logger): Promise<BatteryResult | null> {
	const msg1 = `Querying keyboard battery for 0x${productId.toString(16)}`;
	if (logger) logger.info(`[USB Worker] ${msg1}`);
	console.log(msg1);
	
	const productInfo = RAZER_PRODUCTS[productId as keyof typeof RAZER_PRODUCTS];
	
	try {
		// Single request: Get battery level (command 0x80) - format tells us charging status
		const batteryReply = await sendRazerBatteryCommand(device, 0x80, {
			request: 0x09, // SET_REPORT
			value: 0x0300, // Report Type: Feature (3), Report ID: 0
			index: 2, // Interface 2 (control interface) for keyboards
		}, logger);
		
		if (batteryReply.data && batteryReply.data.byteLength >= 10) {
			const responseArray = new Uint8Array(batteryReply.data.buffer);
			const responseFormat = responseArray[0];
			const rawBattery = batteryReply.data.getUint8(9);
			
			const msg2 = `Response format: 0x${responseFormat.toString(16).padStart(2, '0')}, raw battery: ${rawBattery}`;
			if (logger) logger.info(`[USB Worker] ${msg2}`);
			console.log(msg2);
			
			// Check response format to detect charging state
			if (responseFormat === 0x04) {
				// 0x04 format = charging (battery level unreliable)
				const msg3 = `Keyboard is charging (0x04 response format detected)`;
				if (logger) logger.info(`[USB Worker] ${msg3}`);
				console.log(msg3);
				return {
					batteryLevel: null, // Battery percentage not reliable while charging
					isCharging: true,
					deviceName: productInfo.name,
					productId: productId
				};
			} else {
				// Normal response (0x02 format) = not charging, battery level is accurate
				const batteryLevel = (rawBattery / 255 * 100);
				const msg4 = `Keyboard battery: ${batteryLevel.toFixed(1)}%`;
				if (logger) logger.info(`[USB Worker] ${msg4}`);
				console.log(msg4);
				
				return {
					batteryLevel: parseFloat(batteryLevel.toFixed(1)),
					isCharging: false,
					deviceName: productInfo.name,
					productId: productId
				};
			}
		}

		const msg5 = `Invalid keyboard response`;
		if (logger) logger.warn(`[USB Worker] ${msg5}`);
		console.log(msg5);
		return null;

	} catch (error) {
		const msg = `Keyboard battery error: ${error}`;
		if (logger) logger.error(`[USB Worker] ${msg}`);
		console.log(msg);
		
		// Check if this is a USB device error that indicates device disconnection/mode switch
		if (error instanceof Error && error.message && (
			error.message.includes('LIBUSB_ERROR_NO_DEVICE') ||
			error.message.includes('LIBUSB_ERROR_NOT_FOUND') ||
			error.message.includes('open error')
		)) {
			// Re-throw with more specific error info for retry logic
			throw new USBDeviceError(error.message);
		}
		
		return null;
	}
}

/**
 * Invalidates the persistent device cache, forcing fresh enumeration on next request
 */
export function invalidateDeviceCache(): void {
	cachedDevices = null;
	deviceCacheTimestamp = null;
	deviceEnumerationPromise = null;
}

/**
 * Finds all Razer devices using WebUSB with simple caching and coordination
 */
async function getAllRazerDevices(logger?: Logger): Promise<RazerDevice[]> {
	// Check if we have cached devices - use them until explicitly invalidated
	if (cachedDevices && deviceCacheTimestamp) {
		const cacheAge = Date.now() - deviceCacheTimestamp;
		const msg = `Using cached devices (${cachedDevices.length} devices, cached for ${cacheAge}ms)`;
		if (logger) logger.info(`[USB Worker] ${msg}`);
		console.log(msg);
		return cachedDevices;
	}

	// Check if device enumeration is already in progress
	if (deviceEnumerationPromise) {
		const msg_waiting = 'Device enumeration already in progress, waiting...';
		if (logger) logger.info(`[USB Worker] ${msg_waiting}`);
		console.log(msg_waiting);
		const result = await deviceEnumerationPromise;
		
		// Cache the results persistently (until explicitly invalidated)
		cachedDevices = result;
		deviceCacheTimestamp = Date.now();
		const msg_cached = `Cached ${result.length} devices (until explicitly invalidated)`;
		if (logger) logger.info(`[USB Worker] ${msg_cached}`);
		console.log(msg_cached);
		return result;
	}

	// Start new enumeration
	deviceEnumerationPromise = performDeviceEnumeration(logger);
	
	try {
		const result = await deviceEnumerationPromise;
		
		// Cache the results persistently (until explicitly invalidated)
		cachedDevices = result;
		deviceCacheTimestamp = Date.now();
		const msg_cached = `Cached ${result.length} devices (until explicitly invalidated)`;
		if (logger) logger.info(`[USB Worker] ${msg_cached}`);
		console.log(msg_cached);
		return result;
	} finally {
		// Clear the promise when done (success or failure)
		deviceEnumerationPromise = null;
	}
}

/**
 * Performs the actual device enumeration with extended timeout and multiple discovery methods
 */
async function performDeviceEnumeration(logger?: Logger): Promise<RazerDevice[]> {
	try {
		const msg1 = 'Starting device enumeration...';
		if (logger) logger.info(`[USB Worker] ${msg1}`);
		console.log(msg1);
		// Log to Stream Deck as well
		if (typeof process !== 'undefined' && process.stdout) {
			process.stdout.write('Starting device enumeration...\n');
		}
		
		// Add startup delay for USB subsystem initialization (only on first run)
		if (!cachedDevices) {
			const msg_delay = 'First enumeration - waiting for USB subsystem initialization...';
			if (logger) logger.info(`[USB Worker] ${msg_delay}`);
			console.log(msg_delay);
			await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay for USB initialization
		}
		
		const customWebUSB = new WebUSB({
			allowAllDevices: true
		});
		
		// Try multiple discovery methods for maximum device detection
		let allDevices: any[] = [];
		
		// Method 1: Use getDevices() for comprehensive enumeration
		const msg_getting = 'Getting all USB devices...';
		if (logger) logger.info(`[USB Worker] ${msg_getting}`);
		console.log(msg_getting);
		
		try {
			const getDevicesResult = await customWebUSB.getDevices();
			allDevices = [...getDevicesResult];
			const msg_got = `getDevices() returned ${getDevicesResult.length} devices`;
			if (logger) logger.info(`[USB Worker] ${msg_got}`);
			console.log(msg_got);
		} catch (getError) {
			const msg_get_err = `getDevices() failed: ${getError}`;
			if (logger) logger.warn(`[USB Worker] ${msg_get_err}`);
			console.log(msg_get_err);
		}
		
		// Method 2: Also try requestDevice() for additional discovery
		const msg_requesting = 'Requesting additional devices from WebUSB...';
		if (logger) logger.info(`[USB Worker] ${msg_requesting}`);
		console.log(msg_requesting);
		
		try {
			const devicePromise = customWebUSB.requestDevice({
				filters: [{}]
			});

			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('WebUSB device enumeration timeout after 5 seconds')), 5000);
			});

			const deviceResult = await Promise.race([devicePromise, timeoutPromise]);
			
			// Convert single device or array to array
			const requestDevices = Array.isArray(deviceResult) ? deviceResult : (deviceResult ? [deviceResult] : []);
			
			const msg_req = `requestDevice() returned ${requestDevices.length} additional devices`;
			if (logger) logger.info(`[USB Worker] ${msg_req}`);
			console.log(msg_req);
			
			// Merge devices, avoiding duplicates by comparing vendorId + productId
			for (const newDevice of requestDevices) {
				const isDuplicate = allDevices.some(existing => 
					existing.vendorId === newDevice.vendorId && 
					existing.productId === newDevice.productId
				);
				if (!isDuplicate) {
					allDevices.push(newDevice);
				}
			}
		} catch (requestError) {
			const msg_req_err = `requestDevice() failed: ${requestError}`;
			if (logger) logger.warn(`[USB Worker] ${msg_req_err}`);
			console.log(msg_req_err);
		}
		
		let msg2 = `Combined discovery found ${allDevices.length} total USB devices`;
		if (logger) logger.info(`[USB Worker] ${msg2}`);
		console.log(msg2);
		
		// Add additional delay after getting devices to ensure all are fully enumerated
		if (allDevices.length > 0) {
			const msg_settling = 'Allowing device enumeration to settle...';
			if (logger) logger.info(`[USB Worker] ${msg_settling}`);
			console.log(msg_settling);
			await new Promise(resolve => setTimeout(resolve, 500)); // Additional settling time
		}
		
		const razerDevices: RazerDevice[] = [];
		
		for (const device of allDevices) {
			if (device.vendorId === RAZER_VENDOR_ID) {
				const productId = device.productId;
				const productInfo = RAZER_PRODUCTS[productId as keyof typeof RAZER_PRODUCTS];
				
				if (productInfo) {
					const msg3 = `Found ${productInfo.name} (0x${productId.toString(16)})`;
					if (logger) logger.info(`[USB Worker] ${msg3}`);
					console.log(msg3);
					razerDevices.push({
						device,
						productId,
						deviceName: productInfo.name,
						hasWireless: productInfo.hasWireless,
						isKeyboard: isKeyboardDevice(productId)
					});
				} else {
					const msg4 = `Found unknown Razer device with product ID 0x${productId.toString(16)}`;
					if (logger) logger.warn(`[USB Worker] ${msg4}`);
					console.log(msg4);
				}
			}
		}
		
		const msg5 = `Found ${razerDevices.length} Razer devices`;
		if (logger) logger.info(`[USB Worker] ${msg5}`);
		console.log(msg5);
		
		return razerDevices;
	} catch (error) {
		const msg = `Error enumerating devices: ${error}`;
		if (logger) logger.error(`[USB Worker] ${msg}`);
		console.error('performDeviceEnumeration: Error enumerating devices:', error);
		// Return empty array on error rather than throwing
		return [];
	}
}

/**
 * Creates a Razer USB request message with specified command
 * Based on OpenRazer's get_razer_report pattern - EXACTLY as in working original
 */
function createRazerRequest(device: any, command: number): Uint8Array {
	// Command structure: [0x00, transactionId, 0x00, 0x00, 0x00, dataSize, class, command]
	// Battery level: 0x80, Charging status: 0x84
	const productInfo = RAZER_PRODUCTS[device.productId as keyof typeof RAZER_PRODUCTS];
	const msg = new Uint8Array([0x00, productInfo.transactionId, 0x00, 0x00, 0x00, 0x02, 0x07, command]);
	let crc = 0;
	for (let i = 2; i < msg.length; i++) {
		crc = crc ^ msg[i];
	}
	// the next 80 bytes would be storing the data to be sent, but for getting the battery no data is sent
	const fullMsg = new Uint8Array(90); // Total length: 8 + 80 + 2
	fullMsg.set(msg, 0);
	// Zeros for the next 80 bytes (already zero initialized)
	
	// the last 2 bytes would be the crc and a zero byte
	fullMsg[88] = crc;
	fullMsg[89] = 0;
	return fullMsg;
}

/**
 * Sends a Razer command with optimized timing (based on OpenRGB patterns)
 */
async function sendRazerCommand(
	device: any,
	message: Uint8Array,
	transferParams: USBRequestParams,
	responseLength: number = 90,
	logger?: Logger
): Promise<any> {
	// Pre-send delay for communication stability (based on OpenRGB timing patterns)
	await new Promise(res => setTimeout(res, 2));

	// Send the command
	await device.controlTransferOut({
		requestType: 'class',
		recipient: 'interface',
		request: transferParams.request,
		value: transferParams.value,
		index: transferParams.index
	}, message);

	// Post-send delay before reading response
	await new Promise(res => setTimeout(res, 5));

	// Read the response
	const response = await device.controlTransferIn({
		requestType: 'class',
		recipient: 'interface',
		request: 0x01, // GET_REPORT
		value: transferParams.value,
		index: transferParams.index
	}, responseLength);

	return response;
}

/**
 * Creates and sends a Razer command in one step with optimized timing - matching original pattern
 */
async function sendRazerBatteryCommand(
	device: any,
	command: number,
	usbParams: USBRequestParams,
	logger?: Logger
): Promise<any> {
	// Open device following original pattern
	await device.open();
	if (device.configuration === null) {
		await device.selectConfiguration(1);
	}
	
	// Claim interface using original dynamic approach
	const interfaceNumber = device.configuration.interfaces[usbParams.index] ? 
		device.configuration.interfaces[usbParams.index].interfaceNumber : usbParams.index;
	await device.claimInterface(interfaceNumber);
	
	try {
		// Create the command using the original function
		const message = createRazerRequest(device, command);
		
		// Use the optimized send function with proper timing
		const response = await sendRazerCommand(device, message, usbParams, 90, logger);
		
		const msg2 = `USB command successful`;
		if (logger) logger.info(`[USB Worker] ${msg2}`);
		console.log(msg2);
		
		return response;
		
	} finally {
		// Close the device following original pattern: release interface then close
		try {
			await device.releaseInterface(interfaceNumber);
			await device.close();
		} catch (closeError) {
			const msg = `Error closing device: ${closeError}`;
			if (logger) logger.warn(`[USB Worker] ${msg}`);
			console.log(msg);
		}
	}
}

/**
 * Try to get battery level from mouse using dual-request approach
 * Mice require separate requests for battery level and charging status
 */
async function getBatteryFromMouse(device: any, productId: number, logger?: Logger): Promise<BatteryResult | null> {
	const msg1 = `Querying mouse battery for 0x${productId.toString(16)}`;
	if (logger) logger.info(`[USB Worker] ${msg1}`);
	console.log(msg1);
	
	const productInfo = RAZER_PRODUCTS[productId as keyof typeof RAZER_PRODUCTS];
	
	// All mice use interface 0 - no need to try alternatives based on logs showing interface 0 always works
	return await tryMouseBatteryWithInterface(device, productId, 0, logger);
}

/**
 * Try mouse battery commands with a specific USB interface
 */
async function tryMouseBatteryWithInterface(device: any, productId: number, interfaceIndex: number, logger?: Logger): Promise<BatteryResult | null> {
	const productInfo = RAZER_PRODUCTS[productId as keyof typeof RAZER_PRODUCTS];
	
	try {
		const msg1 = `Trying interface ${interfaceIndex} for battery command`;
		if (logger) logger.info(`[USB Worker] ${msg1}`);
		console.log(msg1);
		
		// First request: Get battery level (command 0x80)
		const batteryReply = await sendRazerBatteryCommand(device, 0x80, {
			request: 0x09, // SET_REPORT
			value: 0x0300, // Report Type: Feature (3), Report ID: 0
			index: interfaceIndex, // Try the specified interface
		}, logger);
		
		if (!batteryReply.data || batteryReply.data.byteLength < 10) {
			const msg = `Invalid mouse battery response on interface ${interfaceIndex}`;
			if (logger) logger.warn(`[USB Worker] ${msg}`);
			console.log(msg);
			return null;
		}
		
		// Debug: Log the raw response data
		const responseBytes = new Uint8Array(batteryReply.data.buffer);
		const hexString = Array.from(responseBytes.slice(0, 16)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
		const msg_debug = `Interface ${interfaceIndex} battery response: ${hexString}`;
		if (logger) logger.info(`[USB Worker] ${msg_debug}`);
		console.log(msg_debug);
		
		// Check if response indicates success (first byte should be 0x02 for success)
		const responseStatus = responseBytes[0];
		if (responseStatus !== 0x02) {
			const msg_status = `Interface ${interfaceIndex} returned error status: 0x${responseStatus.toString(16).padStart(2, '0')}`;
			if (logger) logger.warn(`[USB Worker] ${msg_status}`);
			console.log(msg_status);
			
			// For intermittent communication errors (0x01), try a quick retry
			if (responseStatus === 0x01) {
				const msg_retry = `Intermittent communication error (0x01), attempting quick retry...`;
				if (logger) logger.info(`[USB Worker] ${msg_retry}`);
				console.log(msg_retry);
				
				// Small delay before retry
				await new Promise(res => setTimeout(res, 50));
				
				try {
					// Retry the battery command
					const retryBatteryReply = await sendRazerBatteryCommand(device, 0x80, {
						request: 0x09,
						value: 0x0300,
						index: interfaceIndex,
					}, logger);
					
					if (retryBatteryReply.data && retryBatteryReply.data.byteLength >= 10) {
						const retryResponseBytes = new Uint8Array(retryBatteryReply.data.buffer);
						const retryResponseStatus = retryResponseBytes[0];
						
						if (retryResponseStatus === 0x02) {
							const msg_retry_success = `Retry successful with status: 0x${retryResponseStatus.toString(16).padStart(2, '0')}`;
							if (logger) logger.info(`[USB Worker] ${msg_retry_success}`);
							console.log(msg_retry_success);
							
							// Use the retry response instead
							const retryRawBattery = retryBatteryReply.data.getUint8(9);
							const retryBatteryLevel = (retryRawBattery / 255 * 100);
							const msg_retry_battery = `Interface ${interfaceIndex} retry mouse battery raw: ${retryRawBattery}, calculated: ${retryBatteryLevel.toFixed(1)}%`;
							if (logger) logger.info(`[USB Worker] ${msg_retry_battery}`);
							console.log(msg_retry_battery);
							
							// Continue with charging status using retry data
							const rawBattery = retryRawBattery;
							const batteryLevel = retryBatteryLevel;
							
							// Small delay between requests for better protocol adherence
							await new Promise(res => setTimeout(res, 1));
							
							// Second request: Get charging status (command 0x84) - continue with normal flow
							let isCharging = false;
							try {
								const chargingReply = await sendRazerBatteryCommand(device, 0x84, {
									request: 0x09,
									value: 0x0300,
									index: interfaceIndex,
								}, logger);
								
								if (chargingReply.data && chargingReply.data.byteLength >= 10) {
									const chargingBytes = new Uint8Array(chargingReply.data.buffer);
									const chargingHex = Array.from(chargingBytes.slice(0, 16)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
									const msg_debug2 = `Interface ${interfaceIndex} charging response: ${chargingHex}`;
									if (logger) logger.info(`[USB Worker] ${msg_debug2}`);
									console.log(msg_debug2);
									
									const chargingResponseStatus = chargingBytes[0];
									if (chargingResponseStatus === 0x02) {
										const chargingStatus = chargingReply.data.getUint8(9);
										isCharging = chargingStatus === 0x01;
										const msg3 = `Interface ${interfaceIndex} charging raw: ${chargingStatus}, status: ${isCharging ? 'charging' : 'not charging'}`;
										if (logger) logger.info(`[USB Worker] ${msg3}`);
										console.log(msg3);
									} else {
										const msg_charge_err = `Interface ${interfaceIndex} charging command failed with status: 0x${chargingResponseStatus.toString(16).padStart(2, '0')}`;
										if (logger) logger.warn(`[USB Worker] ${msg_charge_err}`);
										console.log(msg_charge_err);
									}
								}
							} catch (chargingError) {
								const msg = `Could not get charging status on interface ${interfaceIndex}: ${chargingError}`;
								if (logger) logger.warn(`[USB Worker] ${msg}`);
								console.log(msg);
							}
							
							return {
								batteryLevel: parseFloat(batteryLevel.toFixed(1)),
								isCharging,
								deviceName: productInfo.name,
								productId: productId
							};
						} else {
							const msg_retry_fail = `Retry also failed with status: 0x${retryResponseStatus.toString(16).padStart(2, '0')}`;
							if (logger) logger.warn(`[USB Worker] ${msg_retry_fail}`);
							console.log(msg_retry_fail);
						}
					}
				} catch (retryError) {
					const msg_retry_err = `Retry attempt failed: ${retryError}`;
					if (logger) logger.warn(`[USB Worker] ${msg_retry_err}`);
					console.log(msg_retry_err);
				}
			}
			
			// Special handling for Viper Ultimate wired mode - try to extract any useful data despite error status
			if (productId === 0x007A && responseStatus === 0x05) {
				const msg_special = `Viper Ultimate wired mode: Attempting to extract battery data despite error status`;
				if (logger) logger.info(`[USB Worker] ${msg_special}`);
				console.log(msg_special);
				
				// Check all possible battery positions in the response
				for (let pos = 8; pos < Math.min(responseBytes.length, 16); pos++) {
					const value = responseBytes[pos];
					if (value > 0) {
						const msg_found = `Found non-zero value at position ${pos}: ${value} (0x${value.toString(16).padStart(2, '0')})`;
						if (logger) logger.info(`[USB Worker] ${msg_found}`);
						console.log(msg_found);
						
						// Try interpreting as battery percentage
						let batteryLevel = 0;
						if (value <= 100) {
							// Direct percentage (0-100)
							batteryLevel = value;
						} else if (value <= 255) {
							// Scale from 0-255 to 0-100
							batteryLevel = (value / 255) * 100;
						}
						
						if (batteryLevel > 0) {
							const msg_battery = `Extracted battery level: ${batteryLevel.toFixed(1)}%`;
							if (logger) logger.info(`[USB Worker] ${msg_battery}`);
							console.log(msg_battery);
							
							// For wired mode, assume it's charging if plugged in
							return {
								batteryLevel: parseFloat(batteryLevel.toFixed(1)),
								isCharging: true, // Assume charging when plugged in
								deviceName: productInfo.name,
								productId: productId
							};
						}
					}
				}
				
				const msg_no_data = `No meaningful battery data found in error response`;
				if (logger) logger.warn(`[USB Worker] ${msg_no_data}`);
				console.log(msg_no_data);
			}
			
			return null;
		}
		
		const rawBattery = batteryReply.data.getUint8(9);
		const batteryLevel = (rawBattery / 255 * 100);
		const msg2 = `Interface ${interfaceIndex} mouse battery raw: ${rawBattery}, calculated: ${batteryLevel.toFixed(1)}%`;
		if (logger) logger.info(`[USB Worker] ${msg2}`);
		console.log(msg2);
		
		// Small delay between requests for better protocol adherence
		await new Promise(res => setTimeout(res, 1));
		
		// Second request: Get charging status (command 0x84)
		let isCharging = false;
		try {
			const chargingReply = await sendRazerBatteryCommand(device, 0x84, {
				request: 0x09, // SET_REPORT
				value: 0x0300, // Report Type: Feature (3), Report ID: 0
				index: interfaceIndex, // Use same interface
			}, logger);
			
			if (chargingReply.data && chargingReply.data.byteLength >= 10) {
				// Debug: Log the raw charging response data
				const chargingBytes = new Uint8Array(chargingReply.data.buffer);
				const chargingHex = Array.from(chargingBytes.slice(0, 16)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
				const msg_debug2 = `Interface ${interfaceIndex} charging response: ${chargingHex}`;
				if (logger) logger.info(`[USB Worker] ${msg_debug2}`);
				console.log(msg_debug2);
				
				const chargingResponseStatus = chargingBytes[0];
				if (chargingResponseStatus === 0x02) {
					const chargingStatus = chargingReply.data.getUint8(9);
					isCharging = chargingStatus === 0x01;
					const msg3 = `Interface ${interfaceIndex} charging raw: ${chargingStatus}, status: ${isCharging ? 'charging' : 'not charging'}`;
					if (logger) logger.info(`[USB Worker] ${msg3}`);
					console.log(msg3);
				} else {
					const msg_charge_err = `Interface ${interfaceIndex} charging command failed with status: 0x${chargingResponseStatus.toString(16).padStart(2, '0')}`;
					if (logger) logger.warn(`[USB Worker] ${msg_charge_err}`);
					console.log(msg_charge_err);
				}
			}
		} catch (chargingError) {
			const msg = `Could not get charging status on interface ${interfaceIndex}: ${chargingError}`;
			if (logger) logger.warn(`[USB Worker] ${msg}`);
			console.log(msg);
			// Continue with just battery level
		}
		
		return {
			batteryLevel: parseFloat(batteryLevel.toFixed(1)),
			isCharging,
			deviceName: productInfo.name,
			productId: productId
		};
		
	} catch (error) {
		const msg = `Interface ${interfaceIndex} mouse battery error: ${error}`;
		if (logger) logger.warn(`[USB Worker] ${msg}`);
		console.log(msg);
		
		// Check if this is a USB device error that indicates device disconnection/mode switch
		if (error instanceof Error && error.message && (
			error.message.includes('LIBUSB_ERROR_NO_DEVICE') ||
			error.message.includes('LIBUSB_ERROR_NOT_FOUND') ||
			error.message.includes('open error')
		)) {
			// Re-throw with more specific error info for retry logic
			throw new USBDeviceError(error.message);
		}
		
		return null;
	}
}

/**
 * Custom error class for USB device communication failures
 */
class USBDeviceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'USBDeviceError';
	}
}

/**
 * Get battery information from a specific device with retry logic for device mode switching
 */
async function getBatteryFromDevice(razerDevice: RazerDevice, logger?: Logger): Promise<BatteryResult | null> {
	if (!WIRELESS_DEVICES.has(razerDevice.productId)) {
		const msg = `Device ${razerDevice.deviceName} does not support wireless/battery`;
		if (logger) logger.warn(`[USB Worker] ${msg}`);
		console.log(msg);
		return null;
	}
	
	const msg = `Getting battery from ${razerDevice.deviceName}...`;
	if (logger) logger.info(`[USB Worker] ${msg}`);
	console.log(msg);
	
	try {
		if (razerDevice.isKeyboard) {
			return await getBatteryFromKeyboard(razerDevice.device, razerDevice.productId, logger);
		} else {
			return await getBatteryFromMouse(razerDevice.device, razerDevice.productId, logger);
		}
	} catch (error) {
		// Check if this is a USB device error (device disconnected, changed mode, etc.)
		if (error instanceof USBDeviceError) {
			const msg_retry = `Device communication failed (${error.message}), invalidating cache and retrying once...`;
			if (logger) logger.warn(`[USB Worker] ${msg_retry}`);
			console.log(msg_retry);
			
			// Invalidate cache to force fresh device enumeration
			invalidateDeviceCache();
			
			// Try to find the device again (might be in different mode now)
			const freshDevices = await getAllRazerDevices(logger);
			
			// Look for any wireless device of the same type (mouse/keyboard) 
			// since device might have switched from wired to wireless or vice versa
			const devicesByType = freshDevices.filter(device => 
				device.hasWireless && device.isKeyboard === razerDevice.isKeyboard
			);
			
			if (devicesByType.length > 0) {
				const freshDevice = devicesByType[0];
				const msg_retry2 = `Found fresh device: ${freshDevice.deviceName} (0x${freshDevice.productId.toString(16)})`;
				if (logger) logger.info(`[USB Worker] ${msg_retry2}`);
				console.log(msg_retry2);
				
				// Try once more with the fresh device
				if (freshDevice.isKeyboard) {
					return await getBatteryFromKeyboard(freshDevice.device, freshDevice.productId, logger);
				} else {
					return await getBatteryFromMouse(freshDevice.device, freshDevice.productId, logger);
				}
			} else {
				const msg_no_device = `No ${razerDevice.isKeyboard ? 'keyboard' : 'mouse'} devices found after retry`;
				if (logger) logger.warn(`[USB Worker] ${msg_no_device}`);
				console.log(msg_no_device);
				return null;
			}
		}
		
		// Re-throw non-USB errors
		throw error;
	}
}

/**
 * Gets the list of available Razer devices that support battery monitoring
 */
export async function getAvailableDevices(): Promise<{ devices: Array<{ productId: string; deviceName: string; hasWireless: boolean; isKeyboard: boolean }> }> {
	const razerDevices = await getAllRazerDevices();
	
	const devices = razerDevices
		.filter(device => device.hasWireless)
		.map(device => ({
			productId: device.productId.toString(16),
			deviceName: device.deviceName,
			hasWireless: device.hasWireless,
			isKeyboard: device.isKeyboard
		}));
	
	return { devices };
}

/**
 * Gets battery level for a specific device or the first available wireless device
 */
export async function getBatteryLevel(targetProductId?: number, logger?: Logger): Promise<BatteryResult | null> {
	let razerDevices = await getAllRazerDevices(logger);
	
	if (targetProductId) {
		// Find specific device with retry logic
		let targetDevice = razerDevices.find(device => device.productId === targetProductId);
		
		if (!targetDevice) {
			const msg = `Device with product ID 0x${targetProductId.toString(16)} not found`;
			if (logger) logger.warn(`[USB Worker] ${msg}`);
			console.log(msg);
			return null;
		}
		
		try {
			return await getBatteryFromDevice(targetDevice, logger);
		} catch (error) {
			// Check if this is a USB device error (device disconnected, changed mode, etc.)
			if (error instanceof USBDeviceError) {
				const msg_retry = `Device communication failed (${error.message}), invalidating cache and retrying once...`;
				if (logger) logger.warn(`[USB Worker] ${msg_retry}`);
				console.log(msg_retry);
				
				invalidateDeviceCache();
				
				// Try once more with fresh device enumeration
				razerDevices = await getAllRazerDevices(logger);
				targetDevice = razerDevices.find(device => device.productId === targetProductId);
				
				if (targetDevice) {
					return await getBatteryFromDevice(targetDevice, logger);
				}
			}
			// Re-throw the error to be handled by outer catch
			throw error;
		}
	} else {
		// Find first wireless device with retry for multiple devices
		let triedWithFreshCache = false;
		while (true) {
			const wirelessDevices = razerDevices.filter(device => device.hasWireless);
			if (wirelessDevices.length === 0) {
				const msg = 'No wireless devices found';
				if (logger) logger.warn(`[USB Worker] ${msg}`);
				console.log(msg);
				// Invalidate cache to force fresh enumeration
				invalidateDeviceCache();
				return null;
			}
			
			// Try each wireless device until one succeeds
			for (const device of wirelessDevices) {
				try {
					const result = await getBatteryFromDevice(device, logger);
					if (result) {
						const msg_success = `Successfully got battery from ${device.deviceName}`;
						if (logger) logger.info(`[USB Worker] ${msg_success}`);
						console.log(msg_success);
						return result;
					}
				} catch (error) {
					// Check if this is a USB device error (device disconnected, changed mode, etc.)
					if (!triedWithFreshCache && error instanceof USBDeviceError) {
						const msg_retry = `Device communication failed, invalidating device cache and retrying...`;
						if (logger) logger.warn(`[USB Worker] ${msg_retry}`);
						console.log(msg_retry);
						
						invalidateDeviceCache();
						razerDevices = await getAllRazerDevices(logger);
						triedWithFreshCache = true;
						break; // Break inner loop to retry with fresh devices
					}
					
					const msg_failed = `Device ${device.deviceName} failed: ${error instanceof Error ? error.message : String(error)}`;
					if (logger) logger.warn(`[USB Worker] ${msg_failed}`);
					console.log(msg_failed);
					continue;
				}
			}
			
			// If we get here and already tried with fresh cache, give up
			if (triedWithFreshCache) {
				const msg_no_success = 'No supported Razer devices found that support battery queries';
				if (logger) logger.warn(`[USB Worker] ${msg_no_success}`);
				console.log(msg_no_success);
				return null;
			}
			
			// If no devices succeeded and we haven't tried fresh cache yet, break and let outer logic handle
			break;
		}
		
		const msg_no_devices = 'No wireless devices responded successfully';
		if (logger) logger.warn(`[USB Worker] ${msg_no_devices}`);
		console.log(msg_no_devices);
		return null;
	}
}

/**
 * Gets battery level for mouse devices only
 */
export async function getMouseBatteryLevel(logger?: Logger): Promise<BatteryResult | null> {
	try {
		const msg1 = 'getMouseBatteryLevel: Starting...';
		if (logger) logger.info(`[USB Worker] ${msg1}`);
		console.log(msg1);
		
		let razerDevices = await getAllRazerDevices(logger);
		const msg2 = `getMouseBatteryLevel: Found ${razerDevices.length} total Razer devices`;
		if (logger) logger.info(`[USB Worker] ${msg2}`);
		console.log(msg2);
		
		let mouseDevices = razerDevices.filter(device => !device.isKeyboard && device.hasWireless);
		const msg3 = `getMouseBatteryLevel: Found ${mouseDevices.length} mouse devices with wireless`;
		if (logger) logger.info(`[USB Worker] ${msg3}`);
		console.log(msg3);
		
		if (mouseDevices.length === 0) {
			const msg4 = 'getMouseBatteryLevel: No mouse devices found, invalidating cache';
			if (logger) logger.warn(`[USB Worker] ${msg4}`);
			console.log(msg4);
			// Invalidate cache to force fresh enumeration
			invalidateDeviceCache();
			return null;
		}
		
		// Try each mouse device until one succeeds
		let triedWithFreshCache = false;
		for (let i = 0; i < mouseDevices.length; i++) {
			const device = mouseDevices[i];
			const msg5 = `getMouseBatteryLevel: Attempting to get battery from ${device.deviceName}`;
			if (logger) logger.info(`[USB Worker] ${msg5}`);
			console.log(msg5);
			
			try {
				const result = await getBatteryFromDevice(device, logger);
				if (result) {
					const msg6 = `Successfully got battery from ${device.deviceName}`;
					if (logger) logger.info(`[USB Worker] ${msg6}`);
					console.log(msg6);
					return result;
				}
			} catch (error) {
				// Check if this is a USB device error (device disconnected, changed mode, etc.)
				if (!triedWithFreshCache && error instanceof USBDeviceError) {
					const msg_retry = `Device communication failed, invalidating device cache and retrying...`;
					if (logger) logger.warn(`[USB Worker] ${msg_retry}`);
					console.log(msg_retry);
					
					invalidateDeviceCache();
					razerDevices = await getAllRazerDevices(logger);
					mouseDevices = razerDevices.filter(device => !device.isKeyboard && device.hasWireless);
					triedWithFreshCache = true;
					
					// Reset loop to try all devices again with fresh cache
					i = -1; // Will be incremented to 0 by for loop
					continue;
				}
				
				const msg_err = `Device ${device.deviceName} failed: ${error instanceof Error ? error.message : String(error)}`;
				if (logger) logger.warn(`[USB Worker] ${msg_err}`);
				console.log(msg_err);
				continue;
			}
		}
		
		const msg_no_success = 'getMouseBatteryLevel: No mouse devices responded successfully';
		if (logger) logger.warn(`[USB Worker] ${msg_no_success}`);
		console.log(msg_no_success);
		return null;
		
	} catch (error) {
		const msg = `getMouseBatteryLevel: Error: ${error}`;
		if (logger) logger.error(`[USB Worker] ${msg}`);
		console.error(msg);
		return null;
	}
}

/**
 * Gets battery level for keyboard devices only
 */
export async function getKeyboardBatteryLevel(logger?: Logger): Promise<BatteryResult | null> {
	try {
		const msg1 = 'getKeyboardBatteryLevel: Starting...';
		if (logger) logger.info(`[USB Worker] ${msg1}`);
		console.log(msg1);
		
		let razerDevices = await getAllRazerDevices(logger);
		const msg2 = `getKeyboardBatteryLevel: Found ${razerDevices.length} total Razer devices`;
		if (logger) logger.info(`[USB Worker] ${msg2}`);
		console.log(msg2);
		
		let keyboardDevices = razerDevices.filter(device => device.isKeyboard && device.hasWireless);
		const msg3 = `getKeyboardBatteryLevel: Found ${keyboardDevices.length} keyboard devices with wireless`;
		if (logger) logger.info(`[USB Worker] ${msg3}`);
		console.log(msg3);
		
		if (keyboardDevices.length === 0) {
			const msg4 = 'getKeyboardBatteryLevel: No keyboard devices found, invalidating cache';
			if (logger) logger.warn(`[USB Worker] ${msg4}`);
			console.log(msg4);
			// Invalidate cache to force fresh enumeration
			invalidateDeviceCache();
			return null;
		}
		
		// Try each keyboard device until one succeeds
		let triedWithFreshCache = false;
		for (let i = 0; i < keyboardDevices.length; i++) {
			const device = keyboardDevices[i];
			const msg5 = `getKeyboardBatteryLevel: Attempting to get battery from ${device.deviceName}`;
			if (logger) logger.info(`[USB Worker] ${msg5}`);
			console.log(msg5);
			
			try {
				const result = await getBatteryFromDevice(device, logger);
				if (result) {
					const msg6 = `Successfully got battery from ${device.deviceName}`;
					if (logger) logger.info(`[USB Worker] ${msg6}`);
					console.log(msg6);
					return result;
				}
			} catch (error) {
				// Check if this is a USB device error (device disconnected, changed mode, etc.)
				if (!triedWithFreshCache && error instanceof USBDeviceError) {
					const msg_retry = `Device communication failed, invalidating device cache and retrying...`;
					if (logger) logger.warn(`[USB Worker] ${msg_retry}`);
					console.log(msg_retry);
					
					invalidateDeviceCache();
					razerDevices = await getAllRazerDevices(logger);
					keyboardDevices = razerDevices.filter(device => device.isKeyboard && device.hasWireless);
					triedWithFreshCache = true;
					
					// Reset loop to try all devices again with fresh cache
					i = -1; // Will be incremented to 0 by for loop
					continue;
				}
				
				const msg_err = `Device ${device.deviceName} failed: ${error instanceof Error ? error.message : String(error)}`;
				if (logger) logger.warn(`[USB Worker] ${msg_err}`);
				console.log(msg_err);
				continue;
			}
		}
		
		const msg_no_success = 'getKeyboardBatteryLevel: No keyboard devices responded successfully';
		if (logger) logger.warn(`[USB Worker] ${msg_no_success}`);
		console.log(msg_no_success);
		return null;
		
	} catch (error) {
		const msg = `getKeyboardBatteryLevel: Error: ${error}`;
		if (logger) logger.error(`[USB Worker] ${msg}`);
		console.error(msg);
		return null;
	}
}