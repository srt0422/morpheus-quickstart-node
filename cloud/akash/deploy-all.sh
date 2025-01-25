#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/config.sh"

# Ensure Akash context is set
ensure_akash_context

# Process the deployment template with environment variables
echo "Processing deployment template..."
envsubst < "${SCRIPT_DIR}/deploy.yml" > "${SCRIPT_DIR}/deploy.processed.yml"

# Create deployment
echo "Creating deployment..."
DEPLOY_RESULT=$(akash tx deployment create "${SCRIPT_DIR}/deploy.processed.yml" \
    --from $AKASH_ACCOUNT_NAME \
    --chain-id $AKASH_CHAIN_ID \
    --node $AKASH_NODE \
    --fees 5000uakt \
    -y -o json)

# Extract DSEQ (deployment sequence number)
DSEQ=$(echo $DEPLOY_RESULT | jq -r '.logs[0].events[0].attributes[] | select(.key=="dseq").value')
echo "Deployment sequence (DSEQ): $DSEQ"

# Wait for provider bids
echo "Waiting for provider bids..."
sleep 30

# List providers
PROVIDERS=$(akash query market bid list --owner $AKASH_ACCOUNT_ADDRESS --dseq $DSEQ -o json)
PROVIDER=$(echo $PROVIDERS | jq -r '.bids[0].bid.provider')

if [ -z "$PROVIDER" ]; then
    echo "No provider bids received"
    exit 1
fi

# Create lease
echo "Creating lease with provider: $PROVIDER"
akash tx market lease create \
    --from $AKASH_ACCOUNT_NAME \
    --dseq $DSEQ \
    --provider $PROVIDER \
    --chain-id $AKASH_CHAIN_ID \
    --node $AKASH_NODE \
    --fees 5000uakt \
    -y

# Wait for deployment to be ready
echo "Waiting for deployment to be ready..."
wait_for_deployment $DSEQ

# Get service URLs
LEASE_STATUS=$(akash provider lease-status \
    --node $AKASH_NODE \
    --owner $AKASH_ACCOUNT_ADDRESS \
    --dseq $DSEQ \
    --provider $PROVIDER \
    -o json)

# Extract URLs
NFA_PROXY_URL=$(echo $LEASE_STATUS | jq -r '.services."nfa-proxy".uris[0]')
CONSUMER_URL=$(echo $LEASE_STATUS | jq -r '.services."consumer-node".uris[0]')

# Update config with service URLs
echo "Updating configuration with service URLs..."
sed -i.bak "s|^export NFA_PROXY_URL=.*|export NFA_PROXY_URL=\"${NFA_PROXY_URL}\"|" "${SCRIPT_DIR}/config.sh"
sed -i.bak "s|^export CONSUMER_URL=.*|export CONSUMER_URL=\"${CONSUMER_URL}\"|" "${SCRIPT_DIR}/config.sh"
sed -i.bak "s|^export OPENAI_API_URL=.*|export OPENAI_API_URL=\"${NFA_PROXY_URL}\"|" "${SCRIPT_DIR}/config.sh"

# Clean up backup files
rm -f "${SCRIPT_DIR}/config.sh.bak"

echo "=== Deployment Complete ==="
echo "NFA Proxy URL: ${NFA_PROXY_URL}"
echo "Consumer URL: ${CONSUMER_URL}"
echo ""
echo "To check deployment status:"
echo "akash provider lease-status --dseq $DSEQ --provider $PROVIDER"
echo ""
echo "To close deployment:"
echo "akash tx deployment close --dseq $DSEQ --from $AKASH_ACCOUNT_NAME" 