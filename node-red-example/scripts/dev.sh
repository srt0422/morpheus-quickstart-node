#!/bin/bash

# Exit on error
set -e

# Parse arguments
RUN_CONTAINER=false
BUILD_MODE="development"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --run) RUN_CONTAINER=true ;;
        --prod) BUILD_MODE="production" ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Store the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Find UniversalBuilder directory
UNIVERSAL_BUILDER_DIR=""
SEARCH_PATHS=(
    "${SCRIPT_DIR}/../UniversalBuilder"
    "${SCRIPT_DIR}/../../UniversalBuilder"
)

for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/package.json" ]; then
        UNIVERSAL_BUILDER_DIR="$path"
        break
    fi
done

if [ -z "$UNIVERSAL_BUILDER_DIR" ]; then
    echo "Error: Could not find UniversalBuilder directory"
    echo "Searched in:"
    for path in "${SEARCH_PATHS[@]}"; do
        echo "  - $path"
    done
    exit 1
fi

echo "Found UniversalBuilder at: $UNIVERSAL_BUILDER_DIR"

# Function to sync UniversalBuilder
sync_universal_builder() {
    local source_dir="$1"
    local target_dir="$2"
    
    # Create target directory if it doesn't exist
    mkdir -p "$target_dir"
    
    # Use rsync to sync directories, excluding node_modules and other build artifacts
    rsync -av --delete \
        --exclude 'node_modules' \
        --exclude 'coverage' \
        --exclude '.nyc_output' \
        --exclude 'dist' \
        --exclude '.git' \
        "$source_dir/" "$target_dir/"
    
    echo "Synced UniversalBuilder to build context"
}

# Function to watch UniversalBuilder changes
watch_universal_builder() {
    local source_dir="$1"
    local target_dir="$2"
    
    echo "Watching UniversalBuilder for changes..."
    while true; do
        if [ -d "$source_dir" ]; then
            rsync -av --delete \
                --exclude 'node_modules' \
                --exclude 'coverage' \
                --exclude '.nyc_output' \
                --exclude 'dist' \
                --exclude '.git' \
                "$source_dir/" "$target_dir/"
        fi
        sleep 1
    done
}

# Sync UniversalBuilder to build context
BUILDER_CONTEXT="${SCRIPT_DIR}/lib/UniversalBuilder"
sync_universal_builder "$UNIVERSAL_BUILDER_DIR" "$BUILDER_CONTEXT"

# Create cache directories if they don't exist
NPM_CACHE_DIR="${SCRIPT_DIR}/.npm-cache"
mkdir -p "${NPM_CACHE_DIR}"

# Function to check if rebuild is needed
need_rebuild() {
    local last_build_time=0
    local package_json_time=0
    local dockerfile_time=0
    local package_lock_time=0
    local builder_time=0
    
    if [ -f "${SCRIPT_DIR}/.last_build_${BUILD_MODE}" ]; then
        last_build_time=$(cat "${SCRIPT_DIR}/.last_build_${BUILD_MODE}")
    fi
    
    if [ -f "${SCRIPT_DIR}/package.json" ]; then
        package_json_time=$(stat -f "%m" "${SCRIPT_DIR}/package.json")
    fi
    
    if [ -f "${SCRIPT_DIR}/package-lock.json" ]; then
        package_lock_time=$(stat -f "%m" "${SCRIPT_DIR}/package-lock.json")
    fi
    
    if [ -f "${SCRIPT_DIR}/Dockerfile" ]; then
        dockerfile_time=$(stat -f "%m" "${SCRIPT_DIR}/Dockerfile")
    fi
    
    # Check any changes in UniversalBuilder source directory
    if [ -d "${UNIVERSAL_BUILDER_DIR}" ]; then
        builder_time=$(find "${UNIVERSAL_BUILDER_DIR}" -type f -not -path "*/\.*" -not -path "*/node_modules/*" -exec stat -f "%m" {} \; | sort -nr | head -1)
    fi
    
    if [ "$package_json_time" -gt "$last_build_time" ] || \
       [ "$package_lock_time" -gt "$last_build_time" ] || \
       [ "$dockerfile_time" -gt "$last_build_time" ] || \
       [ "$builder_time" -gt "$last_build_time" ]; then
        return 0
    fi
    return 1
}

# Only clean specific cache directories if rebuild is needed
if need_rebuild; then
    echo "Changes detected, cleaning specific caches..."
    rm -rf "${SCRIPT_DIR}/temp"
    # Keep the NPM cache but clean it
    npm cache verify
else
    echo "No changes detected, using cached dependencies..."
fi

# Create and use custom temp directory
CUSTOM_TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "${CUSTOM_TEMP_DIR}"
export TMPDIR="${CUSTOM_TEMP_DIR}"
trap 'rm -rf "${CUSTOM_TEMP_DIR}"' EXIT

# Check if nvm is installed
if [ ! -d "$HOME/.nvm" ]; then
    echo "nvm is not installed. Please install nvm first:"
    echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    exit 1
fi

# Clear npm prefix settings
unset npm_config_prefix
npm config delete prefix || true

# Configure npm to use local cache
npm config set cache "${NPM_CACHE_DIR}"
npm config set prefer-offline true

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Only install Node.js if not already installed
if ! nvm ls 20 > /dev/null 2>&1; then
    echo "Installing Node.js 20..."
    nvm install 20
fi
nvm use 20
echo "Using Node.js $(node --version)"

# Source the cloud config if it exists
if [ -f "${SCRIPT_DIR}/cloud/config.sh" ]; then
    source "${SCRIPT_DIR}/cloud/config.sh"
fi

# Build configuration
OPENAI_API_URL=${OPENAI_API_URL:-http://host.docker.internal:8080}
CONSUMER_URL=${CONSUMER_URL:-http://host.docker.internal:8081}
LOG_LEVEL=${LOG_LEVEL:-debug}

# Create node_modules volume if it doesn't exist
VOLUME_NAME="nodered-example-modules"
if ! docker volume inspect ${VOLUME_NAME} >/dev/null 2>&1; then
    echo "Creating node_modules volume..."
    docker volume create ${VOLUME_NAME}
fi

# Only rebuild if necessary
if need_rebuild; then
    echo "Building ${BUILD_MODE} image..."
    # Use BuildKit for better caching
    export DOCKER_BUILDKIT=1
    docker build --target ${BUILD_MODE} \
                --build-arg BUILDKIT_INLINE_CACHE=1 \
                --build-arg NPM_CACHE_DIR="${NPM_CACHE_DIR}" \
                --no-cache-filter=npm-install \
                -t srt0422/nodered-example-${BUILD_MODE} .
    date +%s > "${SCRIPT_DIR}/.last_build_${BUILD_MODE}"
else
    echo "No changes detected, skipping build..."
fi

if [ "$RUN_CONTAINER" = true ]; then
    echo "Starting ${BUILD_MODE} container..."
    
    # Start watching UniversalBuilder in the background
    watch_universal_builder "$UNIVERSAL_BUILDER_DIR" "$BUILDER_CONTEXT" &
    WATCH_PID=$!
    
    # Ensure we kill the watch process when the script exits
    trap 'kill $WATCH_PID 2>/dev/null; rm -rf "${CUSTOM_TEMP_DIR}"' EXIT
    
    # Create a setup script
    cat > "${SCRIPT_DIR}/temp/setup.sh" << 'EOF'
#!/bin/sh
set -e

cd /usr/src/node-red

# Install UniversalBuilder
cd /usr/src/node-red/lib/UniversalBuilder
npm install --no-package-lock
cd /usr/src/node-red
npm install ./lib/UniversalBuilder

# Start Node-RED with nodemon
npx nodemon --exec "node-red -u /data -s settings.js"
EOF

    chmod +x "${SCRIPT_DIR}/temp/setup.sh"

    docker run -it --rm --init \
        -p 1880:1880 \
        -v "${SCRIPT_DIR}/flows.json:/usr/src/node-red/flows.json:delegated" \
        -v "${SCRIPT_DIR}/settings.js:/usr/src/node-red/settings.js:delegated" \
        -v "${SCRIPT_DIR}/lib:/usr/src/node-red/lib:delegated" \
        -v "${SCRIPT_DIR}/nodemon.json:/usr/src/node-red/nodemon.json:delegated" \
        -v "${VOLUME_NAME}:/usr/src/node-red/node_modules" \
        -v "${NPM_CACHE_DIR}:/usr/src/node-red/.npm-cache:delegated" \
        -v "${SCRIPT_DIR}/temp/setup.sh:/setup.sh:delegated" \
        -e NODE_ENV=${BUILD_MODE} \
        -e OPENAI_API_URL="${OPENAI_API_URL}" \
        -e CONSUMER_URL="${CONSUMER_URL}" \
        -e LOG_LEVEL="${LOG_LEVEL}" \
        -e npm_config_cache="/usr/src/node-red/.npm-cache" \
        -e HOME="/usr/src/node-red" \
        -e USER=node-red \
        --user node-red:node-red \
        --add-host=host.docker.internal:host-gateway \
        --entrypoint /setup.sh \
        srt0422/nodered-example-${BUILD_MODE}
else
    echo "Build complete. Use --run to start the container."
fi