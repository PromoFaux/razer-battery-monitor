#!/usr/bin/env node

// Test script to simulate Stream Deck plugin behavior
const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Simulating Stream Deck plugin privileged service start...');

const servicePath = path.join(process.cwd(), 'bin', 'privileged-service.cjs');
const startScript = path.join(process.cwd(), 'bin', 'test-start-privileged.sh');

console.log(`Node executable: ${process.execPath}`);
console.log(`Service path: ${servicePath}`);
console.log(`Current working directory: ${process.cwd()}`);

// Create the same script the plugin would create
const fs = require('fs');

const scriptContent = `#!/bin/bash
echo "Starting Razer privileged service..." >> /tmp/razer-service.log
echo "Node path: ${process.execPath}" >> /tmp/razer-service.log
echo "Service path: ${servicePath}" >> /tmp/razer-service.log
echo "Working directory: ${process.cwd()}" >> /tmp/razer-service.log
echo "Timestamp: $(date)" >> /tmp/razer-service.log
cd "${process.cwd()}"
"${process.execPath}" "${servicePath}" >> /tmp/razer-service.log 2>&1 &
SERVICE_PID=$!
echo "Service started with PID: $SERVICE_PID" >> /tmp/razer-service.log
echo "Service started with PID: $SERVICE_PID"
sleep 1
# Check if process is still running
if kill -0 $SERVICE_PID 2>/dev/null; then
    echo "Service is running successfully" >> /tmp/razer-service.log
    echo "Service is running successfully"
else
    echo "Service failed to start" >> /tmp/razer-service.log
    echo "Service failed to start"
fi
`;

fs.writeFileSync(startScript, scriptContent, { mode: 0o755 });

console.log('📝 Created startup script');

// Execute the script with osascript
const appleScript = `do shell script "bash '${startScript}'" with administrator privileges`;

console.log('🚀 Executing with osascript...');
console.log(`AppleScript: ${appleScript}`);

const osascript = spawn('osascript', ['-e', appleScript], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let scriptOutput = '';
let scriptError = '';

osascript.stdout?.on('data', (data) => {
    const output = data.toString();
    scriptOutput += output;
    console.log('osascript output:', output.trim());
});

osascript.stderr?.on('data', (data) => {
    const error = data.toString();
    scriptError += error;
    console.log('osascript error:', error.trim());
});

osascript.on('exit', (code) => {
    console.log(`osascript exited with code ${code}`);
    
    if (code === 0) {
        console.log('✅ Script executed successfully');
        
        // Wait and test the service
        setTimeout(async () => {
            const http = require('http');
            console.log('🔍 Testing service...');
            
            const request = http.get('http://localhost:3847/devices', (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('✅ Service is working!', result);
                    } catch (e) {
                        console.log('❌ Service returned invalid JSON:', data);
                    }
                    process.exit(0);
                });
            });
            
            request.on('error', (error) => {
                console.log('❌ Service is not responding:', error.message);
                console.log('📋 Check /tmp/razer-service.log for details');
                process.exit(1);
            });
            
            request.setTimeout(3000, () => {
                request.destroy();
                console.log('❌ Service timeout');
                process.exit(1);
            });
        }, 3000);
        
    } else {
        console.log('❌ Script failed');
        console.log('Output:', scriptOutput);
        console.log('Error:', scriptError);
        process.exit(1);
    }
});
