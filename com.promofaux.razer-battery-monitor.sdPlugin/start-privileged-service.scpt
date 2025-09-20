#!/usr/bin/osascript

# macOS privileged service launcher script
# This script requests administrator privileges and starts the Razer battery service

on run
    try
        # Get the plugin directory
        set pluginPath to (path to me as string)
        set pluginDir to do shell script "dirname " & quoted form of POSIX path of pluginPath
        
        # Build the command to start the service
        set serviceCommand to "cd " & quoted form of pluginDir & " && node bin/privileged-service.cjs"
        
        # Request administrator privileges and run the service
        do shell script serviceCommand with administrator privileges
        
        return "Service started successfully"
    on error errorMessage
        return "Error starting service: " & errorMessage
    end try
end run
