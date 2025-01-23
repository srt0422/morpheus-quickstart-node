FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Environment variables
ENV API_KEY=""
ENV NODE_ENV="production"

# Expose default ports
EXPOSE 3000
EXPOSE 8080

CMD ["node", "index.js"] 