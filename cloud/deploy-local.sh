#!/bin/bash

set -e

# Pull in the docker-compose template & variables
wget "https://github.com/MORpheus-Software/NFA/blob/main/UniversalBuilder/lib/docker-compose.yaml"

# Check if the env file exists, otherwise rename the example file
if [ ! -f .env ]; then
    wget -O .env.example "https://github.com/MORpheus-Software/NFA/blob/main/UniversalBuilder/lib/.env.example"
    mv .env.example .env
fi

# Stand up the Morpheus stack
docker compose up -d
