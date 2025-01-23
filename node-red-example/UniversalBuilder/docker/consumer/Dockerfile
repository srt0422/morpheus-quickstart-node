FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Environment variables
ENV WALLET_CREDENTIALS=""
ENV NODE_ENV="production"

# Expose default port
EXPOSE 3000

CMD ["node", "index.js"] 