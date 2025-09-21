// Test script to verify the persistent worker functionality
const { fork } = require('child_process');
const path = require('path');

async function testPersistentWorker() {
    console.log('Testing persistent USB worker...');
    
    // Start the worker in persistent mode
    const workerPath = path.join(__dirname, 'com.promofaux.razer-battery-monitor.sdPlugin', 'bin', 'usb-worker.cjs');
    const worker = fork(workerPath, []);
    
    let messageId = 0;
    const pendingMessages = new Map();
    
    // Handle worker messages
    worker.on('message', (message) => {
        console.log('Received response:', message);
        const pending = pendingMessages.get(message.id);
        if (pending) {
            clearTimeout(pending.timeout);
            pendingMessages.delete(message.id);
            pending.resolve(message);
        }
    });
    
    // Function to send message and wait for response
    function sendMessage(command, args = []) {
        return new Promise((resolve, reject) => {
            const id = ++messageId;
            const timeout = setTimeout(() => {
                pendingMessages.delete(id);
                reject(new Error('Timeout'));
            }, 10000);
            
            pendingMessages.set(id, { resolve, reject, timeout });
            worker.send({ id, command, args });
        });
    }
    
    try {
        // Test getting device list
        console.log('\n1. Testing device list...');
        const deviceListResponse = await sendMessage('list');
        console.log('Device list result:', deviceListResponse.success ? 'SUCCESS' : 'FAILED');
        if (deviceListResponse.success && deviceListResponse.result && deviceListResponse.result.devices) {
            console.log(`Found ${deviceListResponse.result.devices.length} devices`);
        }
        
        // Test getting battery info
        console.log('\n2. Testing battery info...');
        const batteryResponse = await sendMessage('battery');
        console.log('Battery info result:', batteryResponse.success ? 'SUCCESS' : 'FAILED');
        if (batteryResponse.success && batteryResponse.result) {
            console.log('Battery info:', batteryResponse.result);
        }
        
        // Test multiple rapid requests
        console.log('\n3. Testing rapid requests...');
        const rapidRequests = [];
        for (let i = 0; i < 5; i++) {
            rapidRequests.push(sendMessage('list'));
        }
        
        const rapidResults = await Promise.all(rapidRequests);
        console.log(`Rapid requests: ${rapidResults.filter(r => r.success).length}/5 succeeded`);
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Clean up
        worker.kill('SIGTERM');
        setTimeout(() => {
            if (!worker.killed) {
                worker.kill('SIGKILL');
            }
            process.exit(0);
        }, 2000);
    }
}

testPersistentWorker().catch(console.error);