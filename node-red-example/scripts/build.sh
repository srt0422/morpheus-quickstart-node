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
DOCKERHUB_IMAGE_NAME=${DOCKERHUB_IMAGE_NAME:-srt0422/nodered-example}
GCR_IMAGE_NAME=${GCR_IMAGE_NAME:-gcr.io/test-quickstart-node/nodered-example}
BUILD_MODE=${BUILD_MODE:-prod}
SKIP_PUSH=${SKIP_PUSH:-false}
# Set platform and environment based on mode
if [ "$BUILD_MODE" = "prod" ]; then
    NODE_ENV=production
else
    NODE_ENV=development
fi
# Use the platform specified by the caller, default to the host platform
BUILD_PLATFORM=${BUILD_PLATFORM:-$(docker info --format '{{.Architecture}}')}
NO_CACHE=${NO_CACHE:-false}

# Create temporary build context
BUILD_CONTEXT=$(mktemp -d)
echo "Creating temporary build context at $BUILD_CONTEXT"
trap 'rm -rf "$BUILD_CONTEXT"' EXIT

# Copy UniversalBuilder from workspace root into lib directory FIRST
# NOTE: The UniversalBuilder folder at the workspace root (../../UniversalBuilder) is the source of truth.
# This is the main development folder that contains the latest version of the UniversalBuilder nodes.
echo "Copying UniversalBuilder from workspace root into lib directory..."
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
UNIVERSAL_BUILDER_SOURCE="${WORKSPACE_ROOT}/UniversalBuilder"

echo "Looking for UniversalBuilder at: ${UNIVERSAL_BUILDER_SOURCE}"

if [ ! -d "${UNIVERSAL_BUILDER_SOURCE}" ]; then
    echo "ERROR: UniversalBuilder directory not found at ${UNIVERSAL_BUILDER_SOURCE}"
    exit 1
fi

# Create lib directory and copy only the necessary UniversalBuilder files
mkdir -p "${BUILD_CONTEXT}/lib/UniversalBuilder"
# Copy the complete UniversalBuilder package (excluding unnecessary files)
rsync -av --exclude='node_modules' \
         --exclude='test' \
         --exclude='coverage' \
         --exclude='.nyc_output' \
         --exclude='data' \
         --exclude='docker' \
         --exclude='.nycrc' \
         --exclude='.npm-cache' \
         --exclude='project-structure.txt' \
         "${UNIVERSAL_BUILDER_SOURCE}/" \
         "${BUILD_CONTEXT}/lib/UniversalBuilder/"

echo "Successfully copied UniversalBuilder package to ${BUILD_CONTEXT}/lib/UniversalBuilder"

# Now copy the rest of the project files, excluding any UniversalBuilder directories and npm cache
echo "Copying remaining project files to build context..."
rsync -av --exclude='UniversalBuilder' \
         --exclude='.npm-cache' \
         --exclude='node_modules' \
         "${SCRIPT_DIR}/" "${BUILD_CONTEXT}/"

# Set the final image names based on mode
if [ "$BUILD_MODE" = "prod" ]; then
    FINAL_DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_NAME}:${IMAGE_TAG:-latest}"
    FINAL_GCR_IMAGE="${GCR_IMAGE_NAME}:${IMAGE_TAG:-latest}"
    FINAL_IMAGE_NAME=$FINAL_GCR_IMAGE  # Use GCR image as primary build target for production
else
    FINAL_DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE_NAME}-dev"
    FINAL_GCR_IMAGE="${GCR_IMAGE_NAME}-dev"
    FINAL_IMAGE_NAME=$FINAL_DOCKERHUB_IMAGE
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
docker buildx build ${BUILD_ARGS} --platform linux/amd64 --load -t ${FINAL_IMAGE_NAME} ${BUILD_CONTEXT} || {
    echo "ERROR: Docker build failed"
    exit 1
}

# Also tag with the Docker Hub name for local use
echo "Tagging for Docker Hub..."
docker tag ${FINAL_IMAGE_NAME} ${FINAL_DOCKERHUB_IMAGE}

# Push images if in production mode and SKIP_PUSH is not set to true
if [ "$BUILD_MODE" = "prod" ] && [ "$SKIP_PUSH" != "true" ]; then
    # Configure docker for GCR
    echo "Configuring docker for GCR..."
    gcloud auth configure-docker gcr.io --quiet

    # Push to GCR first
    echo "Pushing image to Google Container Registry..."
    docker push ${FINAL_GCR_IMAGE} || {
        echo "WARNING: Failed to push Docker image to GCR"
    }
    
    echo "Pushing image to Docker Hub..."
    docker push ${FINAL_DOCKERHUB_IMAGE} || {
        echo "WARNING: Failed to push Docker image to Docker Hub"
    }

    # If both pushes failed, exit with error
    if ! docker manifest inspect ${FINAL_GCR_IMAGE} >/dev/null 2>&1 && ! docker manifest inspect ${FINAL_DOCKERHUB_IMAGE} >/dev/null 2>&1; then
        echo "ERROR: Failed to push Docker image to both registries"
        exit 1
    fi
elif [ "$SKIP_PUSH" = "true" ]; then
    echo "Skipping image push to registries (SKIP_PUSH=true)"
fi

echo "Build completed successfully!"
echo "Docker Hub Image: ${FINAL_DOCKERHUB_IMAGE}"
echo "GCR Image: ${FINAL_GCR_IMAGE}" 