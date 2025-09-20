// CommonJS module for USB communication to work around ES module issues
const { WebUSB } = require('usb');

// Razer product definitions with their transaction IDs (from OpenRazer + test.js)
const RAZER_VENDOR_ID = 0x1532;

// Device categories for better organization
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
};

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
};

// Combine all devices for easier lookup
const RAZER_PRODUCTS = { ...RAZER_MICE, ...RAZER_KEYBOARDS };

// Devices that have wireless/battery capability
const WIRELESS_DEVICES = new Set(
	Object.entries(RAZER_PRODUCTS)
		.filter(([id, info]) => info.hasWireless)
		.map(([id, info]) => parseInt(id))
);

/**
 * Check if a device is a keyboard by checking if it's in the keyboards object
 */
function isKeyboardDevice(productId) {
	return productId in RAZER_KEYBOARDS;
}





/**
 * Try to get battery level from keyboard using single-request approach with format detection
 * This is more power-efficient since keyboards use response format to indicate charging status
 */
async function getBatteryFromKeyboard(device, productId) {
	console.log(`USB Worker: Querying keyboard battery for 0x${productId.toString(16)}`);
	const productInfo = RAZER_PRODUCTS[productId];
	
	try {
		// Single request: Get battery level (command 0x80) - format tells us charging status
		const batteryMsg = createRazerRequest(device, 0x80);
		
		const batteryRequest = await device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x09, // SET_REPORT
			value: 0x0300, // Report Type: Feature (3), Report ID: 0
			index: 2, // Interface 2 (control interface) for keyboards
		}, batteryMsg);
		
		await new Promise(res => setTimeout(res, 50)); // Reduced delay for faster response
		
		const batteryReply = await device.controlTransferIn({
			requestType: 'class',
			recipient: 'interface',
			request: 0x01, // GET_REPORT
			value: 0x0300, // Report Type: Feature (3), Report ID: 0
			index: 2, // Interface 2 (control interface) for keyboards
		}, 90);
		
		if (batteryReply.data && batteryReply.data.byteLength >= 10) {
			const responseArray = new Uint8Array(batteryReply.data.buffer);
			const responseFormat = responseArray[0];
			const rawBattery = batteryReply.data.getUint8(9);
			
			console.log(`USB Worker: Response format: 0x${responseFormat.toString(16).padStart(2, '0')}, raw battery: ${rawBattery}`);
			
			// Check response format to detect charging state
			if (responseFormat === 0x04) {
				// 0x04 format = charging (battery level unreliable)
				console.log(`USB Worker: Keyboard is charging (0x04 response format detected)`);
				return {
					batteryLevel: null, // Battery percentage not reliable while charging
					isCharging: true,
					deviceName: productInfo.name,
					productId: productId
				};
			} else {
				// Normal response (0x02 format) = not charging, battery level is accurate
				const batteryLevel = (rawBattery / 255 * 100);
				console.log(`USB Worker: Keyboard battery: ${batteryLevel.toFixed(1)}%`);
				
				return {
					batteryLevel: parseFloat(batteryLevel.toFixed(1)),
					isCharging: false,
					deviceName: productInfo.name,
					productId: productId
				};
			}
		}

		console.log(`USB Worker: Invalid keyboard response`);
		return null;

	} catch (error) {
		console.log(`USB Worker: Keyboard battery error: ${error}`);
		return null;
	}
}

/**
 * Finds all Razer devices using WebUSB
 */
async function getAllRazerDevices() {
	try {
		const customWebUSB = new WebUSB({
			// This function returns all supported Razer devices
			devicesFound: (devices) => {
				const razerDevices = devices.filter(device => 
					device.vendorId === RAZER_VENDOR_ID && 
					RAZER_PRODUCTS[device.productId] !== undefined
				);
				
				if (razerDevices.length > 0) {
					console.log(`USB Worker: Found ${razerDevices.length} supported Razer device(s)`);
				}

				return razerDevices;
			}
		});

		// Get all devices
		const devices = await customWebUSB.requestDevice({
			filters: [{}]
		});

		return Array.isArray(devices) ? devices : (devices ? [devices] : []);

	} catch (error) {
		console.error('USB Worker: Error finding devices:', error);
		return [];
	}
}

/**
 * Finds a specific Razer device by product ID
 */
async function getSpecificDevice(targetProductId) {
	try {
		const devices = await getAllRazerDevices();
		
		if (devices.length === 0) {
			throw new Error('No Razer devices found on system');
		}
		
		// Find the specific device
		const targetDevice = devices.find(device => device.productId === targetProductId);
		if (!targetDevice) {
			throw new Error(`Razer device with product ID 0x${targetProductId.toString(16)} not found`);
		}
		
		return targetDevice;

	} catch (error) {
		console.error('USB Worker: Error finding device:', error);
		return null;
	}
}

/**
 * Creates a Razer USB request message with specified command
 * Based on OpenRazer's get_razer_report pattern
 */
function createRazerRequest(mouse, command) {
	// Command structure: [0x00, transactionId, 0x00, 0x00, 0x00, dataSize, class, command]
	// Battery level: 0x80, Charging status: 0x84
	const productInfo = RAZER_PRODUCTS[mouse.productId];
	let msg = new Uint8Array([0x00, productInfo.transactionId, 0x00, 0x00, 0x00, 0x02, 0x07, command]);
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
 * Gets available Razer devices
 */
async function getAvailableDevices() {
	try {
		console.log('USB Worker: Looking for all Razer devices...');
		
		const devices = await getAllRazerDevices();
		
		if (devices.length === 0) {
			console.log('USB Worker: No supported Razer devices found');
			return [];
		}

		const deviceList = devices.map(device => {
			const productInfo = RAZER_PRODUCTS[device.productId];
			return {
				productId: device.productId,
				name: productInfo.name,
				id: `0x${device.productId.toString(16)}`
			};
		});

		console.log(`USB Worker: Found ${deviceList.length} supported Razer devices:`);
		deviceList.forEach(device => {
			console.log(`  - ${device.name} (${device.id})`);
		});

		return deviceList;

	} catch (error) {
		console.error('USB Worker: Error getting available devices:', error);
		return [];
	}
}

/**
 * Gets the real battery level using WebUSB for a specific device
 */
async function getBatteryLevel(targetProductId = null) {
	try {
		console.log(`USB Worker: Looking for Razer device${targetProductId ? ` with ID 0x${targetProductId.toString(16)}` : ''}...`);
		
		// If no specific device requested, try to find a working one
		if (!targetProductId) {
			const devices = await getAllRazerDevices();
			
			// Try each device to find one that supports battery queries
			for (const device of devices) {
				try {
					const result = await getBatteryFromDevice(device);
					if (result) {
						console.log(`USB Worker: Successfully got battery from ${RAZER_PRODUCTS[device.productId].name}`);
						return result;
					}
				} catch (error) {
					console.log(`USB Worker: Device ${RAZER_PRODUCTS[device.productId].name} failed: ${error.message}`);
					continue;
				}
			}
			
			console.log('USB Worker: No supported Razer devices found that support battery queries');
			return null;
		}
		
		// Get specific device
		const device = await getSpecificDevice(targetProductId);
		if (!device) {
			console.log('USB Worker: Specified Razer device not found');
			return null;
		}

		return await getBatteryFromDevice(device);

	} catch (error) {
		console.error('USB Worker: Error in getBatteryLevel:', error);
		return null;
	}
}

/**
 * Attempts to get battery from a specific device
 */
async function getBatteryFromDevice(device) {
	console.log(`USB Worker: Getting battery from device, product ID: 0x${device.productId.toString(16)}`);
	const productInfo = RAZER_PRODUCTS[device.productId];
	console.log(`USB Worker: Device: ${productInfo.name}`);

	// Check if this is a keyboard device that needs different transaction ID
	if (isKeyboardDevice(device.productId)) {
		console.log(`USB Worker: Detected keyboard device, using keyboard-specific transaction ID...`);
		
		// Open device for keyboard communication
		await device.open();
		if (device.configuration === null) {
			await device.selectConfiguration(1);
		}
		await device.claimInterface(2); // Interface 2 for control
		
		try {
			return await getBatteryFromKeyboard(device, device.productId);
		} finally {
			// Close the device properly
			try {
				await device.releaseInterface(2);
				await device.close();
			} catch (closeError) {
				console.error('USB Worker: Error closing keyboard device:', closeError);
			}
		}
	}

	// For non-keyboard devices, use dual-request approach (battery level + charging status)
	console.log(`USB Worker: Using dual-request approach for mouse/headset device...`);

	await device.open();
	if (device.configuration === null) {
		await device.selectConfiguration(1);
	}
	await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);

	try {
		// Request 1: Get battery level (command 0x80)
		const batteryMsg = createRazerRequest(device, 0x80);
		console.log('USB Worker: Sending battery level request (0x80)...');
		
		const batteryRequest = await device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x09,
			value: 0x300,
			index: 0x00
		}, batteryMsg);
		
		console.log(`USB Worker: Battery request result: ${batteryRequest.status}`);
		await new Promise(res => setTimeout(res, 200));
		
		const batteryReply = await device.controlTransferIn({
			requestType: 'class',
			recipient: 'interface',
			request: 0x01,
			value: 0x300,
			index: 0x00
		}, 90);
		
		console.log(`USB Worker: Battery reply status: ${batteryReply.status}, bytes: ${batteryReply.data?.byteLength}`);
		
		let batteryLevel = null;
		if (batteryReply.data && batteryReply.data.byteLength >= 10) {
			// Battery level is in byte 9 (0-255 scale)
			const rawBattery = batteryReply.data.getUint8(9);
			batteryLevel = parseFloat((rawBattery / 255 * 100).toFixed(1));
			console.log(`USB Worker: Battery level: ${batteryLevel}% (raw: ${rawBattery})`);
		}

		// Request 2: Get charging status (command 0x84)
		const chargingMsg = createRazerRequest(device, 0x84);
		console.log('USB Worker: Sending charging status request (0x84)...');
		
		const chargingRequest = await device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x09,
			value: 0x300,
			index: 0x00
		}, chargingMsg);
		
		console.log(`USB Worker: Charging request result: ${chargingRequest.status}`);
		await new Promise(res => setTimeout(res, 200));
		
		const chargingReply = await device.controlTransferIn({
			requestType: 'class',
			recipient: 'interface',
			request: 0x01,
			value: 0x300,
			index: 0x00
		}, 90);
		
		console.log(`USB Worker: Charging reply status: ${chargingReply.status}, bytes: ${chargingReply.data?.byteLength}`);
		
		let isCharging = false;
		if (chargingReply.data && chargingReply.data.byteLength >= 10) {
			// Charging status is in byte 9 (0 = not charging, 1 = charging)
			const chargingStatus = chargingReply.data.getUint8(9);
			isCharging = chargingStatus === 1;
			console.log(`USB Worker: Charging status: ${isCharging} (raw: ${chargingStatus})`);
		}

		return {
			batteryLevel: batteryLevel,
			isCharging: isCharging,
			deviceName: productInfo.name,
			productId: device.productId
		};

	} finally {
		// Close the USB device properly
		try {
			await device.releaseInterface(device.configuration.interfaces[0].interfaceNumber);
			await device.close();
		} catch (closeError) {
			console.error('USB Worker: Error closing device:', closeError);
		}
	}
}

module.exports = {
	getBatteryLevel,
	getAvailableDevices,
	RAZER_PRODUCTS
};

// If this file is run directly, execute based on command line arguments
if (require.main === module) {
	const args = process.argv.slice(2);
	const command = args[0];
	
	if (command === 'list') {
		console.log('USB Worker: Getting available devices...');
		
		getAvailableDevices()
			.then(devices => {
				console.log('USB Worker: getAvailableDevices returned:', devices);
				console.log(JSON.stringify({ devices }));
				setTimeout(() => process.exit(0), 100);
			})
			.catch(error => {
				console.error('USB Worker: Fatal error:', error);
				setTimeout(() => process.exit(1), 100);
			});
	} else if (command === 'mouse') {
		console.log('USB Worker: Starting mouse battery check...');
		
		// Find mouse devices and get battery from first available
		getAllRazerDevices()
			.then(async (devices) => {
				const mouseDevices = devices.filter(device => !isKeyboardDevice(device.productId));
				if (mouseDevices.length === 0) {
					console.log('USB Worker: No mouse devices found');
					setTimeout(() => process.exit(1), 100);
					return;
				}

				const result = await getBatteryFromDevice(mouseDevices[0]);
				console.log('USB Worker: getBatteryLevel returned:', result);
				if (result) {
					console.log(JSON.stringify(result));
					setTimeout(() => process.exit(0), 100);
				} else {
					console.log('USB Worker: No battery data available');
					setTimeout(() => process.exit(1), 100);
				}
			})
			.catch(error => {
				console.error('USB Worker: Fatal error:', error);
				setTimeout(() => process.exit(1), 100);
			});
	} else if (command === 'keyboard') {
		console.log('USB Worker: Starting keyboard battery check...');
		
		// Find keyboard devices and get battery from first available
		getAllRazerDevices()
			.then(async (devices) => {
				const keyboardDevices = devices.filter(device => isKeyboardDevice(device.productId));
				if (keyboardDevices.length === 0) {
					console.log('USB Worker: No keyboard devices found');
					setTimeout(() => process.exit(1), 100);
					return;
				}

				const result = await getBatteryFromDevice(keyboardDevices[0]);
				console.log('USB Worker: getBatteryLevel returned:', result);
				if (result) {
					console.log(JSON.stringify(result));
					setTimeout(() => process.exit(0), 100);
				} else {
					console.log('USB Worker: No battery data available');
					setTimeout(() => process.exit(1), 100);
				}
			})
			.catch(error => {
				console.error('USB Worker: Fatal error:', error);
				setTimeout(() => process.exit(1), 100);
			});
	} else if (command === 'battery') {
		const targetProductIdArg = args[1];
		const targetProductId = targetProductIdArg ? parseInt(targetProductIdArg, 16) : null;
		
		console.log(`USB Worker: Starting battery check${targetProductId ? ` for device 0x${targetProductId.toString(16)}` : ''}...`);
		
		getBatteryLevel(targetProductId)
			.then(result => {
				console.log('USB Worker: getBatteryLevel returned:', result);
				if (result) {
					console.log(JSON.stringify(result));
					setTimeout(() => process.exit(0), 100);
				} else {
					console.log('USB Worker: No battery data available');
					setTimeout(() => process.exit(1), 100);
				}
			})
			.catch(error => {
				console.error('USB Worker: Fatal error:', error);
				setTimeout(() => process.exit(1), 100);
			});
	} else {
		// Default behavior for backward compatibility
		console.log('USB Worker: Starting battery check...');
		
		getBatteryLevel()
			.then(result => {
				console.log('USB Worker: getBatteryLevel returned:', result);
				if (result) {
					console.log(JSON.stringify(result));
					setTimeout(() => process.exit(0), 100);
				} else {
					console.log('USB Worker: No battery data available');
					setTimeout(() => process.exit(1), 100);
				}
			})
			.catch(error => {
				console.error('USB Worker: Fatal error:', error);
				setTimeout(() => process.exit(1), 100);
			});
	}
}