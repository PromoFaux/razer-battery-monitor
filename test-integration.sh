#!/bin/bash

# Test script to verify the privileged service integration works

echo "🧪 Testing Privileged Service Integration"
echo "========================================"

cd "/Users/adam/repos/razer-battery-monitor/com.promofaux.razer-battery-monitor.sdPlugin"

echo ""
echo "1. Testing direct USB worker (should fail with access denied)..."
node bin/usb-worker.cjs list

echo ""
echo "2. Testing privileged service manual start..."
echo "   Starting service with sudo..."

# Start the service in background
sudo node bin/privileged-service.cjs > /tmp/razer-test.log 2>&1 &
SERVICE_PID=$!
echo "   Service started with PID: $SERVICE_PID"

# Wait for service to start
sleep 3

echo ""
echo "3. Testing service endpoints..."
echo "   GET /devices:"
curl -s http://localhost:3847/devices | jq '.' 2>/dev/null || curl -s http://localhost:3847/devices

echo ""
echo "   GET /battery:"
curl -s http://localhost:3847/battery | jq '.' 2>/dev/null || curl -s http://localhost:3847/battery

echo ""
echo "4. Cleaning up..."
sudo kill $SERVICE_PID 2>/dev/null || echo "   Service already stopped"

echo ""
echo "✅ Test complete!"
echo ""
echo "If the service endpoints returned JSON with device data, the integration is working!"
echo "The Stream Deck plugin will now automatically fall back to this service on macOS."
