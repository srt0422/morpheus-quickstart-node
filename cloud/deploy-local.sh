#!/bin/bash

set -e

# Define the working directory
WORK_DIR="morpheus_local"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Pull in the docker-compose template if not present
if [ ! -f docker-compose.yaml ]; then
    wget -O docker-compose.yaml "https://raw.githubusercontent.com/MORpheus-Software/NFA/refs/heads/main/UniversalBuilder/lib/docker-compose.yaml"
fi

# Check if the env file exists, otherwise rename the example file
if [ ! -f .env ]; then
    wget -O .env.example "https://raw.githubusercontent.com/MORpheus-Software/NFA/refs/heads/main/UniversalBuilder/lib/.env.example"
    mv .env.example .env
fi

# Stand up the Morpheus stack
docker compose up -d
