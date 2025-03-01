#!/bin/bash

# reload-and-reinstall.sh
# Script to reload the UniversalBuilder package and reinstall it

# First, reload all the files
./scripts/reload-builder.sh

echo "📦 Reinstalling the UniversalBuilder package..."

# Change to the project directory
cd "$(dirname "$0")/.."

# Reinstall the package
npm uninstall node-red-contrib-universal-deploy
npm install --no-save file:lib/UniversalBuilder

echo "✅ UniversalBuilder package reloaded and reinstalled successfully!" 