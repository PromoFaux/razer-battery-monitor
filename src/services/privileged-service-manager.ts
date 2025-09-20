import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import streamDeck from "@elgato/streamdeck";
import http from 'http';

/**
 * Manages the privileged service for macOS USB access
 */
export class PrivilegedServiceManager {
    private serviceProcess: ChildProcess | null = null;
    private readonly servicePath = join(process.cwd(), 'bin', 'privileged-service.cjs');
    private readonly servicePort = 3847;
    private isStarting = false;

    /**
     * Check if the privileged service is running
     */
    async isServiceRunning(): Promise<boolean> {
        return new Promise((resolve) => {
            const request = http.get(`http://localhost:${this.servicePort}/devices`, (response) => {
                response.on('data', () => {}); // consume response
                response.on('end', () => resolve(true));
            });
            
            request.on('error', () => resolve(false));
            request.setTimeout(1000, () => {
                request.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Start the privileged service if on macOS and not already running
     */
    async ensureServiceRunning(): Promise<boolean> {
        // Only on macOS
        if (process.platform !== 'darwin') {
            return false;
        }

        // Check if already running
        if (await this.isServiceRunning()) {
            return true;
        }

        // Prevent multiple simultaneous starts
        if (this.isStarting) {
            // Wait for current start attempt
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await this.isServiceRunning();
        }

        return await this.startService();
    }

    /**
     * Start the privileged service with user permission
     */
    private async startService(): Promise<boolean> {
        this.isStarting = true;

        try {
            streamDeck.logger.info('macOS USB access requires elevated privileges');
            streamDeck.logger.info('Attempting to start privileged service...');
            
            // Log debug info
            streamDeck.logger.debug(`Node executable: ${process.execPath}`);
            streamDeck.logger.debug(`Service path: ${this.servicePath}`);
            streamDeck.logger.debug(`Current working directory: ${process.cwd()}`);

            // Create a wrapper script that can be executed with sudo
            const fs = await import('fs');
            const startScript = join(process.cwd(), 'bin', 'start-privileged.sh');
            
            const scriptContent = `#!/bin/bash
echo "Starting Razer privileged service..." >> /tmp/razer-service.log
echo "Node path: ${process.execPath}" >> /tmp/razer-service.log
echo "Service path: ${this.servicePath}" >> /tmp/razer-service.log
echo "Working directory: ${process.cwd()}" >> /tmp/razer-service.log
echo "Timestamp: $(date)" >> /tmp/razer-service.log
cd "${process.cwd()}"
export RAZER_NODE_EXECUTABLE="${process.execPath}"
"${process.execPath}" "${this.servicePath}" >> /tmp/razer-service.log 2>&1 &
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

            await fs.promises.writeFile(startScript, scriptContent, { mode: 0o755 });

            // Use osascript to run the script with administrator privileges
            const appleScript = `do shell script "bash '${startScript}'" with administrator privileges`;

            streamDeck.logger.debug('Executing AppleScript:', appleScript);

            const osascript = spawn('osascript', ['-e', appleScript], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let scriptOutput = '';
            let scriptError = '';

            osascript.stdout?.on('data', (data) => {
                const output = data.toString();
                scriptOutput += output;
                streamDeck.logger.debug('osascript output:', output.trim());
            });

            osascript.stderr?.on('data', (data) => {
                const error = data.toString();
                scriptError += error;
                streamDeck.logger.debug('osascript error:', error.trim());
            });

            const exitCode = await new Promise<number>((resolve) => {
                osascript.on('exit', (code) => {
                    streamDeck.logger.debug(`osascript exited with code ${code}`);
                    resolve(code || 0);
                });
            });

            if (exitCode !== 0) {
                if (scriptError.includes('User canceled') || scriptError.includes('User cancelled')) {
                    streamDeck.logger.info('User cancelled privilege request');
                    streamDeck.logger.info('💡 Tip: Grant administrator access to enable Razer device battery monitoring');
                } else if (scriptError.includes('execution error')) {
                    streamDeck.logger.error('Execution error:', scriptError);
                } else {
                    streamDeck.logger.warn(`osascript failed with code ${exitCode}: ${scriptError || scriptOutput || 'Unknown error'}`);
                }
                return false;
            }

            // Give the service time to start
            streamDeck.logger.info('Waiting for service to start...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            const isRunning = await this.isServiceRunning();
            if (isRunning) {
                streamDeck.logger.info('✅ Privileged service started successfully');
            } else {
                streamDeck.logger.warn('⚠️ Service may not have started properly');
                // Check the log file for errors
                try {
                    const logContent = await fs.promises.readFile('/tmp/razer-service.log', 'utf-8');
                    streamDeck.logger.debug('Service log:', logContent);
                } catch (e) {
                    streamDeck.logger.debug('Could not read service log');
                }
            }

            return isRunning;

        } catch (error) {
            streamDeck.logger.error('Failed to start privileged service:', error);
            streamDeck.logger.info('💡 Alternative: You can start the service manually:');
            streamDeck.logger.info(`   sudo node "${this.servicePath}"`);
            return false;
        } finally {
            this.isStarting = false;
        }
    }

    /**
     * Show helpful instructions to the user
     */
    showUserInstructions(): void {
        streamDeck.logger.info('🔐 macOS USB Access Required');
        streamDeck.logger.info('');
        streamDeck.logger.info('Your Razer devices require elevated privileges to access battery information.');
        streamDeck.logger.info('');
        streamDeck.logger.info('Options:');
        streamDeck.logger.info('1. Grant administrator access when prompted by macOS');
        streamDeck.logger.info('2. Or manually start the service with:');
        streamDeck.logger.info(`   sudo node "${this.servicePath}"`);
        streamDeck.logger.info('');
        streamDeck.logger.info('This is required because macOS system drivers claim USB device interfaces.');
    }

    /**
     * Stop the privileged service
     */
    async stopService(): Promise<void> {
        if (this.serviceProcess) {
            this.serviceProcess.kill();
            this.serviceProcess = null;
        }
    }
}
