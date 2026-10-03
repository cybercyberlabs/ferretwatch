# FerretWatch Build Report

**Build Date:** Sat Oct  3 10:57:27 AM IDT 2026
**Version:** 2.3.5
**Build Tools:**
- Terser: false
- jq: true

## Generated Packages

- **firefox**: ferretwatch-firefox-v2.3.5.zip (202K)
- **chrome**: ferretwatch-chrome-v2.3.5.zip (202K)
- **edge**: ferretwatch-edge-v2.3.5.zip (202K)

## Build Configuration

- **Unified Scripts**: Yes
- **Minification**: false
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

