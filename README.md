# Razer Battery Stream Deck Plugin

This Stream Deck plugin displays the battery level of connected Razer mice or keyboards (at least, it should...) 

There are two distinct actions, one for mouse and one for keyboard, which display information about the first one they find that match the type. The thought behind this is that people probably only have one mouse and keyboard connected (Though I am sure I will be proven wrong...)

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
> A plugged in (charging) keyboard does not report it's battery percentage. This is known, and I couldn't find a way around this.

## Requirements

**Stream Deck Software**: 

- Stream Deck software version 6.5 or higher
- Razer device connected via USB
- Windows only? I honestly don't know. I'll try it on my Macbook Air and update this if it works...

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

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Troubleshooting

### No Device Found
- Ensure your Razer device is connected via USB
- Try unplugging and reconnecting the device
- Check that the device is recognized in Razer Synapse

---

