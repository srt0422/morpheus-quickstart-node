FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (with proper error handling)
RUN npm install --production=false && \
    npm cache clean --force

# Copy the rest of the application
COPY . .

# Build the application for production
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"] 