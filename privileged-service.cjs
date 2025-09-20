#!/usr/bin/env node

// Privileged USB Service for macOS
// This service runs with elevated privileges and provides USB access via IPC

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3847; // RAZER on keypad
const USB_WORKER_PATH = path.join(__dirname, 'usb-worker.cjs');
// Use Stream Deck's Node.js if provided, otherwise fall back to current process
const NODE_EXECUTABLE = process.env.RAZER_NODE_EXECUTABLE || process.execPath;

console.log('🔐 Razer Battery Privileged Service starting...');
console.log(`📍 USB Worker: ${USB_WORKER_PATH}`);
console.log(`📍 Node Executable: ${NODE_EXECUTABLE}`);

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (url.pathname === '/devices') {
        // List available devices
        const worker = spawn(NODE_EXECUTABLE, [USB_WORKER_PATH, 'list'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let jsonOutput = '';
        
        worker.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            // Look for JSON output (last line typically)
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('{')) {
                    jsonOutput = line.trim();
                }
            }
        });
        
        worker.stderr.on('data', (data) => {
            console.error('Worker stderr:', data.toString());
        });
        
        worker.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json');
            if (code === 0 && jsonOutput) {
                res.writeHead(200);
                res.end(jsonOutput);
            } else {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to get devices', code, output }));
            }
        });
        
    } else if (url.pathname === '/battery') {
        // Get battery level
        const deviceId = url.searchParams.get('device');
        const args = [NODE_EXECUTABLE, USB_WORKER_PATH, 'battery'];
        if (deviceId) {
            args.push(deviceId);
        }
        
        const worker = spawn(args[0], args.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let jsonOutput = '';
        
        worker.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            // Look for JSON output
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('{') && line.includes('batteryLevel')) {
                    jsonOutput = line.trim();
                }
            }
        });
        
        worker.stderr.on('data', (data) => {
            console.error('Worker stderr:', data.toString());
        });
        
        worker.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json');
            if (code === 0 && jsonOutput) {
                res.writeHead(200);
                res.end(jsonOutput);
            } else {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to get battery', code, output }));
            }
        });
        
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, 'localhost', () => {
    console.log(`🚀 Privileged service listening on http://localhost:${PORT}`);
    console.log('📡 Endpoints:');
    console.log(`   GET /devices - List available Razer devices`);
    console.log(`   GET /battery?device=<id> - Get battery level`);
    console.log('');
    console.log('💡 Test with:');
    console.log(`   curl http://localhost:${PORT}/devices`);
    console.log(`   curl http://localhost:${PORT}/battery`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down privileged service...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down privileged service...');
    server.close(() => {
        process.exit(0);
    });
});
