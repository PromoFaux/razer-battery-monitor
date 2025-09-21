# Razer Battery Stream Deck Plugin

This Stream Deck plugin displays the battery level of connected Razer mice or keyboards (at least, it should...) 

There are two distinct actions, one for mouse and one for keyboard, which display information about the first device they find that matches the type. The thought behind this is that people probably only have one mouse and keyboard connected (Though I am sure I will be proven wrong...)

## Features

- **Razer Mouse/Keyboard Battery Actions**: Displays real-time battery percentage of supported Razer devices
- **Auto-refresh**: 30 seconds for mice, 5 minutes for keyboards
- **Charging Status**: Displays a ⚡ indicator when devices are charging
- **Manual Refresh**: Click buttons to instantly update battery levels

## Supported Devices

This plugin has been tested with the following Razer devices:

- **Razer BlackWidow V3 Pro Wireless**
- **Razer Viper Ultimate**

*other devices should work but I am unable to test them as these are the only two I have!*

No frills buttons (It's even using the image from the example counter app still!), but that might change

![working](https://github.com/user-attachments/assets/015e5238-8407-4030-9f64-a277fd256dc8)

> [!NOTE]  
> A plugged in (charging) keyboard does not report its battery percentage. This is a known hardware limitation.

> [!IMPORTANT]  
> **Synapse Compatibility**: This plugin works by communicating directly with Razer devices via USB HID protocols. Razer Synapse also communicates with these devices, creating conflicts when both try to access the hardware simultaneously. For best results, ensure Synapse is completely closed before using this plugin.

## Requirements

**Stream Deck Software**: 
- Stream Deck software version 6.5 or higher
- Razer mouse or keyboard with wireless capabilities
- **⚠️ IMPORTANT: Razer Synapse must NOT be running!** 
  - Synapse creates USB conflicts that prevent direct device communication
  - You can have Synapse installed, but make sure it's completely closed before using this plugin
  - Check your system tray and Task Manager to ensure no Synapse processes are running
- Windows (tested) - macOS compatibility unknown

## Known Issues & Limitations

- **Synapse Conflict**: This plugin communicates directly with Razer devices via USB. Having Synapse running simultaneously will cause conflicts and prevent the plugin from working.
- **Charging Detection**: Some keyboard models may not report battery percentage while charging/plugged in. This is a hardware limitation.
- **First Device Only**: Each action type (mouse/keyboard) shows the first matching device found. Multiple devices of the same type are not individually supported.

## Motivation

Having contributed the code, I had been using @BarRaider's [Battery](https://barraider.com/#:~:text=Download%20from%20Discord%5D-,Battery,-Shows%20live%20battery) plugin for some time. However, after a recent windows wipe I decided against installing Razer Synapse on the PC as it's bloaty and makes my other USB devices a bit glitchy.

This led to the first hurdle. The code I implemented in the aforementioned plugin cannot function without Synapse installed, as the core technology behind it involves scraping the log files. This works for the most part, though I've been caught out on a couple of occasions where the log format has been changed between versions.

In researching how to get the information out of the device without installing Synapse, I came accross an interesting project in **[RazerBatteryTaskbar](https://github.com/Tekk-Know/RazerBatteryTaskbar)**, which worked - but I want it on a stream deck damnit!

A couple of evenings arguing with Copilot (using a combination Claude Sonnet 4 and GPT-4.1) and here we are.

Of course, once I had a working POC I also tried to re-implement it in C# .NET so that it could be included in Bar's Battery plugin, but I hit a lot of brick walls - and I already have barely any idea what I'm doing when it comes to interacting with hardware like this. I could list the devices, just could never get any information out of them.

The only way, currently, to include this functionality in that plugin would be to effectively include this project as-is and call it from the C# code with node commands - which again feels hacky.


## Sources of Inspiration

- **[BarRaider's Battery Plugin](https://barraider.com/#:~:text=Download%20from%20Discord%5D-,Battery,-Shows%20live%20battery)** - If It wasn't for this plugin, I never would have looked at trying to do this in the first place

- **[RazerBatteryTaskbar](https://github.com/Tekk-Know/RazerBatteryTaskbar)** - A Windows taskbar application for monitoring Razer device battery levels. This project provided valuable insights into Razer device communication protocols and battery reporting methods.

- **[OpenRazer](https://github.com/openrazer/openrazer)** - An open source driver and user-space daemon for controlling Razer devices on Linux. This comprehensive project served as an invaluable reference for understanding Razer device USB communication, HID reports, and device identification.

Special thanks to the contributors of these projects for their research and documentation of Razer device protocols.

## Development

### Building
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run watch
```

### Performance Testing
The plugin includes comprehensive logging to monitor performance:
- USB enumeration timing
- Cache hit/miss rates  
- Battery query response times
- Worker process lifecycle events

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Troubleshooting

### Plugin Not Working
1. **Check Synapse**: Ensure Razer Synapse is completely closed
   - Close from system tray
   - Check Task Manager for any Razer processes
   - Restart Stream Deck software after closing Synapse

2. **USB Connection Issues**:
   - Unplug and reconnect your Razer device
   - Try a different USB port
   - Ensure the device is in wireless mode (not just charging)

3. **Logging**:
   - Check the plugin logs in: `%APPDATA%\Elgato\StreamDeck\Plugins\com.promofaux.razer-battery-monitor.sdPlugin\logs\`
   - Look for recent `.log` files for detailed error information

### No Device Found
- Ensure your Razer device is connected and recognized by Windows
- Verify the device model is supported (see Supported Devices section)
- Try restarting the plugin by toggling it off/on in Stream Deck settings

### Performance Issues
- The plugin uses intelligent caching - first load may be slow, subsequent updates should be near-instant
- If persistent issues occur, check the logs for USB enumeration errors

---



