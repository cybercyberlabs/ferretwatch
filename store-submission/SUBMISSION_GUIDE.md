# FerretWatch - Store Submission Guide

## Overview

FerretWatch v2.3.0 is ready for submission to browser extension stores with modular architecture, API Explorer v2, enhanced security features, and improved performance.

## Current Version

**Version**: 2.3.0
**Last Updated**: 2026-01-13
**Status**: Production Ready ✅

## Package Information

| Browser | Package | Size | Manifest |
|---------|---------|------|----------|
| Firefox | ferretwatch-firefox-v2.3.0.zip | 195KB | V2 |
| Chrome | ferretwatch-chrome-v2.3.0.zip | 195KB | V3 |
| Edge | ferretwatch-edge-v2.3.0.zip | 195KB | V3 |

## What's New in v2.3.0

### 🏗️ Major Refactoring
- **Modular Architecture**: Split monolithic content.js (1,138 lines) into 8 focused modules
- **Improved Maintainability**: Largest file now 363 lines (67% reduction)
- **Better Documentation**: Comprehensive JSDoc on all functions
- **Enhanced Testability**: Modules can be tested in isolation

### 🔧 API Explorer v2
- **Unified View**: Combined live and static endpoint discovery
- **Request Replay**: Edit and resend captured API requests
- **Headers & Body Editing**: Full request modification capabilities
- **cURL Export**: Generate cURL commands for any request
- **Enhanced Filtering**: Source-based filtering (Live/Static)

### 🛡️ Security Improvements
- **Cloud Bucket Detection**: Automatic S3/GCS/Azure bucket scanning
- **Public Access Testing**: Tests bucket accessibility
- **Network Interception**: Captures all fetch/XHR requests
- **Enhanced Pattern Matching**: 60+ credential patterns

### 🎨 User Experience
- **Beautiful Notifications**: Risk-based gradient notifications
- **Real-time Scanning**: Progressive scanning engine
- **Whitelist Management**: Domain-based scanning control
- **Debug Mode**: Comprehensive logging for troubleshooting

## Submission Checklist

### ✅ Technical Requirements
- [x] Cross-browser compatibility (Firefox, Chrome, Edge)
- [x] Manifest V2/V3 support with compatibility layers
- [x] Service worker implementation for Chromium
- [x] Modular codebase (8 focused modules)
- [x] Performance optimized (< 500ms for large content)
- [x] Network interceptor for API call capture

### ✅ Quality Assurance
- [x] 60+ security pattern validation
- [x] False positive prevention with context awareness
- [x] Cloud bucket scanning and testing
- [x] API request replay functionality
- [x] Enhanced visual notifications
- [x] Memory efficient (< 50MB delta per operation)

### ✅ Documentation
- [x] User guide with installation instructions
- [x] Developer documentation
- [x] API reference
- [x] Privacy policy compliance
- [x] Release notes v2.3.0
- [x] Comprehensive code documentation (JSDoc)

## Store-Specific Requirements

### Firefox Add-ons (AMO)
- **Package**: `dist/ferretwatch-firefox-v2.3.0.zip`
- **Manifest**: V2 with WebExtensions APIs
- **Permissions**: `<all_urls>`, `storage`, `activeTab`, `webRequest`, `webRequestBlocking`
- **Category**: Developer Tools / Security
- **Review Time**: 1-3 days
- **Special Notes**: Uses browser.* APIs, compatible with Firefox 91+

### Chrome Web Store
- **Package**: `dist/ferretwatch-chrome-v2.3.0.zip`
- **Manifest**: V3 with service worker
- **Permissions**: `storage`, `activeTab`, `scripting`, `host_permissions: ["<all_urls>"]`
- **Category**: Productivity / Developer Tools
- **Review Time**: 1-7 days
- **Special Notes**: Uses chrome.* APIs with V3 architecture

### Microsoft Edge Add-ons
- **Package**: `dist/ferretwatch-edge-v2.3.0.zip`
- **Manifest**: V3 Chromium-compatible
- **Permissions**: `storage`, `activeTab`, `scripting`, `host_permissions: ["<all_urls>"]`
- **Category**: Productivity / Developer Tools
- **Review Time**: 1-5 days
- **Special Notes**: Compatible with Edge 88+

## Key Features to Highlight

### 🎯 API Discovery & Testing
- Automatic endpoint discovery from page JavaScript
- Capture live API calls in real-time
- Replay requests with custom modifications
- Export to cURL for CLI testing
- Headers and body editing

### 🔍 Advanced Credential Detection
- 60+ credential patterns (AWS, GitHub, Google, Slack, etc.)
- Context-aware false positive prevention
- Multi-tiered risk assessment (Critical/High/Medium/Low)
- Real-time progressive scanning
- Cloud bucket URL detection

### ☁️ Cloud Storage Security
- Automatic S3/GCS/Azure/DigitalOcean bucket detection
- Public access testing for buckets
- Provider-specific icon indicators
- Risk-based bucket classification

### 🎨 Enhanced User Experience
- Beautiful gradient notifications with risk-based colors
- Smooth animations and professional design
- Real-time scan progress indicators
- Domain whitelist management
- Debug mode for troubleshooting

### 🔒 Security & Privacy
- No data transmitted externally
- Local processing only
- Network interception happens in isolated page context
- Secure value display (no masking in notifications for security analysis)
- Configurable scanning sensitivity

### 🏗️ Architecture
- Modular content script design (8 modules)
- Single Responsibility Principle throughout
- Comprehensive error handling
- Backward compatible APIs
- IIFE pattern for extension compatibility

## Architecture Overview

### Content Script Modules
```
content/
├── constants.js          # Centralized configuration
├── utils.js             # Shared utilities (logging, colors, HTML escaping)
├── whitelist-checker.js # Domain whitelist management
├── interceptor-manager.js # Network interceptor injection
├── message-handler.js   # Message passing coordination
├── notification-ui.js   # Notification building and display
├── scanner-manager.js   # Scanner initialization and execution
└── index.js            # Main orchestrator
```

### Background Script
- API call storage and management
- Request/response pairing
- Endpoint scanning coordination
- Badge updates
- Settings management

### Popup UI
- API Explorer v2 interface
- Request table with filtering
- Detail panel with tabs
- Request replay functionality
- Settings interface

## Submission Steps

### 1. Prepare Materials
```bash
# Ensure clean build
./build.sh

# Verify packages
ls -lh dist/ferretwatch-*-v2.3.0.zip
```

### 2. Store Listings

**Title**: FerretWatch - API Discovery & Credential Scanner

**Short Description**:
Professional security extension for API discovery, credential scanning, and cloud storage detection with request replay and comprehensive security analysis.

**Detailed Description**:
FerretWatch is a comprehensive security tool that combines API discovery, credential scanning, and cloud storage security testing. It automatically detects exposed credentials, API keys, secrets, and cloud storage buckets on web pages while capturing live API calls for analysis and replay.

**Key Features:**
- 🔍 Real-time credential and secret detection (60+ patterns)
- 🌐 API endpoint discovery (static and live)
- 🔄 Request replay with custom modifications
- ☁️ Cloud bucket detection and security testing
- 📋 cURL export for CLI integration
- 🎯 Advanced filtering and search
- 🔒 Local processing with no external data transmission
- 🎨 Beautiful, informative notifications

**Perfect for:**
- Security professionals conducting audits
- Developers debugging API integrations
- Penetration testers discovering endpoints
- DevOps engineers monitoring cloud resources

**Keywords**: security, credentials, api keys, scanner, developer tools, privacy, audit, api testing, cloud security, penetration testing

### 3. Privacy Policy Points
- **No External Data Transmission**: All processing happens locally in the browser
- **No Personal Information Collection**: Extension does not collect user data
- **Local Storage Only**: User preferences stored locally via browser storage API
- **No Tracking or Analytics**: No usage tracking or telemetry
- **Network Interception**: Used only for local API call capture, not transmitted
- **Open Source**: Source code available for audit at github.com/cybercyberlabs/ferretwatch

### 4. Screenshots Required

#### Screenshot 1: API Explorer Interface
- Show the API Explorer v2 with captured requests
- Highlight request table with Live/Static filters
- Display detail panel with headers/body tabs

#### Screenshot 2: Credential Detection
- Notification showing detected credentials
- Risk-based color coding
- Provider icons for cloud buckets

#### Screenshot 3: Request Replay
- Detail panel showing editable request
- Headers editor with add/remove functionality
- Body editor with JSON formatting

#### Screenshot 4: Cloud Bucket Detection
- Notification showing detected cloud buckets
- Public access status indicators
- Provider-specific information

#### Screenshot 5: Settings & Configuration
- Settings interface showing options
- Whitelist management
- Debug mode toggle

### 5. Promotional Materials

**Icon**: 48x48, 96x96, 128x128 PNG (ferret theme)
**Banner**: 1400x560 px for Chrome Web Store
**Tile**: 440x280 px for promotional use

## Permissions Justification

### `<all_urls>` / `host_permissions`
**Purpose**: Required to inject content scripts and scan web pages for credentials and API endpoints.
**Usage**: Content scripts analyze page content and intercept network requests locally.

### `storage`
**Purpose**: Store user preferences, whitelisted domains, and extension settings.
**Usage**: Local storage only, no external transmission.

### `activeTab`
**Purpose**: Access currently active tab for scanning and API capture.
**Usage**: User-initiated scans and API discovery.

### `webRequest` / `webRequestBlocking` (Firefox only)
**Purpose**: Monitor network requests for API call capture.
**Usage**: Intercept fetch/XHR to populate API Explorer.

### `scripting` (Chrome/Edge only)
**Purpose**: Inject content scripts dynamically.
**Usage**: Required for Manifest V3 content script injection.

## Post-Submission

### Monitoring
- Track review status in each store
- Respond promptly to reviewer feedback (within 24-48 hours)
- Monitor user feedback and ratings
- Track bug reports and feature requests via GitHub

### Support Channels
- **GitHub Issues**: https://github.com/cybercyberlabs/ferretwatch/issues
- **Documentation**: In-extension help and GitHub wiki
- **Email Support**: [Your support email]

### Update Strategy
- **Security Patterns**: Monthly updates to detection patterns
- **Bug Fixes**: Rapid response to critical issues (< 48 hours)
- **Feature Enhancements**: Quarterly major releases
- **Performance**: Ongoing optimization based on user feedback

## Version History

### v2.3.0 (Current - 2026-01-13)
- Refactored content script into modular architecture
- Added API Explorer v2 with unified endpoint view
- Implemented request replay functionality
- Added cloud bucket detection and testing
- Enhanced security pattern matching
- Improved notification system

### v2.2.0 (2026-01-11)
- Added S3 path-style URL detection
- Enhanced console output control
- Improved bucket scanning features

### v2.1.0 (2025-11-XX)
- Enhanced visual notifications
- Added export functionality
- Improved false-positive prevention

## Build Verification

```bash
# Check package integrity
cd dist
unzip -t ferretwatch-firefox-v2.3.0.zip
unzip -t ferretwatch-chrome-v2.3.0.zip
unzip -t ferretwatch-edge-v2.3.0.zip

# Verify manifest versions
unzip -p ferretwatch-firefox-v2.3.0.zip manifest.json | jq '.version'
unzip -p ferretwatch-chrome-v2.3.0.zip manifest.json | jq '.version'
unzip -p ferretwatch-edge-v2.3.0.zip manifest.json | jq '.version'
```

## Success Metrics

### Installation Targets (First 3 Months)
- **Firefox**: 500+ active users
- **Chrome**: 2,000+ active users
- **Edge**: 200+ active users

### Quality Targets
- **Average Rating**: 4.5+ stars across all stores
- **User Feedback**: Positive reviews highlighting security value and API testing
- **Technical Issues**: <3% crash/error reports
- **Update Adoption**: 80%+ users on latest version within 2 weeks

### Growth Indicators
- Weekly active user growth rate
- Feature usage analytics (if implemented)
- Cross-platform adoption rates
- GitHub star count and community contributions

## Contact Information

- **Project**: FerretWatch
- **Organization**: CyberCyber Labs
- **Website**: https://cybercyberlabs.com
- **Repository**: https://github.com/cybercyberlabs/ferretwatch
- **Support**: https://github.com/cybercyberlabs/ferretwatch/issues

---

## Ready for Submission ✅

All packages are tested, verified, and ready for store submission. The extension has been thoroughly tested across all three major browsers with the new modular architecture.

**Build Command**: `./build.sh`
**Test Command**: Load unpacked from `builds/[browser]/` directory
**Submit Packages**: From `dist/` directory

*Last verified: 2026-01-13 15:30*
