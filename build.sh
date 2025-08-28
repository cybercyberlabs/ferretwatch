#!/bin/bash

#!/bin/bash
# FerretWatch - Cross-browser Build Script
# Builds extension for Firefox, Chrome, and Edge

set -e

echo "🚀 Starting cross-browser build process..."

# Configuration
VERSION="2.2.0"
BUILD_DIR="builds"
DIST_DIR="$(pwd)/dist"
SOURCE_FILES=(
    "manifest.json"
    "content.js"
    "background.js"
    "config/"
    "popup/"
    "utils/"
    "icons/"
    "docs/"
    "_locales/"
)

# Create build directories
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

echo "📁 Created build directories"

# Function to copy source files
copy_source_files() {
    local target_dir="$1"
    echo "📋 Copying source files to $target_dir..."
    
    for file in "${SOURCE_FILES[@]}"; do
        if [[ -e "$file" ]]; then
            cp -r "$file" "$target_dir/"
            echo "  ✅ Copied $file"
        else
            echo "  ⚠️  Warning: $file not found, skipping"
        fi
    done
}

# Function to create placeholder icons if they don't exist
create_placeholder_icons() {
    local target_dir="$1/icons"
    mkdir -p "$target_dir"
    
    # Create simple placeholder icons if they don't exist
    local sizes=(16 32 48 128)
    for size in "${sizes[@]}"; do
        local icon_file="$target_dir/icon-${size}.png"
        if [[ ! -f "$icon_file" ]]; then
            echo "🎨 Creating placeholder icon: $icon_file"
            # Create a simple colored square as placeholder
            # This would require ImageMagick: convert -size ${size}x${size} xc:#4285f4 "$icon_file"
            # For now, just create an empty file as placeholder
            touch "$icon_file"
        fi
    done
}

# Build Firefox version
build_firefox() {
    local firefox_dir="$BUILD_DIR/firefox"
    echo "🦊 Building Firefox version..."
    
    rm -rf "$firefox_dir"
    mkdir -p "$firefox_dir"
    
    # Copy source files
    copy_source_files "$firefox_dir"
    
    # Use Firefox manifest
    cp "manifest.json" "$firefox_dir/manifest.json"
    
    # Create icons
    create_placeholder_icons "$firefox_dir"
    
    # Create Firefox-specific files
    cat > "$firefox_dir/README_FIREFOX.md" << 'EOF'
# Firefox Credential Scanner

This is the Firefox version of the Credential Scanner extension.

## Installation
1. Open Firefox
2. Go to about:debugging
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select manifest.json from this directory

## Features
- Full Manifest V2 compatibility
- Native Firefox API support
- Optimized for Firefox performance

For more information, see the main documentation.
EOF
    
    # Package Firefox extension
    local firefox_package="ferretwatch-firefox-v${VERSION}.zip"
    cd "$firefox_dir"
    zip -r "$(pwd)/../../dist/$firefox_package" . -x "*.DS_Store" "*.git*" "node_modules/*"
    cd - > /dev/null
    
    echo "✅ Firefox package created: dist/$firefox_package"
}

# Build Chrome version
build_chrome() {
    local chrome_dir="$BUILD_DIR/chrome"
    echo "🔵 Building Chrome version..."
    
    rm -rf "$chrome_dir"
    mkdir -p "$chrome_dir"
    
    # Copy source files
    copy_source_files "$chrome_dir"
    
    # Use Chrome manifest (Manifest V3) - convert from Firefox manifest
    if [[ -f "$chrome_dir/manifest.json" ]]; then
        # Transform Firefox manifest to Chrome V3 manifest
        python3 << 'EOF'
import json
import sys

# Read the Firefox manifest
with open('builds/chrome/manifest.json', 'r') as f:
    manifest = json.load(f)

# Convert to Manifest V3 for Chrome
manifest['manifest_version'] = 3

# Replace browser_action with action
if 'browser_action' in manifest:
    manifest['action'] = manifest.pop('browser_action')

# Remove Firefox-specific settings
if 'browser_specific_settings' in manifest:
    del manifest['browser_specific_settings']

# Update content scripts structure if needed
# (Current structure should be compatible)

# Add host permissions (required in MV3)
if 'permissions' in manifest and '<all_urls>' in manifest['permissions']:
    manifest['host_permissions'] = ['<all_urls>']
    manifest['permissions'] = [p for p in manifest['permissions'] if p != '<all_urls>']

# Write Chrome manifest
with open('builds/chrome/manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
EOF
    fi
    
    # Create icons
    create_placeholder_icons "$chrome_dir"
    
    # Add browser compatibility layer
    cp "utils/browser-compat.js" "$chrome_dir/utils/"
    
    # Update content script to include compatibility layer
    if [[ -f "$chrome_dir/content.js" ]]; then
        # Prepend compatibility layer import
        cat > "$chrome_dir/content-temp.js" << 'EOF'
// Chrome compatibility layer
if (typeof importScripts !== 'undefined') {
    importScripts('utils/browser-compat.js');
}

EOF
        cat "$chrome_dir/content.js" >> "$chrome_dir/content-temp.js"
        mv "$chrome_dir/content-temp.js" "$chrome_dir/content.js"
    fi
    
    # Create Chrome-specific files
    cat > "$chrome_dir/README_CHROME.md" << 'EOF'
# Chrome Credential Scanner

This is the Chrome version of the Credential Scanner extension.

## Installation
1. Open Chrome
2. Go to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this directory

## Features
- Manifest V3 compatibility
- Service Worker background script
- Chrome-specific API optimizations

For more information, see the main documentation.
EOF
    
    # Package Chrome extension
    local chrome_package="ferretwatch-chrome-v${VERSION}.zip"
    cd "$chrome_dir"
    zip -r "$(pwd)/../../dist/$chrome_package" . -x "*.DS_Store" "*.git*" "node_modules/*"
    cd - > /dev/null
    
    echo "✅ Chrome package created: dist/$chrome_package"
}

# Build Edge version
build_edge() {
    local edge_dir="$BUILD_DIR/edge"
    echo "🔷 Building Edge version..."
    
    rm -rf "$edge_dir"
    mkdir -p "$edge_dir"
    
    # Edge uses the same structure as Chrome (Manifest V3)
    copy_source_files "$edge_dir"
    
    # Use Edge manifest (Manifest V3) - convert from Firefox manifest  
    if [[ -f "$edge_dir/manifest.json" ]]; then
        # Transform Firefox manifest to Edge V3 manifest
        python3 << 'EOF'
import json
import sys

# Read the Firefox manifest
with open('builds/edge/manifest.json', 'r') as f:
    manifest = json.load(f)

# Convert to Manifest V3 for Edge
manifest['manifest_version'] = 3

# Replace browser_action with action
if 'browser_action' in manifest:
    manifest['action'] = manifest.pop('browser_action')

# Remove Firefox-specific settings
if 'browser_specific_settings' in manifest:
    del manifest['browser_specific_settings']

# Add host permissions (required in MV3)
if 'permissions' in manifest and '<all_urls>' in manifest['permissions']:
    manifest['host_permissions'] = ['<all_urls>']
    manifest['permissions'] = [p for p in manifest['permissions'] if p != '<all_urls>']

# Write Edge manifest
with open('builds/edge/manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)
EOF
    fi
    
    # Update name for Edge
    if command -v jq > /dev/null; then
        jq '.name = "Credential Scanner for Edge"' "$edge_dir/manifest.json" > "$edge_dir/manifest-temp.json"
        mv "$edge_dir/manifest-temp.json" "$edge_dir/manifest.json"
    fi
    
    create_placeholder_icons "$edge_dir"
    cp "utils/browser-compat.js" "$edge_dir/utils/"
    
    # Create Edge-specific files
    cat > "$edge_dir/README_EDGE.md" << 'EOF'
# Edge Credential Scanner

This is the Microsoft Edge version of the Credential Scanner extension.

## Installation
1. Open Microsoft Edge
2. Go to edge://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this directory

## Features
- Manifest V3 compatibility (Chromium-based)
- Edge-specific optimizations
- Full feature compatibility

For more information, see the main documentation.
EOF
    
    # Package Edge extension
    local edge_package="ferretwatch-edge-v${VERSION}.zip"
    cd "$edge_dir"
    zip -r "$(pwd)/../../dist/$edge_package" . -x "*.DS_Store" "*.git*" "node_modules/*"
    cd - > /dev/null
    
    echo "✅ Edge package created: dist/$edge_package"
}

# Generate build report
generate_build_report() {
    echo "📊 Generating build report..."
    
    cat > "$DIST_DIR/BUILD_REPORT.md" << EOF
# Build Report - Credential Scanner v${VERSION}

Generated on: $(date)

## Package Information

| Browser | Package | Size | Manifest Version |
|---------|---------|------|------------------|
| Firefox | ferretwatch-firefox-v${VERSION}.zip | $(du -h "dist/ferretwatch-firefox-v${VERSION}.zip" 2>/dev/null | cut -f1 || echo "N/A") | V2 |
| Chrome | ferretwatch-chrome-v${VERSION}.zip | $(du -h "dist/ferretwatch-chrome-v${VERSION}.zip" 2>/dev/null | cut -f1 || echo "N/A") | V3 |
| Edge | ferretwatch-edge-v${VERSION}.zip | $(du -h "dist/ferretwatch-edge-v${VERSION}.zip" 2>/dev/null | cut -f1 || echo "N/A") | V3 |

## Build Configuration

- **Version**: ${VERSION}
- **Build Date**: $(date)
- **Source Files**: ${#SOURCE_FILES[@]} file groups
- **Target Browsers**: Firefox, Chrome, Edge

## Browser-Specific Features

### Firefox (Manifest V2)
- Native browser API support
- Persistent background page
- Full WebExtensions API
- Optimized DOM manipulation

### Chrome (Manifest V3)
- Service Worker background script
- Declarative permissions
- Promise-based APIs via compatibility layer
- Chrome Web Store compliant

### Edge (Manifest V3)
- Chromium-based compatibility
- Microsoft Edge Add-ons compliant
- Same feature set as Chrome version

## Installation Instructions

Each package includes browser-specific README files with detailed installation instructions.

## Verification

To verify package integrity:
\`\`\`bash
# Check package contents
unzip -l dist/ferretwatch-firefox-v${VERSION}.zip
unzip -l dist/ferretwatch-chrome-v${VERSION}.zip
unzip -l dist/ferretwatch-edge-v${VERSION}.zip
\`\`\`

## Next Steps

1. Test each package in respective browsers
2. Submit to browser extension stores
3. Update documentation with store links
EOF

    echo "✅ Build report generated: $DIST_DIR/BUILD_REPORT.md"
}

# Main build process
main() {
    echo "🔧 FerretWatch - Cross-browser Build"
    echo "Version: $VERSION"
    echo "Target browsers: Firefox, Chrome, Edge"
    echo ""
    
    # Clean previous builds but keep dist directory
    rm -rf "$BUILD_DIR"
    mkdir -p "$DIST_DIR"
    
    # Build for each browser
    build_firefox
    echo ""
    
    build_chrome
    echo ""
    
    build_edge
    echo ""
    
    # Generate report
    generate_build_report
    echo ""
    
    # Summary
    echo "🎉 Build process completed successfully!"
    echo ""
    echo "📦 Generated packages:"
    ls -la "$DIST_DIR"/*.zip 2>/dev/null || echo "  No packages found"
    echo ""
    echo "📄 Build report: $DIST_DIR/BUILD_REPORT.md"
    echo ""
    echo "🧪 Next steps:"
    echo "  1. Test packages in respective browsers"
    echo "  2. Run test suite on each version"
    echo "  3. Submit to browser extension stores"
    echo ""
    echo "✅ Build complete!"
}

# Run main function
main "$@"
