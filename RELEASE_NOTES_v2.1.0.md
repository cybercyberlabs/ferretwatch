# FerretWatch v2.1.0 Release Notes

## 🎉 New Features

### ✨ Enhanced Notifications
- **Beautiful Visual Design**: Modern gradient backgrounds with glassmorphism effects
- **Smooth Animations**: Slide-in/slide-out transitions with hover effects
- **Risk-Based Badges**: Color-coded risk indicators (CRITICAL, HIGH, MEDIUM, LOW)
- **Contextual Information**: Shows surrounding text where credentials were found
- **Structured Cards**: Each credential displayed in its own card with clear separation

### 📊 Professional Console Output  
- **Branded Header**: FerretWatch banner with professional formatting
- **Risk Indicators**: Emoji-based risk levels for quick visual scanning
- **Structured Layout**: Clear sections with proper formatting and colors
- **Enhanced Context**: Better display of surrounding text with truncation

### 📤 Working Export System
- **JSON Export**: Complete findings data with metadata
- **CSV Export**: Spreadsheet-compatible format
- **Risk Summaries**: Automatic categorization by risk level
- **Timestamp & URL**: Full audit trail information
- **Robust Message Passing**: Fixed async communication between popup and content script

## 🔧 Bug Fixes

### 🚫 False Positive Prevention
- **Twilio SID Pattern**: Fixed false matches in CSS filenames (e.g., `sentry-8-ACnkOL...css`)
- **Context-Aware Matching**: Only matches credentials in proper variable assignments
- **Exclude Patterns**: New system to filter out common false positive contexts

### ⚡ Performance Improvements
- **Progressive Scanning**: Optimized batch processing with proper position tracking
- **Context Extraction**: Improved algorithm with HTML cleanup and whitespace normalization
- **Memory Management**: Better handling of scan results and global object exposure

## 🛠️ Technical Improvements

### 🌐 Cross-Browser Compatibility
- **Firefox (Manifest V2)**: Native WebExtensions API support
- **Chrome (Manifest V3)**: Service Worker compatibility with browser-compat layer  
- **Edge (Chromium)**: Full feature parity with Chrome version

### 🔒 Security Enhancements
- **Secure Value Masking**: Improved credential value obfuscation in logs
- **Domain Whitelisting**: Enhanced whitelist management with subdomain support
- **Storage Security**: Better handling of sensitive data in browser storage

## 📋 Pattern Updates

### 🆕 New Patterns
- Enhanced Twilio SID detection with context awareness
- Improved API key patterns with better validation
- Updated database connection string matching

### 🔍 Improved Detection
- Better context extraction (50-char windows)
- HTML tag removal and whitespace cleanup
- Position-aware matching for accurate context

## 🚀 Build System

### 📦 Automated Packaging
- **Cross-Browser Builds**: Automatic Firefox, Chrome, and Edge packages
- **Manifest Handling**: Browser-specific manifest generation
- **Size Optimization**: ~72KB packages with complete feature sets
- **Build Reports**: Detailed package information and verification

## ⚙️ Developer Experience

### 🧪 Debug Tools
- `FerretWatchDebug.scanCurrentPage()` - Manual page scanning
- `FerretWatchDebug.getLastScanResults()` - Export data access
- `FerretWatchDebug.checkDependencies()` - System validation
- Global object exposure for testing and debugging

## 📊 Statistics

- **Package Size**: ~72KB (all browsers)
- **Patterns Supported**: 50+ credential types
- **Risk Levels**: 4-tier classification system
- **Export Formats**: JSON, CSV with full metadata
- **Browser Support**: Firefox 91+, Chrome 88+, Edge 88+

## 🔄 Migration Notes

For users upgrading from v2.0.0:
- Export functionality now works correctly
- Enhanced notifications may look different (improved design)
- Some debug console messages have been cleaned up
- All existing features remain compatible

## 📋 Installation

### Firefox
1. Go to `about:debugging` → This Firefox
2. Load Temporary Add-on → Select `manifest.json`

### Chrome/Edge  
1. Go to `chrome://extensions/` or `edge://extensions/`
2. Enable Developer mode
3. Load unpacked → Select extension directory

---

**Full Changelog**: [View on GitHub](https://github.com/cybercyberlabs/ferretwatch/compare/v2.0.0...v2.1.0)

**Download**: Available in `dist/` directory after running `./build.sh`
