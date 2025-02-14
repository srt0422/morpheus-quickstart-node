#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/config.sh"

# Set image tag based on version if specified
IMAGE_TAG="${PROXY_ROUTER_VERSION:-latest}"
IMAGE_NAME="${DOCKER_REGISTRY}/proxy-router:${IMAGE_TAG}"

# Deploy Provider Node (Proxy Router)
echo "Deploying Proxy Router (Provider Node) version: ${IMAGE_TAG}..."
gcloud run deploy provider-node \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port=8082 \
  --set-env-vars "\
PROXY_ADDRESS=0.0.0.0:3333,\
WEB_ADDRESS=0.0.0.0:8082,\
WALLET_PRIVATE_KEY=${WALLET_PRIVATE_KEY},\
DIAMOND_CONTRACT_ADDRESS=${DIAMOND_CONTRACT_ADDRESS},\
MOR_TOKEN_ADDRESS=${MOR_TOKEN_ADDRESS},\
EXPLORER_API_URL=${EXPLORER_API_URL},\
ETH_NODE_CHAIN_ID=${ETH_NODE_CHAIN_ID},\
ENVIRONMENT=${ENVIRONMENT},\
PROXY_ADDRESS=${PROXY_ADDRESS},\
WEB_ADDRESS=${WEB_ADDRESS},\
WEB_PUBLIC_URL=http://provider-service:9000,\
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
SESSION_TIMEOUT=${SESSION_TIMEOUT:-3600}"

check_deployment "provider-node"

PROVIDER_URL=$(gcloud run services describe provider-node --format 'value(status.url)' --region $REGION)
export PROVIDER_URL

echo "Proxy Router URL: ${PROVIDER_URL}"

# Update config.sh with the correct PROVIDER_URL
sed -i.bak "s|^export PROVIDER_URL=.*|export PROVIDER_URL=\"${PROVIDER_URL}\"|" "${SCRIPT_DIR}/config.sh" && rm -f "${SCRIPT_DIR}/config.sh.bak"

echo "Updating provider-node with WEB_PUBLIC_URL=${PROVIDER_URL}..."
gcloud run services update provider-node \
    --region $REGION \
    --update-env-vars "WEB_PUBLIC_URL=${PROVIDER_URL}"

echo "Checking provider-node health via ${PROVIDER_URL}/healthcheck endpoint..."
if ! check_service_health "${PROVIDER_URL}/healthcheck"; then
    echo "Provider node health check failed"
    exit 1
fi

echo "Creating models-config.json in Cloud Storage..."
cat <<EOF > /tmp/models-config.json
{
  "models": [
    {
      "id": "${MODEL_ID}",
      "modelName": "${MODEL_NAME}",
      "apiType": "${MODEL_API_TYPE}",
      "apiURL": "${MODEL_API_URL}",
      "apiKey": "${MODEL_API_KEY}"
    }
  ]
}
EOF
gsutil cp /tmp/models-config.json gs://${MODELS_BUCKET}/
gsutil acl ch -u allUsers:R gs://${MODELS_BUCKET}/models-config.json