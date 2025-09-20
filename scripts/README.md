# Development Scripts

This directory contains development and testing scripts for the Razer Battery Monitor plugin.

## Scripts

### `razer-service.sh`
**Purpose**: Manual management of the privileged service for development/testing
- `./razer-service.sh start` - Start the privileged service manually  
- `./razer-service.sh stop` - Stop the privileged service
- `./razer-service.sh status` - Check if the service is running
- `./razer-service.sh test` - Test the service endpoints

## Usage

This script is primarily for development and testing purposes. The Stream Deck plugin automatically handles service startup, so end users typically won't need this script.

Use this for:
- **Development**: Manual testing of the privileged service
- **Debugging**: Checking service status and testing endpoints
- **Troubleshooting**: Manual service management if needed
