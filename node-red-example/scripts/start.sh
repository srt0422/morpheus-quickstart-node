#!/bin/bash

# Exit on error
set -e

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Source the cloud config if it exists
if [ -f "${SCRIPT_DIR}/cloud/config.sh" ]; then
    source "${SCRIPT_DIR}/cloud/config.sh"
fi

# Build configuration
OPENAI_API_URL=${OPENAI_API_URL:-http://host.docker.internal:8080}
CONSUMER_URL=${CONSUMER_URL:-http://host.docker.internal:8081}
LOG_LEVEL=${LOG_LEVEL:-info}

# Create node_modules volume if it doesn't exist
VOLUME_NAME="nodered-example-modules"
if ! docker volume inspect ${VOLUME_NAME} >/dev/null 2>&1; then
    echo "Creating node_modules volume..."
    docker volume create ${VOLUME_NAME}
fi

# Build the image
BUILD_MODE=prod NODE_ENV=production "${SCRIPT_DIR}/scripts/build.sh"
IMAGE_NAME_PROD=${IMAGE_NAME:-srt0422/nodered-example}

echo "Starting production container..."
docker run -it --rm --init \
    -p 1880:1880 \
    -v "${SCRIPT_DIR}/flows.json:/usr/src/node-red/flows.json:delegated" \
    -v "${SCRIPT_DIR}/settings.js:/usr/src/node-red/settings.js:delegated" \
    -v "${SCRIPT_DIR}/lib:/usr/src/node-red/lib:delegated" \
    -v "${VOLUME_NAME}:/usr/src/node-red/node_modules" \
    -v "${SCRIPT_DIR}/../../UniversalBuilder:/usr/src/node-red/UniversalBuilder:delegated" \
    -e NODE_ENV=production \
    -e OPENAI_API_URL="${OPENAI_API_URL}" \
    -e CONSUMER_URL="${CONSUMER_URL}" \
    -e LOG_LEVEL="${LOG_LEVEL}" \
    --add-host=host.docker.internal:host-gateway \
    ${IMAGE_NAME_PROD} 