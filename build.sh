#!/bin/bash

# FerretWatch - Unified Cross-browser Build Script
# Builds optimized extension packages for Firefox, Chrome, and Edge

set -e

# Configuration
VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' manifest.json | head -1)"
BUILD_DIR="builds"
DIST_DIR="$(pwd)/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}$1${NC}"
}

print_info() {
    echo -e "${BLUE}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check if required tools are available
check_tools() {
    print_info "🔧 Checking available build tools..."
    
    if command -v terser > /dev/null 2>&1; then
        print_status "  ✅ Terser (JavaScript minification)"
        HAS_TERSER=true
    else
        print_warning "  ⚠️  Terser not found - JS files will not be minified"
        HAS_TERSER=false
    fi
    
    if command -v jq > /dev/null 2>&1; then
        print_status "  ✅ jq (JSON processing)"
        HAS_JQ=true
    else
        print_error "jq is required to generate Chrome/Edge manifests"
        exit 1
    fi
}

# Minify a JavaScript file
minify_js() {
    local input_file="$1"
    local output_file="$2"
    
    if [[ "$HAS_TERSER" == "true" ]]; then
        print_info "🗜️  Minifying JS: $(basename "$input_file")"
        terser "$input_file" \
            --compress drop_console=false,drop_debugger=true,unused=false \
            --mangle reserved=['browser','chrome'] \
            --output "$output_file" 2>/dev/null || cp "$input_file" "$output_file"
    else
        print_info "📋 Copying JS: $(basename "$input_file")"
        cp "$input_file" "$output_file"
    fi
}

# Copy and optimize files for a browser
copy_browser_files() {
    local browser="$1"
    local target_dir="$BUILD_DIR/$browser"
    
    print_info "📋 Copying files to $target_dir..."
    
    # Recreate generated files so removed source files cannot survive in packages.
    rm -rf "$target_dir"

    # Create target directory structure
    mkdir -p "$target_dir"/{config,popup,utils,content,icons,docs}

    # Copy main files
    minify_js "background.js" "$target_dir/background.js"

    # Copy modular content scripts
    print_info "📋 Copying modular content scripts..."
    for content_file in content/*.js; do
        if [[ -f "$content_file" ]]; then
            minify_js "$content_file" "$target_dir/$content_file"
        fi
    done

    # Copy directories
    cp -r config/* "$target_dir/config/" 2>/dev/null || true
    cp -r popup/* "$target_dir/popup/" 2>/dev/null || true
    cp -r utils/* "$target_dir/utils/" 2>/dev/null || true
    cp -r icons/* "$target_dir/icons/" 2>/dev/null || true
    cp -r docs/* "$target_dir/docs/" 2>/dev/null || true
    
    # Copy patterns
    cp config/patterns.js "$target_dir/config/patterns.js"
    
    # Minify popup JavaScript file
    if [[ -f "$target_dir/popup/popup.js" && "$HAS_TERSER" == "true" ]]; then
        print_info "🗜️  Minifying popup JS: popup.js"
        terser "$target_dir/popup/popup.js" --compress drop_console=false --mangle --output "$target_dir/popup/popup.js.tmp" 2>/dev/null && mv "$target_dir/popup/popup.js.tmp" "$target_dir/popup/popup.js" || rm -f "$target_dir/popup/popup.js.tmp"
    fi
    
    print_status "  ✅ Files copied to $target_dir"
}

# Create Firefox manifest
create_firefox_manifest() {
    local target_dir="$1"
    
    # Firefox uses the standard manifest.json
    cp "manifest.json" "$target_dir/manifest.json"
}

# Create Chrome/Edge manifest (Manifest V3)
create_chrome_manifest() {
    local target_dir="$1"
    
    print_info "📝 Creating Chrome/Edge manifest..."
    
    if [[ "$HAS_JQ" == "true" ]]; then
        # Use jq for precise manifest transformation
        jq '.manifest_version = 3 |
            .background = {"service_worker": "background.js"} |
            del(.background.scripts) |
            .action = .browser_action |
            del(.browser_action) |
            .host_permissions = [.permissions[] | select(test("^(<all_urls>|\\*|https?://|wss?://|file://|ftp://)"))] |
            .permissions = ["storage", "activeTab", "scripting", "webRequest", "notifications"] |
            .web_accessible_resources = [{"resources": .web_accessible_resources, "matches": ["<all_urls>"]}]' \
            manifest.json > "$target_dir/manifest.json"


    fi
}

# Create a zip package
create_package() {
    local browser="$1"
    local source_dir="$BUILD_DIR/$browser"
    local package_name="ferretwatch-$browser-v$VERSION.zip"
    
    print_info "📦 Creating package for $browser..."
    
    cd "$source_dir"
    rm -f "$DIST_DIR/$package_name"
    zip -r "$DIST_DIR/$package_name" . > /dev/null 2>&1
    cd - > /dev/null
    
    print_status "✅ Package created: $DIST_DIR/$package_name"
}

# Generate build report
generate_report() {
    local report_file="$DIST_DIR/BUILD_REPORT.md"
    
    print_info "📊 Generating build report..."
    
    cat > "$report_file" << EOF
# FerretWatch Build Report

**Build Date:** $(date)
**Version:** $VERSION
**Build Tools:**
- Terser: ${HAS_TERSER}
- jq: ${HAS_JQ}

## Generated Packages

EOF
    
    for browser in firefox chrome edge; do
        local package_name="ferretwatch-$browser-v$VERSION.zip"
        if [[ -f "$DIST_DIR/$package_name" ]]; then
            local size=$(ls -lh "$DIST_DIR/$package_name" | awk '{print $5}')
            echo "- **$browser**: $package_name ($size)" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Build Configuration

- **Unified Scripts**: Yes
- **Minification**: ${HAS_TERSER}
- **Console Logging**: Preserved for debugging
- **Source Maps**: Not generated

## Browser-Specific Changes

### Firefox
- Uses Manifest V2
- Uses browser.* APIs
- Standard permissions model

### Chrome/Edge
- Uses Manifest V3
- Uses chrome.* APIs with promise wrappers
- Service worker background script
- Host permissions separated from regular permissions

EOF
    
    print_status "✅ Build report generated: $report_file"
}

# Main build process
main() {
    print_status "🚀 FerretWatch - Unified Cross-browser Build"
    print_info "Version: $VERSION"
    print_info "Target browsers: Firefox, Chrome, Edge"
    echo ""
    
    # Setup
    check_tools
    mkdir -p "$BUILD_DIR" "$DIST_DIR"
    echo ""
    
    # Build Firefox
    print_status "🦊 Building Firefox version..."
    copy_browser_files "firefox"
    create_firefox_manifest "$BUILD_DIR/firefox"
    create_package "firefox"
    echo ""
    
    # Build Chrome
    print_status "🔵 Building Chrome version..."
    copy_browser_files "chrome"
    create_chrome_manifest "$BUILD_DIR/chrome"
    create_package "chrome"
    echo ""
    
    # Build Edge
    print_status "🔷 Building Edge version..."
    copy_browser_files "edge"
    create_chrome_manifest "$BUILD_DIR/edge"
    create_package "edge"
    echo ""
    
    # Generate report
    generate_report
    echo ""
    
    # Summary
    print_status "🎉 Build process completed successfully!"
    echo ""
    print_info "📦 Generated packages:"
    ls -la "$DIST_DIR"/*.zip 2>/dev/null || print_warning "No packages found"
    echo ""
    print_info "📄 Build report: $DIST_DIR/BUILD_REPORT.md"
    echo ""
    print_status "🧪 Next steps:"
    print_info "  1. Test packages in respective browsers"
    print_info "  2. Verify functionality and performance"
    print_info "  3. Submit to browser extension stores"
    echo ""
    print_status "✅ Build complete!"
}

# Run main function
main "$@"