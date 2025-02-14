#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/config.sh"

##############################################
# Create Secret for the .cookie file         #
##############################################
# Ensure that both CONSUMER_USERNAME and CONSUMER_PASSWORD are set.
if [ -z "$CONSUMER_USERNAME" ] || [ -z "$CONSUMER_PASSWORD" ]; then
    echo "Error: Both CONSUMER_USERNAME and CONSUMER_PASSWORD must be set."
    exit 1
fi

# Generate the .cookie file content per documentation.
# Example: "admin:JJLRNze08ZN3vlNdgwgbrh6c4dRw9gQT"
COOKIE_CONTENT="${CONSUMER_USERNAME}:${CONSUMER_PASSWORD}"

# Create a temporary file with the cookie content.
TMP_COOKIE_FILE=$(mktemp)
echo "$COOKIE_CONTENT" > "$TMP_COOKIE_FILE"

echo "Ensuring Secret Manager is configured for the .cookie file..."
# Check if the secret named COOKIE_SECRET exists.
if ! gcloud secrets describe COOKIE_SECRET > /dev/null 2>&1; then
    echo "Secret COOKIE_SECRET does not exist. Creating it..."
    gcloud secrets create COOKIE_SECRET \
      --data-file="$TMP_COOKIE_FILE" \
      --replication-policy="automatic"
else
    echo "Secret COOKIE_SECRET exists. Adding a new version..."
    gcloud secrets versions add COOKIE_SECRET \
      --data-file="$TMP_COOKIE_FILE"
fi
echo "temp file: $TMP_COOKIE_FILE"
echo "cookie content: $(cat $TMP_COOKIE_FILE)"
echo "cookie secret: $(gcloud secrets versions access latest --secret=COOKIE_SECRET)"
# Clean up the temporary file.
# rm -f "$TMP_COOKIE_FILE"

##############################################
#           Deploy Consumer Node           #
##############################################
# Load NFA_PROXY_URL from temp file if it exists.
if [ -f "${SCRIPT_DIR}/.env.tmp" ]; then
    source "${SCRIPT_DIR}/.env.tmp"
fi

if [ -z "$NFA_PROXY_URL" ]; then
    echo "Error: NFA_PROXY_URL not set"
    echo "Make sure to run deploy-proxy.sh first"
    exit 1
fi

# Set image tag and image name.
IMAGE_TAG="$CONSUMER_NODE_VERSION"

IMAGE_NAME="gcr.io/${PROJECT_ID}/morpheus-lumerin-node:${IMAGE_TAG}"

# Pull the image from Docker Hub
echo "Pulling image ${DOCKER_REGISTRY}/morpheus-marketplace-consumer:${IMAGE_TAG}..."
docker pull ${DOCKER_REGISTRY}/morpheus-marketplace-consumer:${IMAGE_TAG}


# Tag the image for Google Container Registry
echo "Tagging image for GCR..."
docker tag ${DOCKER_REGISTRY}/morpheus-marketplace-consumer:${IMAGE_TAG} gcr.io/${PROJECT_ID}/morpheus-lumerin-node:${IMAGE_TAG}

# Push the image to Google Container Registry
echo "Pushing image to GCR... $IMAGE_NAME"
docker push $IMAGE_NAME

# Look up the current service account being used
CURRENT_SA=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
echo "Using service account: $CURRENT_SA"

# Update the IAM binding with the current service account
# Add "user:" prefix for user accounts
gcloud projects add-iam-policy-binding $PROJECT_ID --member="user:${CURRENT_SA}" --role="roles/secretmanager.secretAccessor"

# Deploy Consumer Node with the secret mounted as a .cookie file.
echo "Deploying Consumer Node version: ${IMAGE_NAME}..."
gcloud run deploy consumer-node \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port=8082 \
  --set-secrets="/secrets/.cookie=COOKIE_SECRET:latest" \
  --set-env-vars "\
PROXY_ADDRESS=0.0.0.0:3333,\
WEB_ADDRESS=0.0.0.0:8082,\
WALLET_PRIVATE_KEY=${WALLET_PRIVATE_KEY},\
DIAMOND_CONTRACT_ADDRESS=${DIAMOND_CONTRACT_ADDRESS},\
MOR_TOKEN_ADDRESS=${MOR_TOKEN_ADDRESS},\
EXPLORER_API_URL=${EXPLORER_API_URL},\
ETH_NODE_CHAIN_ID=${ETH_NODE_CHAIN_ID},\
ENVIRONMENT=${ENVIRONMENT},\
ETH_NODE_USE_SUBSCRIPTIONS=${ETH_NODE_USE_SUBSCRIPTIONS},\
ETH_NODE_ADDRESS=${ETH_NODE_ADDRESS},\
ETH_NODE_LEGACY_TX=${ETH_NODE_LEGACY_TX},\
PROXY_STORE_CHAT_CONTEXT=${PROXY_STORE_CHAT_CONTEXT},\
PROXY_STORAGE_PATH=${PROXY_STORAGE_PATH},\
LOG_COLOR=${LOG_COLOR},\
LOG_LEVEL=${LOG_LEVEL:-info},\
LOG_FORMAT=${LOG_FORMAT:-text},\
PROVIDER_CACHE_TTL=${PROVIDER_CACHE_TTL:-60},\
MAX_CONCURRENT_SESSIONS=${MAX_CONCURRENT_SESSIONS:-100},\
SESSION_TIMEOUT=${SESSION_TIMEOUT:-3600},\
CONSUMER_USERNAME=${CONSUMER_USERNAME},\
CONSUMER_PASSWORD=${CONSUMER_PASSWORD},\
BLOCKCHAIN_WS_URL=${BLOCKCHAIN_WS_URL},\
BLOCKCHAIN_HTTP_URL=${BLOCKCHAIN_HTTP_URL},\
BLOCKSCOUT_API_URL=${EXPLORER_API_URL},\
COOKIE_FILE_PATH=/secrets/.cookie,\
GO_ENV=production"

# Wait for deployment to complete.
check_deployment "consumer-node"

# Get the actual service URL after deployment.
CONSUMER_URL=$(gcloud run services describe consumer-node --format 'value(status.url)' --region "$REGION")
export CONSUMER_URL

# Update marketplace URLs for the nfa-proxy service.
gcloud run services update nfa-proxy \
    --region "$REGION" \
    --update-env-vars "MARKETPLACE_BASE_URL=${CONSUMER_URL},MARKETPLACE_URL=${CONSUMER_URL}"

# Update config.sh with the correct CONSUMER_URL using a backup.
sed -i.bak "s|^export CONSUMER_URL=.*|export CONSUMER_URL=\"${CONSUMER_URL}\"|" "${SCRIPT_DIR}/config.sh" && rm -f "${SCRIPT_DIR}/config.sh.bak"

echo "Consumer URL: ${CONSUMER_URL}"

echo "Updating consumer-node with WEB_PUBLIC_URL=${CONSUMER_URL}..."
gcloud run services update consumer-node \
    --region "$REGION" \
    --platform managed \
    --update-env-vars "MARKETPLACE_BASE_URL=${CONSUMER_URL},MARKETPLACE_URL=${MARKETPLACE_URL},WEB_PUBLIC_URL=${CONSUMER_URL}"

echo "Checking consumer-node health via ${CONSUMER_URL}/healthcheck endpoint..."
if ! check_service_health "${CONSUMER_URL}/healthcheck"; then
    echo "Consumer node health check failed"
    exit 1
fi