APP Router Readme 0.0.1

# Sample Morpheus Chat App Deployment Guide

## Overview
NOTE: For builder's kit instructions, please see the builder's kit README file at [builder's kit README](./node-red-example/README.md).

This is a sample app using Morpheus inference in a Next.js app hosted on Google Cloud.  The app consists of two parts: 
1. App proxy router that exists in a Docker container.
2. A front end that the user uses to send prompts and see responses from the App router

## Table of Contents
- [Overview](#overview)
- [Builder's Kit Instructions](#builders-kit-instructions)
- [Guide](#guide)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Navigate to the Repository Root Directory](#navigate-to-the-repository-root-directory)
  - [Configuration](#configuration)
- [Deployment](#deployment)
  - [Single Command Deployment](#single-command-deployment)
  - [Individual Service Deployment](#individual-service-deployment)
- [Service Architecture](#service-architecture)
- [Environment Variables](#environment-variables)
  - [NFA Proxy](#nfa-proxy)
  - [Consumer Node](#consumer-node)
  - [Chat Web App](#chat-web-app)
- [Monitoring & Logs](#monitoring--logs)
- [Cleanup](#cleanup)

You will need to set up the app router in order to open and close inference sessions on the Morpheus network.  There is a complete guide for this in the [Morpheus Marketplace Docs](https://github.com/Lumerin-protocol/Morpheus-Lumerin-Node/blob/dev/docs/00-overview.md)

For this particular demo we have installed the app router on a Google Cloud Run service to host Docker containers.

## Builder's Kit Instructions
- For step-by-step instructions for running the Builders' Kit project locally (requires Docker), please refer to the Builders' Kit Local Guide in the node-red-example directory: [Builders' Kit Local Guide](./node-red-example/README.md).

## Guide
Follow the steps below to deploy the App Router and configure the system for Morpheus inference.

1. Collect at least 10 MOR that will be used to pay for inference on the Morpheus network.  The address's secret key used for this demo will be potentially exposed so use a new address that you don't use for anything else besides this demo.

2. Make sure you have at least 0.001 ETH in your consumder node.  This is the minimum required gas to operate the system.

2. Set up your hosting so it can host the 3 Docker Containers required for this demo.  We are using Google Cloud.  You can use any cloud service the hosts docker containers. 

For the required environment variables see ./cloud/config.example.sh

3. The `./cloud/deploy-all.sh script basically deploys the 3 Docker containers to Google Cloud Run.  You can also deploy each container individually with the other scripts in the cloud directory.  If you're not using google cloud, you should be able to comment out the gcloud commands and replace them with the commands for your cloud service, or just use the docker commands to push your containers where you need them for your cloud service.

4. **Environment variables**

The following variables are used across the sample deployment:

- GCP Project
  - `PROJECT_ID` – GCP project ID
  - `REGION` – GCP region
  - `ZONE` – GCP zone
  - `DOCKER_REGISTRY` – Docker registry name

- API Configuration
  - `OPENAI_API_URL` – URL for the NFA Proxy
  - `CONSUMER_URL` – URL for Consumer Node

- Contract Configuration
  - `DIAMOND_CONTRACT_ADDRESS` – Address of the diamond contract
  - `WALLET_PRIVATE_KEY` – Private key for transactions

- Service Configuration
  - `INTERNAL_API_PORT` – Internal port for API container
  - `MARKETPLACE_PORT` – Consumer Node port
  - `SESSION_DURATION` – Session duration (e.g. "1h")

- Additional
  - `MARKETPLACE_BASE_URL` – Base URL for Marketplace
  - `MARKETPLACE_URL` – Public URL for Marketplace
  - `NFA_PROXY_URL` – Public URL for the NFA Proxy

- Versions
  - `NFA_PROXY_VERSION` – Tag for the proxy image
  - `CONSUMER_NODE_VERSION` – Tag for the consumer image

- Consumer Node - for more context see lumerin protocol docs (https://github.com/Lumerin-protocol/Morpheus-Lumerin-Node/blob/dev/docs/proxy-router.all.env)
  - `BLOCKCHAIN_WS_URL` – WebSocket endpoint for chain events
  - `BLOCKCHAIN_HTTP_URL` – HTTP endpoint for chain transactions
  - `LOG_LEVEL` – Logging detail (info/debug)
  - `LOG_FORMAT` – Log output format (text/json)
  - `PROVIDER_CACHE_TTL` – Cache TTL in seconds
  - `MAX_CONCURRENT_SESSIONS` – Max concurrency limit
  - `SESSION_TIMEOUT` – Timeout in seconds
  - `MOR_TOKEN_ADDRESS` – MOR token address
  - `EXPLORER_API_URL` – Blockchain explorer endpoint
  - `ETH_NODE_CHAIN_ID` – Ethereum chain ID
  - `ENVIRONMENT` – App environment (development/production)
  - `PROXY_ADDRESS` – Consumer Node's proxy bind address
  - `WEB_ADDRESS` – Consumer Node's web interface address
  - `WEB_PUBLIC_URL` – Consumer Node's public URL
  - `ETH_NODE_USE_SUBSCRIPTIONS` – Enable chain event subscriptions
  - `ETH_NODE_ADDRESS` – Ethereum RPC node URL
  - `ETH_NODE_LEGACY_TX` – True to enforce legacy transactions
  - `PROXY_STORE_CHAT_CONTEXT` – Activates chat context storage
  - `PROXY_STORAGE_PATH` – Storage path for data
  - `LOG_COLOR` – True to enable colored logs

## Getting Started

### Prerequisites
- Google Cloud Account
- Google Cloud SDK installed [Setup Instructions](https://cloud.google.com/sdk/docs/install-sdk?_gl=1*1eoawsq*_up*MQ..&gclid=CjwCAiA-Oi7BhA1EiwA2rIu2xra5EEWf_n6EB_rOgehhBNqqx53-B6nhCDvgzAhAiBAEqvEOv0kThoCyJYQAvD_BwE&gclsrc=aw.ds)
- **Google Cloud Run and necessary APIs enabled**
- **Logged in with `gcloud auth login`**
- Node.js >=16
- npm >=7
- Docker

### Clone the Repository
```bash
git clone https://github.com/srt0422/morpheus-quickstart-node.git
```

### Navigate to the Repository Root Directory
```bash
cd morpheus-quickstart-node
```

### Configuration

1. Copy the example environment file:
```bash
cp cloud/config.example.sh cloud/config.sh
```

2. Edit `cloud/config.sh` with your settings:   
  - Add your GCP project id (PROJECT_ID)
  - Add your wallet private key (WALLET_PRIVATE_KEY)
  - Add your password for the consumer node (CONSUMER_PASSWORD)
```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export ZONE="us-central1-a"
export DOCKER_REGISTRY="srt0422"  # Using Docker Hub registry instead of GCR

# Service Configuration
export NFA_PROXY_PORT="8080"
export CONSUMER_PORT="3333"
export WEBAPP_PORT="3000"

# Authentication Configuration
export CONSUMER_USERNAME="admin"  # Username for proxy and consumer node authentication
export CONSUMER_PASSWORD="your-secure-password"  # Password for proxy and consumer node authentication


# Wallet Configuration
export WALLET_PRIVATE_KEY="your-wallet-private-key"

# Contract Configuration
export DIAMOND_CONTRACT_ADDRESS="0xb8C55cD613af947E73E262F0d3C54b7211Af16CF"
```

### Deploy the example app
Deploy all services with:
```bash
./cloud/deploy-all.sh
## Docker Images
The deployment uses the following pre-built Docker Hub images:
- NFA Proxy: `srt0422/openai-morpheus-proxy:latest`
- Consumer Node: `srt0422/morpheus-marketplace-consumer:latest`

The Chat Web App is deployed directly from the source code to Google Cloud Run.

## Deployment

### Single Command Deployment
Deploy all services with:
```bash
./cloud/deploy-all.sh
```

### Individual Service Deployment
Deploy services separately:
```bash
# Deploy NFA Proxy
./cloud/deploy-proxy.sh

# Deploy Consumer Node
./cloud/deploy-consumer.sh

# Deploy Chat Web App
./cloud/deploy-webapp.sh
```

## Service Architecture

```
Chat Web App (Frontend)
       ↓
NFA Proxy (API Layer)
       ↓
Consumer Node (Morpheus Integration Layer)
```

## Environment Variables

### NFA Proxy
- `API_LISTEN_PORT`: Internal service port (default: 8080)

### Consumer Node
- `PROXY_URL`: URL of NFA Proxy service
- `PORT`: Service port (default: 3333)
- `WALLET_PRIVATE_KEY`: Your Ethereum wallet private key (required for blockchain interactions)
- `DIAMOND_CONTRACT_ADDRESS`: The deployed diamond contract address
- `BLOCKCHAIN_WS_URL`: Websocket URL for blockchain events
- `BLOCKCHAIN_HTTP_URL`: HTTP URL for blockchain transactions
- `LOG_LEVEL`: Logging level (default: info)
- `LOG_FORMAT`: Log format (text/json, default: text)
- `PROVIDER_CACHE_TTL`: Provider cache time-to-live in seconds (default: 60)
- `MAX_CONCURRENT_SESSIONS`: Maximum concurrent sessions (default: 100)
- `SESSION_TIMEOUT`: Session timeout in seconds (default: 3600)

### Chat Web App
- `OPENAI_API_URL`: URL of Consumer Node
- `PORT`: Web app port (default: 3000)

## Monitoring & Logs

View service logs:
```bash
gcloud logging tail "resource.type=cloud_run_revision"
```

## Cleanup

Remove all deployed services:
```bash
./cloud/cleanup.sh
```

## Changelog

### Version 1.0.0 (Released: February 7, 2025)
- Launched a highly engaging and user-friendly chat experience that demonstrates the inference capabilities of the Morpheus network.
- Delivered an intuitive interface designed to enhance developer engagement and drive increases in inference usage.
- Implemented robust security and reliability measures that foster trust and protect valuable customer data.
- Established a scalable foundation for Morpheus builders that opens doors for future innovations and continuous improvement.

### Version 1.0.1 (Released: February 21, 2025)
- Added Node-RED integration with pre-built flows for common tasks like batch processing and data transformation
- Added Google Cloud Run auto-scaling configuration and basic request logging
- Added new API endpoints for system status updates and notifications
- Added Node-RED custom node support for extending functionality with new drag-n-drop node-red node and custom deploymentflow (deploys the image https://hub.docker.com/repository/docker/srt0422/openai-morpheus-proxy/tags)
- Built and pushed the docker image to Docker Hub and Google Container Registry (https://hub.docker.com/repository/docker/srt0422/nodered-example/tags)

### Version 1.0.2 (Released: March 1, 2025)
- This update provides an Open AI api gateway to the morpheus network
- Created a custom node-red plugin for deploying the morpheus consumer node
- Added reasonable default configuration values to minimize setup requirements for builders
- Created a sample google cloud run deployment flow "Morpheus Deployment Flow" to replace "Deploy Proxy Flow"
- The consumer-node plugin now offers significant value to builders through:
  - Streamlined deployment with pre-configured settings
  - Reduced implementation time through sensible defaults and improved UI
  - Enhanced security through proper authentication configuration
  - Simplified integration with the proxy component via automated data flow
  - Accelerated time-to-market for Morpheus-powered applications

### Version 1.0.3 (Released: March 9, 2025)
- Implemented token generation functionality for secure API access
- Added token authentication proxy to enhance security and control access to the system
- Completed proxy integration with Morpheus node for seamless communication
- Enhanced overall system security through token-based authentication flow
- Improved developer experience with streamlined authentication processes
- Integrated staking mechanism for API access, allowing users to stake MOR tokens in exchange for access to the Morpheus API subnet.
- Added scripts for deploying builder's smart contracts to the Arbitrum Sepolia testnet, facilitating the creation and management of subnets.
- Developed an SDK for interacting with the builder's smart contracts, simplifying integration for developers.
- Implemented a user-friendly UI within the chat application, enabling users to stake tokens directly and manage their API access.


### Version 1.1.0 (Released: April 5, 2025)
- Integrated staking mechanism for API access, allowing users to stake MOR tokens in exchange for access to the Morpheus API subnet.
- Added scripts for deploying builder's smart contracts to the Arbitrum Sepolia testnet, facilitating the creation and management of subnets.
- Developed an SDK for interacting with the builder's smart contracts, simplifying integration for developers.
- Implemented a user-friendly UI within the chat application, enabling users to stake tokens directly and manage their API access.


