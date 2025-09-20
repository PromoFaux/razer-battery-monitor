#!/bin/bash

# Razer Battery Monitor - macOS Privileged Service Starter
# This script helps start the privileged service for USB access on macOS

SERVICE_PATH="$(dirname "$0")/privileged-service.cjs"
PID_FILE="/tmp/razer-battery-service.pid"

check_service() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Service is running
        else
            rm -f "$PID_FILE"
            return 1  # Service is not running
        fi
    else
        return 1  # PID file doesn't exist
    fi
}

start_service() {
    if check_service; then
        echo "✅ Privileged service is already running (PID: $(cat "$PID_FILE"))"
        return 0
    fi

    echo "🚀 Starting privileged service for Razer USB access..."
    
    # Check if we can run with sudo
    if ! sudo -n true 2>/dev/null; then
        echo "🔐 This service requires sudo privileges for USB access."
        echo "💡 You may be prompted for your password."
    fi
    
    # Start the service in the background
    sudo node "$SERVICE_PATH" > /tmp/razer-battery-service.log 2>&1 &
    local service_pid=$!
    
    # Wait a moment for the service to start
    sleep 2
    
    # Check if the service is actually running
    if ps -p "$service_pid" > /dev/null 2>&1; then
        echo "$service_pid" > "$PID_FILE"
        echo "✅ Privileged service started successfully (PID: $service_pid)"
        echo "📋 Log file: /tmp/razer-battery-service.log"
        echo "🌐 Service URL: http://localhost:3847"
        echo ""
        echo "🧪 Test with:"
        echo "   curl http://localhost:3847/devices"
        echo "   curl http://localhost:3847/battery"
        return 0
    else
        echo "❌ Failed to start privileged service"
        return 1
    fi
}

stop_service() {
    if check_service; then
        local pid=$(cat "$PID_FILE")
        echo "🛑 Stopping privileged service (PID: $pid)..."
        sudo kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        echo "✅ Service stopped"
    else
        echo "ℹ️  Service is not running"
    fi
}

case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        start_service
        ;;
    status)
        if check_service; then
            echo "✅ Privileged service is running (PID: $(cat "$PID_FILE"))"
            echo "🌐 Service URL: http://localhost:3847"
        else
            echo "❌ Privileged service is not running"
        fi
        ;;
    test)
        echo "🧪 Testing privileged service..."
        curl -s http://localhost:3847/devices | jq . || echo "Service not responding or jq not installed"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the privileged service"
        echo "  stop    - Stop the privileged service"
        echo "  restart - Restart the privileged service"
        echo "  status  - Check service status"
        echo "  test    - Test the service endpoints"
        exit 1
        ;;
esac
