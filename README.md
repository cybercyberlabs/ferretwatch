# FerretWatch: Credential & Secret Scanner

![CyberCyberLabs Logo](images/browser-extension-logo.svg)

**FerretWatch v2.2.0** - A professional Firefox extension that automatically scans web pages for exposed credentials and secrets, including API keys, tokens, passwords, database connections, and more. With enhanced visual notifications, robust export functionality, debug mode, and false-positive prevention, it provides detailed findings through beautiful UI notifications and comprehensive export options.

## Author

**CyberCyberLabs**  
🌐 GitHub: [https://github.com/cybercyberlabs](https://github.com/cybercyberlabs)  
🔗 Website: [cybercyberlabs.com](https://cybercyberlabs.com)

## Features

### 🎨 Enhanced User Experience (v2.2.0)
- **Beautiful Visual Notifications**: Modern gradient backgrounds with glassmorphism effects
- **Risk-Based Badges**: Color-coded indicators (CRITICAL, HIGH, MEDIUM, LOW)
- **Smooth Animations**: Slide-in/slide-out transitions with hover effects
- **Contextual Information**: Shows surrounding text where credentials were found

### 🪣 Cloud Bucket Security Scanning
- **Multi-Provider Support**: AWS S3, Google Cloud Storage, Azure Blob Storage, DigitalOcean Spaces, Alibaba Cloud OSS
- **Public Access Testing**: Automatically tests discovered buckets for public listing capabilities
- **Risk Assessment**: Identifies misconfigured buckets that could expose sensitive data
- **Configurable Settings**: Control which providers to scan, timeout values, and concurrency limits

### 📊 Robust Export System
- **JSON Export**: Complete findings data with metadata and risk summaries
- **CSV Export**: Spreadsheet-compatible format for analysis
- **Comprehensive Data**: Timestamp, URL, risk levels, and audit trails

### 🔍 Advanced Detection (50+ Patterns)
- **AWS Credentials**: Access Keys, Secret Keys, Session Tokens
- **GitHub Tokens**: Personal Access, Fine-grained, App Tokens  
- **API Keys**: Google, Stripe, Twilio, SendGrid, Mailgun
- **Database Connections**: MongoDB, MySQL, PostgreSQL, Redis
- **Cloud Providers**: Azure Storage Keys, GCP Service Accounts
- **Cloud Storage Buckets**: AWS S3, Google Cloud Storage, Azure Blob Storage with public access testing
- **Authentication**: Bearer Tokens, SSH Private Keys
- **Messaging Platforms**: Slack Bot/User Tokens, Discord Bot Tokens

### 🛡️ False Positive Prevention
- **Context-Aware Matching**: Excludes HTML attributes and client-side contexts
- **Intelligent Filtering**: Distinguishes between public and private API keys
- **Smart Exclusions**: Avoids CSS filenames, JavaScript variables, and UI elements
  - Slack Bot Tokens
  - Discord Bot Tokens
  - Basic Passwords
- **Smart False Positive Filtering**: Reduces noise by filtering obvious test/placeholder values
- **Risk-Based Alerting**: Color-coded notifications based on risk level (Critical/High/Medium/Low)
- **Smart Notifications**: Only notifies about new credentials; dismissed notifications stay dismissed
- **Domain Whitelist**: Permanently disable scanning for specific domains and subdomains
- **Export Functionality**: Export findings in JSON or CSV format with unmasked values for security analysis
- **Detailed Console Logging**: Full findings with masked values for security
- **Manual Rescanning**: Use the extension popup to rescan updated pages (automatic scanning disabled for performance)
- **Privacy-Focused**: All processing happens locally in your browser

## How It Works
1. The extension injects a content script into every web page
2. It scans the HTML content using advanced regular expressions
3. Found credentials are filtered to reduce false positives
4. Results are displayed via notification popup and detailed console logs
5. Manual rescanning available through extension popup (automatic scanning disabled for better performance)

## Installation

### From Pre-built Package (Recommended)
1. Download the latest `ferretwatch-firefox-v2.2.0.zip` from the dist/ folder
2. Extract the ZIP file to a permanent location on your computer
3. Open Firefox and navigate to `about:debugging`
4. Click "This Firefox" on the left sidebar
5. Click "Load Temporary Add-on..." 
6. Navigate to the extracted folder and select `manifest.json`
7. The extension icon should appear in your toolbar

### From Source Code
1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" on the left sidebar
4. Click "Load Temporary Add-on..." 
5. Navigate to the extension folder and select `manifest.json`
6. The extension icon should appear in your toolbar

## Usage
### Basic Usage
- Simply browse any website - the extension scans automatically on page load
- If credentials are found, you'll see a colored notification in the top-right corner
- Click the notification to dismiss it (won't reappear for same credentials on this page)
- New credentials found on the same page will still trigger notifications
- Open Developer Tools (F12) and check the Console tab for detailed findings
- To rescan a page after content changes, click the extension icon in the toolbar

### Manual Rescanning
- Click the extension icon in Firefox's toolbar to open the popup interface
- Click "Rescan Page" to manually rescan the current page
- Manual rescans will show notifications again (resets dismissed state)
- Useful for single-page applications or pages with dynamic content
- Note: This simplified version has basic popup functionality - full details are in the browser console

### Domain Whitelisting
- **Disable on Current Domain**: Click "Add to Whitelist" in the popup to disable scanning for the current domain
- **Include Subdomains**: When adding to whitelist, choose whether to include all subdomains (e.g., *.example.com)
- **Persistent Storage**: Whitelist settings are saved and persist across browser sessions
- **Easy Management**: View and remove whitelisted domains in Settings > Domain Whitelist
- **Visual Indicators**: Whitelisted domains are clearly marked in the popup interface
- **Examples**:
  - Add `github.com` to disable on GitHub only
  - Add `*.example.com` to disable on example.com and all subdomains
  - Useful for internal company sites, development environments, or trusted domains

### Export Functionality
- **JSON Export**: Click "Export" > "JSON Format" to export findings as structured JSON data
- **CSV Export**: Click "Export" > "CSV Format" to export findings as spreadsheet-compatible CSV
- **Unmasked Values**: Exports contain full credential values for security analysis (handle securely)
- **Comprehensive Data**: Includes domain, URL, credential type, risk level, context, and timestamp
- **Secure Handling**: Delete exported files after analysis to prevent credential exposure

### Testing the Extension
- Create a test HTML page with sample credentials to verify the extension is working
- The extension will detect various credential patterns and show notifications
- You should see multiple credential detections with risk-based color coding

### Understanding the Results
- **Critical Risk**: Database connections, AWS secret keys, private keys
- **High Risk**: Access tokens, API keys, passwords  
- **Medium Risk**: JWT tokens, some API keys
- **Low Risk**: Less sensitive tokens

## Console Output Example
```
🔍 FerretWatch Auto-scanning for credentials...
🚨 Found 5 potential credentials!
1. AWS Access Key ID
   Value: AKIA...AMPLE (Risk: HIGH)
   Context: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
2. Database Connection String  
   Value: mong...p/app (Risk: CRITICAL)
   Context: mongodb://username:password@cluster.mongodb.net/myapp

# On subsequent scans (if notification was dismissed):
🔍 FerretWatch Auto-scanning for credentials...
🔕 Same credentials found (notification dismissed - check console for details)
```

## Customization
You can modify the detection patterns in `config/patterns.js` by editing the `DETECTION_PATTERNS` array. Each pattern includes:
- `regex`: The regular expression to match
- `type`: Description of what it detects  
- `risk`: Risk level (critical/high/medium/low)

## Security Features
- **Unmasked Exports**: Export functionality provides full credential values for security analysis
- **Handle Exports Securely**: Exported files contain sensitive data - delete after analysis
- **Local Processing**: All scanning happens locally, no data sent to external servers
- **Privacy-Focused**: Your browsing data never leaves your device

## Performance Notes
- The extension scans only once per page load to minimize CPU usage
- Automatic rescanning is disabled by default (can be manually enabled in code)
- It processes content efficiently without blocking the browser
- Memory usage is minimal with automatic cleanup
- For dynamic content, use manual rescanning via the extension popup

## Privacy & Security
- **No Data Transmission**: All scanning happens locally in your browser
- **No External Connections**: The extension never sends data to external servers  
- **Masked Console Logging**: Sensitive values are masked in console output for security
- **Unmasked Exports**: Export files contain full credential values for analysis purposes
- **Local Processing Only**: Your browsing data stays on your device
- **Secure Export Handling**: Delete exported files after analysis to prevent credential exposure

## Troubleshooting
- **No notifications appearing**: Check that the extension is loaded in `about:debugging`
- **Console errors**: Look for JavaScript errors in the browser console (F12)
- **False positives**: The extension filters common placeholders but may still detect test values
- **Notifications keep appearing**: Fixed in v1.5.3 - dismissed notifications now stay dismissed for same credentials
- **Rescan/Settings buttons not working**: Fixed in v1.5.4 - popup now has working rescan functionality and proper settings modal
- **Settings page looks broken**: Fixed in v1.5.4 - settings now display in a proper modal interface
- **Domain whitelist not working**: Added in v1.6.0 - persistent domain whitelisting with subdomain support
- **Highlight feature removed**: Removed in v1.6.5 - streamlined interface focuses on core scanning functionality
- **Performance issues**: The extension now scans only once per page to save CPU. For dynamic content, manually rescan using the extension icon
- **High CPU usage**: Automatic rescanning is disabled by default. If you enabled it in the code, set `enableDynamicScanning = false`

## Architecture
This extension uses a professional, modular architecture for maximum reliability:
- `manifest.json`: Extension configuration and permissions
- `content.js`: Main scanning logic and credential detection
- `background.js`: Extension background services
- `popup/`: User interface components (HTML, CSS, JavaScript)
- `config/patterns.js`: Credential detection patterns
- `utils/`: Utility modules for various functionality
- `docs/`: Complete API reference and developer guides

## Disclaimer
This tool is intended for educational and security research purposes only. Do not use it to scan websites without proper authorization. Always respect website terms of service and applicable laws.

## License
MIT License
