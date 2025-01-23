#!/bin/bash

# Exit on error
set -e

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Source the cloud config if it exists
if [ -f "${SCRIPT_DIR}/cloud/config.sh" ]; then
    source "${SCRIPT_DIR}/cloud/config.sh"
fi

# Default configuration
IMAGE_NAME=${IMAGE_NAME:-srt0422/nodered-example}
BUILD_MODE=${BUILD_MODE:-prod}
# Set platform and environment based on mode
if [ "$BUILD_MODE" = "prod" ]; then
    NODE_ENV=production
else
    NODE_ENV=development
fi
# Use arm64 for both modes since we're on Apple Silicon
BUILD_PLATFORM=${BUILD_PLATFORM:-linux/arm64}
NO_CACHE=${NO_CACHE:-false}

# Create temporary build context
BUILD_CONTEXT=$(mktemp -d)
echo "Creating temporary build context at $BUILD_CONTEXT"
trap 'rm -rf "$BUILD_CONTEXT"' EXIT

# Copy required files to build context
echo "Copying files to build context..."
cp -r "${SCRIPT_DIR}/"* "$BUILD_CONTEXT/"

# Create UniversalBuilder directory and copy required files
echo "Copying UniversalBuilder from workspace root..."
mkdir -p "$BUILD_CONTEXT/UniversalBuilder"
cp -r "${SCRIPT_DIR}/../../UniversalBuilder/package.json" "$BUILD_CONTEXT/UniversalBuilder/"
cp -r "${SCRIPT_DIR}/../../UniversalBuilder/package-lock.json" "$BUILD_CONTEXT/UniversalBuilder/"
cp -r "${SCRIPT_DIR}/../../UniversalBuilder/nodes" "$BUILD_CONTEXT/UniversalBuilder/"

# Set the final image name based on mode
if [ "$BUILD_MODE" = "prod" ]; then
    FINAL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG:-latest}"
else
    FINAL_IMAGE_NAME="${IMAGE_NAME}-dev"
fi

echo "Building image: ${FINAL_IMAGE_NAME}"
echo "Build context: ${BUILD_CONTEXT}"
echo "Build platform: ${BUILD_PLATFORM}"
echo "Node environment: ${NODE_ENV}"

# Construct build arguments
BUILD_ARGS="--build-arg NODE_ENV=${NODE_ENV}"
if [ "$NO_CACHE" = "true" ]; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
fi

# Build the image
docker build ${BUILD_ARGS} --platform ${BUILD_PLATFORM} -t ${FINAL_IMAGE_NAME} ${BUILD_CONTEXT} || {
    echo "ERROR: Docker build failed"
    exit 1
}

# Push image if in production mode
if [ "$BUILD_MODE" = "prod" ]; then
    echo "Pushing image to Docker Hub..."
    docker push ${FINAL_IMAGE_NAME} || {
        echo "ERROR: Failed to push Docker image"
        exit 1
    }
fi

echo "Build completed successfully!"
echo "Image: ${FINAL_IMAGE_NAME}" 