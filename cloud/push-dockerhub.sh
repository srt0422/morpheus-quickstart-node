#!/bin/bash

# Source configuration
source "$(dirname "$0")/config.sh"
ensure_gcp_context

# Define version if not provided
VERSION="${VERSION:-latest}"

# Check for package.json
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found"
    exit 1
fi

# Install dependencies and build the Next.js application
echo "Installing npm dependencies..."
npm install

echo "Building Next.js application..."
npm run build

# Build and push Docker image to Docker Hub
echo "Building and pushing Docker image to Docker Hub..."

# Set Docker Hub image name
DOCKER_HUB_IMAGE="$DOCKER_REGISTRY/chat-web-app:$VERSION"

# Create multi-platform builder if not exists
if ! docker buildx inspect chatbuilder > /dev/null 2>&1; then
  docker buildx create --name chatbuilder --driver docker-container --bootstrap
fi

docker buildx use chatbuilder

# Build and push image using buildx
docker buildx build --platform linux/amd64 \
  --push \
  -t "$DOCKER_HUB_IMAGE" . 