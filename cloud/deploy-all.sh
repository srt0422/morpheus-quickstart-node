#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/config.sh"

# Deploy NFA Proxy and load its environment
echo "=== Deploying NFA Proxy ==="
source "${SCRIPT_DIR}/deploy-proxy.sh"

# Source the temporary environment file
if [ -f "${SCRIPT_DIR}/.env.tmp" ]; then
    source "${SCRIPT_DIR}/.env.tmp"
fi

if [ -z "$NFA_PROXY_URL" ]; then
    echo "Error: NFA Proxy URL not set after deployment"
    exit 1
fi

# Deploy Consumer Node
echo "=== Deploying Consumer Node ==="
source "${SCRIPT_DIR}/deploy-consumer.sh"
export CONSUMER_URL

# Update NFA Proxy configuration with consumer URL
echo "=== Updating NFA Proxy configuration ==="
gcloud run services update nfa-proxy \
  --platform managed \
  --region $REGION \
  --update-env-vars "MARKETPLACE_BASE_URL=${CONSUMER_URL},\
MARKETPLACE_URL=${CONSUMER_URL},\
CONSUMER_NODE_URL=${CONSUMER_URL}"

# Update consumer node with marketplace URL
gcloud run services update consumer-node \
  --region $REGION \
  --platform managed \
  --update-env-vars "MARKETPLACE_BASE_URL=${CONSUMER_URL},MARKETPLACE_URL=${MARKETPLACE_URL}"

# Deploy Web App
echo "=== Deploying Web App ==="
source "${SCRIPT_DIR}/deploy-webapp.sh"

echo "=== Deployment Complete ==="
echo "NFA Proxy: ${NFA_PROXY_URL}"
echo "Consumer: ${CONSUMER_URL}"
echo "Web App: ${WEBAPP_URL}"