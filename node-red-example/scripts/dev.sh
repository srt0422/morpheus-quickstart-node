#!/bin/bash

# Exit on error
set -e

# Parse arguments
RUN_CONTAINER=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --run) RUN_CONTAINER=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Clean up npm cache and temporary files
echo "Cleaning up npm cache and temporary files..."
npm cache clean --force
rm -rf "${SCRIPT_DIR}/temp"
rm -rf /var/folders/h3/h6xs192x79v5y5jlmd3_jw400000gp/T/tmp.*

# Create and use custom temp directory
CUSTOM_TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "${CUSTOM_TEMP_DIR}"
export TMPDIR="${CUSTOM_TEMP_DIR}"
trap 'rm -rf "${CUSTOM_TEMP_DIR}"' EXIT

# Check if nvm is installed
if [ ! -d "$HOME/.nvm" ]; then
    echo "nvm is not installed. Please install nvm first:"
    echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    exit 1
fi

# Clear npm prefix settings
unset npm_config_prefix
npm config delete prefix || true

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install and use Node.js 20 (LTS)
echo "Installing Node.js 20..."
nvm install 20
nvm use 20
echo "Now using Node.js $(node --version)"

# Source the cloud config if it exists
if [ -f "${SCRIPT_DIR}/cloud/config.sh" ]; then
    source "${SCRIPT_DIR}/cloud/config.sh"
fi

# Build configuration
OPENAI_API_URL=${OPENAI_API_URL:-http://host.docker.internal:8080}
CONSUMER_URL=${CONSUMER_URL:-http://host.docker.internal:8081}
LOG_LEVEL=${LOG_LEVEL:-debug}

# Create node_modules volume if it doesn't exist
VOLUME_NAME="nodered-example-modules"
if ! docker volume inspect ${VOLUME_NAME} >/dev/null 2>&1; then
    echo "Creating node_modules volume..."
    docker volume create ${VOLUME_NAME}
fi

# Build the development image
BUILD_MODE=dev NODE_ENV=development "${SCRIPT_DIR}/scripts/build.sh"
IMAGE_NAME_DEV=${IMAGE_NAME:-srt0422/nodered-example}-dev

if [ "$RUN_CONTAINER" = true ]; then
    echo "Starting development container..."
    docker run -it --rm --init \
        -p 1880:1880 \
        -v "${SCRIPT_DIR}/flows.json:/usr/src/node-red/flows.json:delegated" \
        -v "${SCRIPT_DIR}/settings.js:/usr/src/node-red/settings.js:delegated" \
        -v "${SCRIPT_DIR}/lib:/usr/src/node-red/lib:delegated" \
        -v "${SCRIPT_DIR}/nodemon.json:/usr/src/node-red/nodemon.json:delegated" \
        -v "${VOLUME_NAME}:/usr/src/node-red/node_modules" \
        -v "${SCRIPT_DIR}/../../UniversalBuilder:/usr/src/node-red/UniversalBuilder:delegated" \
        -e NODE_ENV=development \
        -e OPENAI_API_URL="${OPENAI_API_URL}" \
        -e CONSUMER_URL="${CONSUMER_URL}" \
        -e LOG_LEVEL="${LOG_LEVEL}" \
        --add-host=host.docker.internal:host-gateway \
        ${IMAGE_NAME_DEV}
else
    echo "Build complete. Use --run to start the container."
fi 