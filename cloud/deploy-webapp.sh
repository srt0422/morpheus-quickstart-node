#!/bin/bash

# Source configuration
source "$(dirname "$0")/config.sh"
ensure_gcp_context

# Define version
VERSION="${VERSION:-latest}"

# Check and setup Node.js version using package.json engines
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found"
    exit 1
fi

# Get or set Node.js version requirement
NODE_VERSION=$(node -p "try { require('./package.json').engines.node } catch(e) { 'not-set' }")
if [ "$NODE_VERSION" = "not-set" ]; then
    echo "Node.js version not specified in package.json, setting to >=18.0.0"
    # Update package.json with engines field
    node -e '
        const fs = require("fs");
        const package = JSON.parse(fs.readFileSync("package.json"));
        package.engines = package.engines || {};
        package.engines.node = ">=18.0.0";
        fs.writeFileSync("package.json", JSON.stringify(package, null, 2));
    '
    NODE_VERSION=">=18.0.0"
fi

# Ensure nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Get the highest compatible LTS version based on the engine requirement
echo "Finding highest compatible LTS version for requirement: $NODE_VERSION"
COMPATIBLE_VERSION=$(nvm ls-remote --lts | grep -E "v[0-9]+\.[0-9]+\.[0-9]+" | while read -r line; do
    version=$(echo "$line" | grep -Eo "v[0-9]+\.[0-9]+\.[0-9]+" | tr -d 'v')
    if node -e "process.exit(require('semver').satisfies('$version', '$NODE_VERSION') ? 0 : 1)" 2>/dev/null; then
        echo "$version"
    fi
done | tail -n1)

if [ -z "$COMPATIBLE_VERSION" ]; then
    echo "Error: No compatible LTS version found for requirement: $NODE_VERSION"
    exit 1
fi

echo "Installing Node.js version $COMPATIBLE_VERSION..."
nvm install "$COMPATIBLE_VERSION"
nvm use "$COMPATIBLE_VERSION"

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Build the Next.js application
echo "Building Next.js application..."
npm run build

# Build and push containers
echo "Building and pushing containers..."
IMAGE_NAME="gcr.io/$PROJECT_ID/chat-web-app:$VERSION"
DOCKER_HUB_IMAGE="$DOCKER_REGISTRY/chat-web-app:$VERSION"

# Create multi-platform builder if not exists
if ! docker buildx inspect chatbuilder > /dev/null 2>&1; then
  docker buildx create --name chatbuilder --driver docker-container --bootstrap
fi
docker buildx use chatbuilder

# Build and push to Docker Hub with buildx
docker buildx build --platform linux/amd64 \
  --push \
  -t "$DOCKER_HUB_IMAGE" .

# Deploy to Cloud Run
echo "Deploying Chat Web App to Cloud Run..."
if gcloud run deploy chat-web-app \
  --image "$DOCKER_HUB_IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "\
OPENAI_API_URL=${OPENAI_API_URL}/v1,\
CHAT_COMPLETIONS_PATH=${CHAT_COMPLETIONS_PATH},\
NEXT_PUBLIC_CHAT_COMPLETIONS_PATH=${CHAT_COMPLETIONS_PATH},\
MODEL_NAME=${MODEL_NAME}" \
  --project "$PROJECT_ID"; then
  echo "Docker Hub deployment succeeded."
else
  echo "Docker Hub deployment failed. Falling back to Google Cloud Registry..."
  gcloud builds submit --tag "$IMAGE_NAME"
  gcloud run deploy chat-web-app \
    --image "$IMAGE_NAME" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars "\
OPENAI_API_URL=${OPENAI_API_URL}/v1,\
CHAT_COMPLETIONS_PATH=${CHAT_COMPLETIONS_PATH},\
NEXT_PUBLIC_CHAT_COMPLETIONS_PATH=${CHAT_COMPLETIONS_PATH},\
MODEL_NAME=${MODEL_NAME}" \
    --project "$PROJECT_ID"
fi

# Get the deployed URL
SERVICE_URL=$(gcloud run services describe chat-web-app \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo "Deployment complete. Application URL: $SERVICE_URL"
