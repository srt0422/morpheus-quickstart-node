#!/bin/bash

set -e

# Pull in the docker-compose template & variables
wget "https://github.com/MORpheus-Software/NFA/blob/main/UniversalBuilder/lib/docker-compose.yaml"
wget "https://github.com/MORpheus-Software/NFA/blob/main/UniversalBuilder/lib/.env.example"

# Check if the env file exists, otherwise rename the example file
[ ! -f .env ] && mv .env.example .env

# Stand up the Morpheus stack
docker compose up -d
