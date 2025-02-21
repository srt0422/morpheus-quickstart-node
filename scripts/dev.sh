# Function to sync UniversalBuilder
sync_universal_builder() {
    local source_dir="$1"
    local target_dir="$2"
    
    # Create target directory if it doesn't exist
    mkdir -p "$target_dir"
    
    # Use rsync to sync directories, excluding node_modules and other build artifacts
    rsync -aq --delete \
        --exclude 'node_modules' \
        --exclude 'coverage' \
        --exclude '.nyc_output' \
        --exclude 'dist' \
        --exclude '.git' \
        "$source_dir/" "$target_dir/" > /dev/null 2>&1
    
    echo "Synced UniversalBuilder to build context"
}

# Function to watch UniversalBuilder changes
watch_universal_builder() {
    local source_dir="$1"
    local target_dir="$2"
    
    echo "Watching UniversalBuilder for changes..."
    while true; do
        if [ -d "$source_dir" ]; then
            rsync -aq --delete \
                --exclude 'node_modules' \
                --exclude 'coverage' \
                --exclude '.nyc_output' \
                --exclude 'dist' \
                --exclude '.git' \
                "$source_dir/" "$target_dir/" > /dev/null 2>&1
        fi
        sleep 1
    done
}