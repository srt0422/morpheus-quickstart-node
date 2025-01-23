#!/bin/bash

# Exit on error
set -e

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source the config file
source "${SCRIPT_DIR}/config.sh"

# Function to check and install dependencies
check_dependencies() {
    echo "Checking required dependencies..."
    
    # Check for brew (needed for gcloud installation on macOS)
    if ! command -v brew &> /dev/null; then
        echo "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    # Check for gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        echo "Installing Google Cloud SDK..."
        brew install --cask google-cloud-sdk
        
        # Initialize gcloud
        echo "Initializing gcloud..."
        gcloud init
    else
        echo "gcloud CLI is already installed"
    fi

    # Check for docker
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        brew install --cask docker
    fi
}

# Run dependency check
check_dependencies

# Check and install required Node.js version
REQUIRED_NODE_VERSION="20.18.1"  # Specify the version needed
echo "Checking Node.js version..."

# Function to compare versions
version_compare() {
    if [[ $1 == $2 ]]; then return 0; fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do ver1[i]=0; done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then ver2[i]=0; fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then return 1; fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then return 2; fi
    done
    return 0
}

# Check if nvm is installed
if ! command -v nvm &> /dev/null; then
    echo "nvm not found. Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Check current Node.js version
if command -v node &> /dev/null; then
    CURRENT_VERSION=$(node -v | cut -d 'v' -f 2)
    version_compare "$CURRENT_VERSION" "$REQUIRED_NODE_VERSION"
    VERSION_CHECK=$?
    if [ $VERSION_CHECK -eq 0 ]; then
        echo "Required Node.js version $REQUIRED_NODE_VERSION is already installed"
    else
        echo "Installing Node.js version $REQUIRED_NODE_VERSION..."
        nvm install $REQUIRED_NODE_VERSION
        nvm use $REQUIRED_NODE_VERSION
    fi
else
    echo "Node.js not found. Installing version $REQUIRED_NODE_VERSION..."
    nvm install $REQUIRED_NODE_VERSION
    nvm use $REQUIRED_NODE_VERSION
fi

# Verify environment variables
echo "Verifying environment variables..."
PROJECT_ID=${PROJECT_ID:-vireo-401203}
REGION=${REGION:-us-central1}
IMAGE_VERSION=${IMAGE_VERSION:-1.0.39}
IMAGE_TAG="v${IMAGE_VERSION}"

# Ensure we're using the correct GCP project
echo "Configuring GCP project..."

# Check gcloud auth status
if ! gcloud auth list --filter=status:ACTIVE --format="get(account)" | grep -q "@"; then
    echo "Not authenticated with gcloud. Please login..."
    gcloud auth login
fi

# gcloud config set project ${PROJECT_ID}
gcloud config set run/region ${REGION}
gcloud config set run/platform managed

echo "Using configuration:"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Image Tag: $IMAGE_TAG"
echo "Image Name: $IMAGE_NAME"

# Build and push the production image
echo "Building Node-RED example app..."
BUILD_MODE=prod \
NO_CACHE=true \
BUILD_PLATFORM=linux/amd64 \
IMAGE_TAG=${IMAGE_TAG} \
"${SCRIPT_DIR}/../node-red-example/scripts/build.sh"

# Deploy to Cloud Run
echo "Deploying new revision to Cloud Run..."
gcloud run deploy nodered-example \
    --image ${IMAGE_NAME}:${IMAGE_TAG} \
    --platform managed \
    --project ${PROJECT_ID} \
    --region ${REGION} \
    --port 1880 \
    --timeout=300s \
    --no-traffic \
    --tag=${IMAGE_TAG//./-} \
    --set-env-vars=OPENAI_API_URL=${OPENAI_API_URL},CONSUMER_URL=${CONSUMER_URL},LOG_LEVEL=info || {
    echo "ERROR: Failed to deploy to Cloud Run"
    exit 1
}

echo "Updating traffic split to send all traffic to new revision..."
gcloud run services update-traffic nodered-example \
    --platform managed \
    --project ${PROJECT_ID} \
    --region ${REGION} \
    --to-tags=${IMAGE_TAG//./-}=100 || {
    echo "ERROR: Failed to update traffic split"
    exit 1
}

echo "Deployment completed successfully!" 