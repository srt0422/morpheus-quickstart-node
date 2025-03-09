#!/bin/bash
set -e

# Source configuration
SCRIPT_DIR=$(dirname "$0")
CONFIG_PATH="$SCRIPT_DIR/config.sh"
source "$CONFIG_PATH"

# SaaS deployment configuration
SAAS_SERVICE_NAME="token-auth-saas"
SAAS_IMAGE_NAME="${DOCKER_REGISTRY}/token-auth-saas"
SAAS_VERSION="${IMAGE_VERSION}"
SAAS_PORT="3000"

echo "==========================================="
echo "     Deploying SaaS Token Auth Service     "
echo "==========================================="
echo "Service: $SAAS_SERVICE_NAME"
echo "Image:   $SAAS_IMAGE_NAME:$SAAS_VERSION"
echo "Region:  $REGION"
echo "Project: $PROJECT_ID"
echo "==========================================="

# Ensure correct GCP project context
ensure_gcp_context

# Confirm with user before proceeding
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Build Docker image
echo "Building Docker image..."
pushd "$SCRIPT_DIR/../saas" > /dev/null

# Create .dockerignore if it doesn't exist
if [ ! -f .dockerignore ]; then
    echo "Creating .dockerignore file..."
    cat > .dockerignore << EOF
node_modules
.next
.git
.env*
npm-debug.log
EOF
fi

# Check if Dockerfile exists, if not create one
if [ ! -f Dockerfile ]; then
    echo "Creating Dockerfile..."
    cat > Dockerfile << EOF
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tailwind.config.js ./
COPY --from=builder /app/postcss.config.js ./
COPY --from=builder /app/.env.example ./

EXPOSE 3000
CMD ["npm", "start"]
EOF
fi

# Build and push Docker image
echo "Building and pushing Docker image..."
docker build --platform=linux/amd64 -t $SAAS_IMAGE_NAME:$SAAS_VERSION .
docker push $SAAS_IMAGE_NAME:$SAAS_VERSION

echo "Image pushed successfully: $SAAS_IMAGE_NAME:$SAAS_VERSION"

# Return to original directory
popd > /dev/null

# Deploy to Google Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SAAS_SERVICE_NAME \
    --image $SAAS_IMAGE_NAME:$SAAS_VERSION \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port $SAAS_PORT \
    --set-env-vars="BASEIMAGE_PROXY_URL=${NFA_PROXY_URL:-https://nfa-proxy-1081887913409.us-west1.run.app}" \
    --set-env-vars="UPSTASH_REST_API_DOMAIN=learning-goblin-47025.upstash.io" \
    --set-env-vars="UPSTASH_REST_API_TOKEN=AbexAAIjcDE1M2Q4MWMxZTU5N2Q0MzEzYjQ0ZmM0NjIzZGUyYjQxMXAxMA" \
    --set-env-vars="API_KEYS_JWT_SECRET_KEY=production-secret-key-$(openssl rand -hex 12)" \
    --set-env-vars="BASEIMAGE_AUTH_TOKEN=${CONSUMER_PASSWORD:-yosz9BZCuu7Rli7mYe4G1JbIO0Yprvwl}" \
    --set-env-vars="NEXT_PUBLIC_BASEIMAGE_MODEL=LMR-Hermes-3-Llama-3.1-8B" \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300s

# Wait for deployment to complete
echo "Waiting for deployment to complete..."
if check_deployment $SAAS_SERVICE_NAME; then
    # Get the URL of the deployed service
    SAAS_URL=$(gcloud run services describe $SAAS_SERVICE_NAME \
        --region=$REGION \
        --format='value(status.url)')
    
    echo "==========================================="
    echo "      SaaS Token Auth Service Deployed     "
    echo "==========================================="
    echo "Service URL: $SAAS_URL"
    echo "==========================================="
    
    # Update the saas URL in config
    echo "Updating config.sh with new SaaS URL..."
    sed -i.bak "s|export SAAS_URL=.*|export SAAS_URL=\"$SAAS_URL\"|g" "$CONFIG_PATH"
    if ! grep -q "export SAAS_URL=" "$CONFIG_PATH"; then
        echo "export SAAS_URL=\"$SAAS_URL\"" >> "$CONFIG_PATH"
    fi
    
    echo "Deployment complete! The SaaS Token Auth Service is available at: $SAAS_URL"
else
    echo "Deployment failed or timed out. Check the GCP Console for more details."
    exit 1
fi

# Create Redis instance in Cloud Memorystore if needed
if [[ "$CREATE_REDIS" == "true" ]]; then
    echo "Creating Redis instance in Cloud Memorystore..."
    REDIS_INSTANCE_NAME="token-auth-redis"
    
    # Check if Redis instance already exists
    if gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION &>/dev/null; then
        echo "Redis instance already exists. Skipping creation."
    else
        gcloud redis instances create $REDIS_INSTANCE_NAME \
            --size=1 \
            --region=$REGION \
            --tier=basic \
            --redis-version=redis_6_x
        
        # Get Redis instance IP and port
        REDIS_IP=$(gcloud redis instances describe $REDIS_INSTANCE_NAME \
            --region=$REGION \
            --format='value(host)')
        REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE_NAME \
            --region=$REGION \
            --format='value(port)')
        
        # Update the REDIS_URL in config.sh
        echo "Updating config.sh with new Redis URL..."
        REDIS_URL="redis://$REDIS_IP:$REDIS_PORT"
        sed -i.bak "s|export REDIS_URL=.*|export REDIS_URL=\"$REDIS_URL\"|g" "$CONFIG_PATH"
        if ! grep -q "export REDIS_URL=" "$CONFIG_PATH"; then
            echo "export REDIS_URL=\"$REDIS_URL\"" >> "$CONFIG_PATH"
        fi
        
        # Update the deployed service with the new Redis URL
        echo "Updating deployed service with new Redis URL..."
        gcloud run services update $SAAS_SERVICE_NAME \
            --region=$REGION \
            --allow-unauthenticated \
            --set-env-vars="REDIS_URL=$REDIS_URL"
    fi
fi

echo "SaaS Token Auth Service deployment complete!"

# Ensure the service allows unauthenticated access
echo "Ensuring service allows unauthenticated access..."
gcloud run services add-iam-policy-binding $SAAS_SERVICE_NAME \
    --region=$REGION \
    --member="allUsers" \
    --role="roles/run.invoker"

echo "Authentication settings updated. SaaS Token Auth Service is now publicly accessible." 