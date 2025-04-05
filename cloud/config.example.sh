#!/bin/bash

# GCP Project Configuration
export PROJECT_ID="your-project-id"
export REGION="us-west1"
export ZONE="us-west1-a"
export DOCKER_REGISTRY="docker.io/srt0422"  # Using Docker Hub registry instead of GCR
export IMAGE_VERSION="1.0.40"
export IMAGE_NAME="${DOCKER_REGISTRY}/nodered-example"

# API Configuration
export OPENAI_API_URL="" # Will be auto-populated during deployment with proxy URL
export CONSUMER_URL="localhost:8080" # Will be auto-populated during deployment with consumer URL
export MARKETPLACE_BASE_URL="${CONSUMER_URL}" # Uses consumer URL as base
export MARKETPLACE_URL="${MARKETPLACE_BASE_URL}" # Full URL for marketplace completions
export NFA_PROXY_URL="" # Will be auto-populated during deployment

# Contract Configuration
# DIAMOND_CONTRACT_ADDRESS TESTNET: 0xb8C55cD613af947E73E262F0d3C54b7211Af16CF, MAINNET: 0xDE819AaEE474626E3f34Ef0263373357e5a6C71b
export DIAMOND_CONTRACT_ADDRESS="0xb8C55cD613af947E73E262F0d3C54b7211Af16CF"
export WALLET_PRIVATE_KEY="your-wallet-key"

# Service Configuration 
export INTERNAL_API_PORT="8080"  # Internal reference only, Cloud Run will provide PORT
export MARKETPLACE_PORT="3333"
export SESSION_DURATION="1h"

# MOR_TOKEN_ADDRESS  TESTNET: 0x34a285a1b1c166420df5b6630132542923b5b27e, MAINNET: 0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86
export MOR_TOKEN_ADDRESS=0x34a285a1b1c166420df5b6630132542923b5b27e

# Authentication Configuration
export CONSUMER_USERNAME="admin"  # Username for proxy and consumer node authentication
export CONSUMER_PASSWORD="your-secure-password"  # Password for proxy and consumer node authentication

# Container Versions (optional - defaults to 'latest' if not set)
export NFA_PROXY_VERSION="v0.0.31"      # e.g. "v1.0.0" - for srt0422/openai-morpheus-proxy
export CONSUMER_NODE_VERSION="v0.0.16"  # e.g. "v1.0.0" - for srt0422/morpheus-marketplace-consumer
export VERSION="v1.0.22"

# Consumer Node Configuration
# mainnet wss://arb-mainnet.g.alchemy.com/v2/your-project-id
# testnet wss://arb-sepolia.g.alchemy.com/v2/your-project-id

export BLOCKCHAIN_WS_URL="" # "wss://arbitrum-mainnet.infura.io/ws/v3/your-project-id"
export BLOCKCHAIN_HTTP_URL="" # "https://arbitrum-mainnet.infura.io/v3/your-project-id" public testnet endpoint - https://sepolia-rollup.arbitrum.io/rpc
export LOG_LEVEL="info"
export LOG_FORMAT="text"
export PROVIDER_CACHE_TTL="60"
export MAX_CONCURRENT_SESSIONS="100"
export SESSION_TIMEOUT="3600"

# Node Configuration
# mainnet: https://api-mainnet.arbiscan.io/api #testnet: https://api-sepolia.arbiscan.io/api
export EXPLORER_API_URL="https://api-sepolia.arbiscan.io/api"
export ETH_NODE_ADDRESS="${BLOCKCHAIN_WS_URL:-${BLOCKCHAIN_HTTP_URL:-https://sepolia-rollup.arbitrum.io/rpc}}"
export ETH_NODE_LEGACY_TX="false"
export PROXY_STORE_CHAT_CONTEXT="true"
export PROXY_STORAGE_PATH="./data/"
export LOG_COLOR="true"
export ETH_NODE_USE_SUBSCRIPTIONS="false"
# mainnet: 42161, testnet: 421614
export ETH_NODE_CHAIN_ID="421614"
export ENVIRONMENT="development"

# Provider Model Configuration
export MODEL_ID="default-model"
# arbitrum sepolia testnet model
export MODEL_NAME=LMR-Hermes-3-Llama-3.1-8B
# mainnet arbitrum model 
# export MODEL_NAME="Llama 3.2 3B Instruct"
export MODEL_API_TYPE="openai"
export MODEL_API_URL="http://default-endpoint:8080"
export MODEL_API_KEY="default-key"
export MODELS_BUCKET="your-models-bucket"

# Function to ensure correct GCP context
ensure_gcp_context() {
    echo "Setting GCP context..."
    gcloud config set project $PROJECT_ID
    gcloud config set compute/region $REGION
    gcloud config set compute/zone $ZONE
}

# Function to check service health
check_service_health() {
    local service_url=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo "Checking service health (attempt $attempt/$max_attempts)..."
        if curl -s "${service_url}" | grep -iq 'healthy'; then
            echo "Service is healthy!"
            return 0
        fi
        echo "Service not healthy yet, waiting..."
        sleep 10
        ((attempt++))
    done
    
    echo "Service failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to check deployment status
check_deployment() {
    local service_name=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        status=$(gcloud run services describe $service_name \
            --region=$REGION \
            --format='value(status.conditions[0].status)' 2>/dev/null || echo "Unknown")
        
        if [ "$status" == "True" ]; then
            return 0
        fi
        
        echo "Waiting for $service_name deployment... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    return 1
}
