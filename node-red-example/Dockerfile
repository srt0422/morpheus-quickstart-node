FROM nodered/node-red:latest-20

WORKDIR /usr/src/node-red

# Switch to root to handle installations
USER root

# Install system dependencies and Google Cloud SDK
RUN apk add --no-cache \
    python3 \
    curl \
    bash \
    && curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.0-linux-x86_64.tar.gz \
    && tar -xf google-cloud-cli-458.0.0-linux-x86_64.tar.gz \
    && ./google-cloud-sdk/install.sh --quiet --path-update=true \
    && ln -s /usr/src/node-red/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud \
    && ln -s /usr/src/node-red/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil \
    && rm google-cloud-cli-458.0.0-linux-x86_64.tar.gz

# Copy package files first
COPY --chown=1000:1000 package*.json ./

# Create UniversalBuilder directory and set permissions
RUN mkdir -p UniversalBuilder && chown 1000:1000 UniversalBuilder

# Copy UniversalBuilder files with correct ownership
COPY --chown=1000:1000 UniversalBuilder/package*.json ./UniversalBuilder/
COPY --chown=1000:1000 UniversalBuilder/nodes ./UniversalBuilder/nodes/

# Install all dependencies in dev mode, production dependencies only in prod mode
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Switch to node-red user for npm operations
USER node-red

# Install dependencies
RUN if [ "$NODE_ENV" = "production" ]; then \
        npm install --omit=dev && \
        cd UniversalBuilder && npm install --omit=dev && cd ..; \
    else \
        npm install && \
        cd UniversalBuilder && npm install && cd ..; \
    fi

USER root

# Create symbolic link for UniversalBuilder nodes in Node-RED nodes directory
RUN mkdir -p /data/node_modules && \
    ln -s /usr/src/node-red/UniversalBuilder /data/node_modules/node-red-contrib-universal-deploy

# Add UniversalBuilder to Node-RED's node path
ENV NODE_PATH=/usr/src/node-red/node_modules:/usr/src/node-red/UniversalBuilder:/data/node_modules

# Copy application files with correct ownership
COPY --chown=1000:1000 flows.json ./
COPY --chown=1000:1000 settings.js ./
COPY --chown=1000:1000 lib ./lib/
COPY --chown=1000:1000 public ./public/
COPY --chown=1000:1000 css ./css/
COPY --chown=1000:1000 nodemon.json ./
COPY --chown=1000:1000 scripts/start.sh ./scripts/start.sh

# Ensure lib directory has correct permissions and exists
RUN mkdir -p /usr/src/node-red/lib && chown -R 1000:1000 /usr/src/node-red/lib

# Ensure start script is executable
RUN chmod +x scripts/start.sh

# Create data directory with correct permissions
RUN mkdir -p /data && chown -R 1000:1000 /data

# Copy logo to Node-RED UI assets directory
RUN mkdir -p /usr/src/node-red/node_modules/node-red/public/red/images/
COPY --chown=1000:1000 public/logo.png /usr/src/node-red/node_modules/node-red/public/red/images/node-red.png

# Set environment variables
ENV FLOWS=flows.json
ENV PATH=${PATH}:/usr/src/node-red/google-cloud-sdk/bin

# Switch back to node-red user
USER node-red

# Set the command
CMD ["npx", "node-red", "-u", "/data", "-s", "settings.js"] 