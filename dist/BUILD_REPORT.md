# FerretWatch Build Report

**Build Date:** Tue Jan 13 02:27:10 PM IST 2026
**Version:** 2.3.0
**Build Tools:**
- Terser: true
- jq: true

## Generated Packages

- **firefox**: ferretwatch-firefox-v2.3.0.zip (182K)
- **chrome**: ferretwatch-chrome-v2.3.0.zip (182K)
- **edge**: ferretwatch-edge-v2.3.0.zip (182K)

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

