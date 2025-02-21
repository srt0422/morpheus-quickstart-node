#!/bin/bash

# Exit on error
set -e

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
EXAMPLE_APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Default values for required environment variables
export PROJECT_ID=${PROJECT_ID:-"vireo-401203"}
export REGION=${REGION:-"us-central1"}
export NODE_ENV=${NODE_ENV:-"test"}
export SERVICE_NAME=${SERVICE_NAME:-"nodered-example"}

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "Google Cloud SDK is required but not installed. Aborting." >&2; exit 1; }

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not running. Please start Docker and try again."
    exit 1
fi

# Create test-specific Docker volume if it doesn't exist
VOLUME_NAME="nodered-example-test-modules"
if ! docker volume inspect ${VOLUME_NAME} >/dev/null 2>&1; then
    echo "Creating test-specific node_modules volume..."
    docker volume create ${VOLUME_NAME}
fi

# Check for cloud configuration
if [ ! -f "${EXAMPLE_APP_DIR}/cloud/config.sh" ]; then
    echo "Warning: cloud/config.sh not found at ${EXAMPLE_APP_DIR}/cloud/config.sh. Some tests may fail."
    echo "Please ensure you have the necessary cloud configuration."
else
    echo "Found cloud config at ${EXAMPLE_APP_DIR}/cloud/config.sh"
    source "${EXAMPLE_APP_DIR}/cloud/config.sh"
fi

# Check Google Cloud authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null 2>&1; then
    echo "No active Google Cloud account found. Please authenticate with:"
    echo "gcloud auth login"
    exit 1
fi

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "${SCRIPT_DIR}/node_modules" ] || [ "${SCRIPT_DIR}/package.json" -nt "${SCRIPT_DIR}/node_modules" ]; then
    echo "Installing dependencies..."
    cd "${SCRIPT_DIR}"
    npm install
fi

echo "Test environment setup complete!"
echo "Environment variables set:"
echo "  PROJECT_ID: ${PROJECT_ID}"
echo "  REGION: ${REGION}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  SERVICE_NAME: ${SERVICE_NAME}" 