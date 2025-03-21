# syntax=docker/dockerfile:1.4

# Base stage with shared dependencies
FROM --platform=linux/amd64 nodered/node-red:3.1.3 as base
WORKDIR /usr/src/node-red
USER root

# Install minimal system dependencies needed for both dev and prod
RUN apk add --no-cache bash

# Set common environment variables
ENV NODE_PATH=/usr/src/node-red/node_modules:/data/node_modules \
    FLOWS=flows.json

# Development stage
FROM base as development
USER root

# Install development-specific system dependencies
RUN apk add --no-cache python3 curl && \
    # Install Google Cloud SDK
    curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.0-linux-x86_64.tar.gz && \
    tar -xf google-cloud-cli-458.0.0-linux-x86_64.tar.gz && \
    ./google-cloud-sdk/install.sh --quiet --path-update=true && \
    ln -s /usr/src/node-red/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud && \
    ln -s /usr/src/node-red/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil && \
    rm google-cloud-cli-458.0.0-linux-x86_64.tar.gz

# Add Google Cloud SDK to PATH for development
ENV PATH=${PATH}:/usr/src/node-red/google-cloud-sdk/bin

# Configure npm for better caching
ENV NPM_CACHE_DIR=/usr/src/node-red/.npm-cache \
    npm_config_cache=/usr/src/node-red/.npm-cache \
    npm_config_prefer_offline=true

# Create necessary directories with correct permissions
RUN mkdir -p /data \
            /data/node_modules \
            /usr/src/node-red/lib \
            /usr/src/node-red/node_modules \
            /usr/src/node-red/.npm-cache && \
    chown -R node-red:node-red /data \
                              /usr/src/node-red/lib \
                              /usr/src/node-red/.npm-cache \
                              /usr/src/node-red/node_modules

# Copy package files for dependency installation
COPY --chown=node-red:node-red package*.json ./

# Switch to node-red user and install dependencies
USER node-red
RUN npm install --prefer-offline --no-audit --no-progress

# Copy application files
COPY --chown=node-red:node-red flows.json settings.js nodemon.json .env ./
COPY --chown=node-red:node-red lib ./lib/
COPY --chown=node-red:node-red public ./public/
COPY --chown=node-red:node-red css ./css/
COPY --chown=node-red:node-red public/logo.png /usr/src/node-red/node_modules/node-red/public/red/images/node-red.png

# Install UniversalBuilder from local directory
USER node-red
RUN cd /usr/src/node-red/lib/UniversalBuilder && \
    npm install --no-package-lock && \
    cd /usr/src/node-red && \
    npm install ./lib/UniversalBuilder

USER node-red
CMD ["npx", "nodemon", "--exec", "node-red", "-u", "/data", "-s", "settings.js"]

# Production stage
FROM base as production
USER root

# Configure npm for better caching
ENV NPM_CACHE_DIR=/usr/src/node-red/.npm-cache \
    npm_config_cache=/usr/src/node-red/.npm-cache \
    npm_config_prefer_offline=true \
    PATH=${PATH}:/usr/src/node-red/google-cloud-sdk/bin

# Install system dependencies and Google Cloud SDK, then remove unnecessary files to reduce image size
RUN apk add --no-cache curl python3 && \
    curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.0-linux-x86_64.tar.gz && \
    tar -xf google-cloud-cli-458.0.0-linux-x86_64.tar.gz && \
    ./google-cloud-sdk/install.sh --quiet --path-update=true && \
    ln -s /usr/src/node-red/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud && \
    ln -s /usr/src/node-red/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil && \
    rm -rf google-cloud-cli-458.0.0-linux-x86_64.tar.gz && \
    rm -rf /usr/src/node-red/google-cloud-sdk/.git /usr/src/node-red/google-cloud-sdk/doc /usr/src/node-red/google-cloud-sdk/platform && \
    mkdir -p /data \
             /data/node_modules \
             /usr/src/node-red/lib \
             /usr/src/node-red/node_modules \
             /usr/src/node-red/.npm-cache && \
    chown -R node-red:node-red /data \
                              /usr/src/node-red/lib \
                              /usr/src/node-red/.npm-cache \
                              /usr/src/node-red/node_modules \
                              /usr/src/node-red/google-cloud-sdk

# Copy package files for dependency installation
COPY --chown=node-red:node-red package*.json ./

# Install production dependencies only
USER node-red
RUN npm ci --prefer-offline --no-audit --omit=dev --no-progress && \
    npm cache clean --force

# Copy application files
COPY --chown=node-red:node-red flows.json settings.js .env ./
COPY --chown=node-red:node-red lib ./lib/
COPY --chown=node-red:node-red public ./public/
COPY --chown=node-red:node-red public/logo.png /usr/src/node-red/node_modules/node-red/public/red/images/node-red.png

# Install UniversalBuilder from local directory
RUN cd /usr/src/node-red/lib/UniversalBuilder && \
    npm install --no-package-lock && \
    cd /usr/src/node-red && \
    npm install ./lib/UniversalBuilder

USER node-red
CMD ["node-red", "-u", "/data", "-s", "settings.js"] 