#!/bin/bash

# Privileged Helper Installation Script for Razer Battery Monitor
# This creates a system service that can access USB devices without sudo

HELPER_DIR="/Library/PrivilegedHelperTools"
HELPER_NAME="com.promofaux.razer-battery-helper"
PLIST_PATH="/Library/LaunchDaemons/${HELPER_NAME}.plist"

echo "🔐 Installing privileged helper for Razer Battery Monitor"
echo "======================================================="

# Create the helper directory if it doesn't exist
sudo mkdir -p "$HELPER_DIR"

# Copy the USB worker to the privileged location
echo "📁 Copying USB worker to privileged location..."
sudo cp "com.promofaux.razer-battery-monitor.sdPlugin/bin/usb-worker.cjs" "$HELPER_DIR/"
sudo cp -r "com.promofaux.razer-battery-monitor.sdPlugin/bin/node_modules" "$HELPER_DIR/"

# Create the launch daemon plist
echo "📄 Creating launch daemon configuration..."
sudo tee "$PLIST_PATH" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$HELPER_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$HELPER_DIR/usb-worker.cjs</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>UserName</key>
    <string>root</string>
    <key>StandardOutPath</key>
    <string>/tmp/razer-battery-helper.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/razer-battery-helper.log</string>
</dict>
</plist>
EOF

# Set proper permissions
sudo chown root:wheel "$PLIST_PATH"
sudo chmod 644 "$PLIST_PATH"
sudo chown -R root:wheel "$HELPER_DIR"

# Load the launch daemon
echo "🚀 Loading launch daemon..."
sudo launchctl load "$PLIST_PATH"

echo "✅ Privileged helper installed successfully!"
echo ""
echo "📋 Helper location: $HELPER_DIR/usb-worker.cjs"
echo "📋 Log file: /tmp/razer-battery-helper.log"
echo ""
echo "🧪 Test the helper:"
echo "   sudo launchctl start $HELPER_NAME"
echo ""
echo "🗑️  To uninstall:"
echo "   sudo launchctl unload $PLIST_PATH"
echo "   sudo rm $PLIST_PATH"
echo "   sudo rm -rf $HELPER_DIR"
