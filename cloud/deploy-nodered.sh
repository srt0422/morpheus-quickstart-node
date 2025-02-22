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

# Check for nvm and Node.js
if ! command -v nvm >/dev/null 2>&1; then
    echo "nvm not found. Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install and use the required Node.js version
nvm install $REQUIRED_NODE_VERSION
nvm use $REQUIRED_NODE_VERSION || {
    echo "Failed to switch to Node.js version $REQUIRED_NODE_VERSION"
    exit 1
}

# Verify Node.js version
CURRENT_VERSION=$(node -v | cut -d 'v' -f 2)
if [ -z "$CURRENT_VERSION" ]; then
    echo "Failed to get Node.js version"
    exit 1
fi
echo "Using Node.js version: $CURRENT_VERSION"

# Verify environment variables
echo "Verifying environment variables..."
PROJECT_ID=${PROJECT_ID:-vireo-401203}
REGION=${REGION:-us-central1}
IMAGE_VERSION=${IMAGE_VERSION:-1.0.39}
IMAGE_TAG="v${IMAGE_VERSION}"
GCR_IMAGE_NAME=${IMAGE_NAME:-gcr.io/${PROJECT_ID}/nodered-example}
DOCKERHUB_IMAGE_NAME=${DOCKERHUB_IMAGE_NAME:-srt0422/nodered-example}

# Export variables needed by the build script
export DOCKERHUB_IMAGE_NAME="${DOCKERHUB_IMAGE_NAME}"
export GCR_IMAGE_NAME="gcr.io/${PROJECT_ID}/nodered-example"
export IMAGE_TAG="v${IMAGE_VERSION}"
export BUILD_MODE=prod
export NO_CACHE=false
export BUILD_PLATFORM=linux/amd64

# Generate a unique revision suffix using timestamp and random string
REVISION_SUFFIX=$(date +%Y%m%d-%H%M%S)-$(head -c 4 /dev/urandom | xxd -p)

# Configure gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="get(account)" | grep -q "@"; then
    echo "Not authenticated with gcloud. Please login..."
    gcloud auth login
fi

gcloud config set project ${PROJECT_ID}
gcloud config set run/region ${REGION}
gcloud config set run/platform managed

echo "Using configuration:"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Image Tag: $IMAGE_TAG"
echo "GCR Image: $GCR_IMAGE_NAME"
echo "Docker Hub Image: $DOCKERHUB_IMAGE_NAME"
echo "Revision Suffix: $REVISION_SUFFIX"
echo "Build Platform: $BUILD_PLATFORM"

# Build and push the production image
echo "Building Node-RED example app..."
BUILD_MODE=prod \
NO_CACHE=false \
BUILD_PLATFORM=linux/amd64 \
IMAGE_TAG=${IMAGE_TAG} \
"${SCRIPT_DIR}/../node-red-example/scripts/build.sh"
if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

# Function to deploy or update the service using a given image
deploy_with_image() {
    local image_name=$1
    local attempt=$2
    local revision_suffix="${REVISION_SUFFIX}-${attempt}"
    echo "Attempting to deploy with image: ${image_name}:${IMAGE_TAG}"
    echo "Using revision suffix: ${revision_suffix}"
    
    # Check if the service exists
    if ! gcloud run services describe nodered-example \
        --platform managed \
        --region ${REGION} \
        --project ${PROJECT_ID} > /dev/null 2>&1; then
        
        echo "Service does not exist. Creating new service..."
        # Create initial service with basic configuration
        gcloud run deploy nodered-example \
            --image ${image_name}:${IMAGE_TAG} \
            --platform managed \
            --project ${PROJECT_ID} \
            --region ${REGION} \
            --port 1880 \
            --timeout=300s \
            --memory=512Mi \
            --cpu=1 \
            --command="node-red" \
            --args="-u,/data,-s,settings.js" \
            --set-env-vars=OPENAI_API_URL=${OPENAI_API_URL},CONSUMER_URL=${CONSUMER_URL},LOG_LEVEL=info && \
        echo "Initial service created. Updating with full configuration..."
    fi

    # Now create the YAML with full configuration including startup probe
    cat > service.yaml << EOF
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: nodered-example
spec:
  template:
    metadata:
      name: nodered-example-${IMAGE_TAG//./-}-${revision_suffix}
    spec:
      containerConcurrency: 80
      containers:
        - image: ${image_name}:${IMAGE_TAG}
          ports:
            - name: http1
              containerPort: 1880
          command: ["node-red"]
          args: ["-u", "/data", "-s", "settings.js"]
          resources:
            limits:
              cpu: 1000m
              memory: 512Mi
          env:
            - name: OPENAI_API_URL
              value: ${OPENAI_API_URL}
            - name: CONSUMER_URL
              value: ${CONSUMER_URL}
            - name: LOG_LEVEL
              value: "info"
          startupProbe:
            initialDelaySeconds: 30
            timeoutSeconds: 240
            periodSeconds: 240
            failureThreshold: 1
            tcpSocket:
              port: 1880
EOF

    # Update the service with full configuration
    gcloud run services replace service.yaml \
        --platform managed \
        --region ${REGION} \
        --project ${PROJECT_ID} && \
    rm service.yaml && \
    return 0 || return 1
}

# Try GCR first
if deploy_with_image ${GCR_IMAGE_NAME} "gcr"; then
    echo "Deployment with GCR image successful!"
else
    echo "GCR deployment failed, trying Docker Hub image..."
    sleep 5  # Add a small delay before trying the next deployment
    if deploy_with_image ${DOCKERHUB_IMAGE_NAME} "dh"; then
        echo "Deployment with Docker Hub image successful!"
    else
        echo "ERROR: Failed to deploy with both GCR and Docker Hub images"
        exit 1
    fi
fi

echo "Deployment completed successfully!" 