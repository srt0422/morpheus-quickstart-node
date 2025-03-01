#!/bin/bash

# reload-builder.sh
# Script to reload the UniversalBuilder package from the main directory to node-red-example

MAIN_BUILDER_PATH="/Users/scottterry/Workspace/AgentGarage/UniversalBuilder"
LOCAL_BUILDER_PATH="/Users/scottterry/Workspace/AgentGarage/ExampleChatApp/node-red-example/lib/UniversalBuilder"

echo "🔄 Reloading UniversalBuilder package..."

# Create the local directory if it doesn't exist
mkdir -p "$LOCAL_BUILDER_PATH"
mkdir -p "$LOCAL_BUILDER_PATH/nodes"
mkdir -p "$LOCAL_BUILDER_PATH/src"
mkdir -p "$LOCAL_BUILDER_PATH/docker"

# Copy core files
echo "📝 Copying core files..."
cp "$MAIN_BUILDER_PATH/index.js" "$LOCAL_BUILDER_PATH/"
cp "$MAIN_BUILDER_PATH/package.json" "$LOCAL_BUILDER_PATH/"
cp "$MAIN_BUILDER_PATH/.nycrc" "$LOCAL_BUILDER_PATH/" 2>/dev/null || :

# Copy node files
echo "📝 Copying node files..."
cp -r "$MAIN_BUILDER_PATH/nodes/"* "$LOCAL_BUILDER_PATH/nodes/"

# Copy source files
echo "📝 Copying source files..."
cp -r "$MAIN_BUILDER_PATH/src/"* "$LOCAL_BUILDER_PATH/src/"

# Copy docker files
echo "📝 Copying docker files..."
cp -r "$MAIN_BUILDER_PATH/docker/"* "$LOCAL_BUILDER_PATH/docker/" 2>/dev/null || :

# Copy any other essential files
echo "📝 Copying other files..."
cp "$MAIN_BUILDER_PATH/project-structure.txt" "$LOCAL_BUILDER_PATH/" 2>/dev/null || :

echo "✅ UniversalBuilder package reloaded successfully!"
echo "🚀 Local path: $LOCAL_BUILDER_PATH" 