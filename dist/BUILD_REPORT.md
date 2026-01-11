# FerretWatch Build Report

**Build Date:** Sun Jan 11 05:55:40 PM IST 2026
**Version:** 2.3.0
**Build Tools:**
- Terser: true
- jq: true

## Generated Packages

- **firefox**: ferretwatch-firefox-v2.3.0.zip (166K)
- **chrome**: ferretwatch-chrome-v2.3.0.zip (166K)
- **edge**: ferretwatch-edge-v2.3.0.zip (166K)

## Build Configuration

- **Unified Scripts**: Yes
- **Minification**: true
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

