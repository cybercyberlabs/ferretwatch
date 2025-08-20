# FerretWatch v2.0.0 - Production Release

## 🎉 Major Release Features

### New Features
- **Professional UI**: Complete redesign with clean, modern interface
- **Export Functionality**: Export findings in JSON or CSV format with unmasked values for security analysis
- **Domain Whitelist Management**: Visual interface to add, view, and remove whitelisted domains
- **Risk-Based Color Coding**: Clear visual indicators for Critical, High, Medium, and Low risk credentials
- **Smart Notification System**: Dismissed notifications stay dismissed until new credentials are found
- **Unmasked Exports**: Security analysts can export full credential values for comprehensive analysis

### Core Improvements  
- **Enhanced Pattern Detection**: 15+ credential types with improved accuracy
- **Reduced False Positives**: Smart filtering of test/placeholder values
- **Performance Optimization**: Single-scan per page load with manual rescan option
- **Persistent Storage**: Whitelist settings saved across browser sessions
- **Professional Branding**: Complete rebrand to FerretWatch with CyberCyberLabs attribution

### Security & Privacy
- **Local Processing Only**: All scanning happens in your browser, no external data transmission
- **Masked Console Logging**: Sensitive values are masked in console for security
- **Unmasked Exports**: Full credential values in exports for security analysis (handle securely)
- **No Data Collection**: Your browsing data never leaves your device

## 🔧 Technical Details

### Architecture
- Modular design with separate content scripts, background services, and utility modules
- Cross-browser compatibility (Firefox, Chrome, Edge)
- Manifest V2 for Firefox, V3 for Chromium browsers
- Professional build system with automated packaging

### Detection Capabilities
- AWS Access Keys and Secret Keys
- GitHub Personal Access Tokens  
- API Keys (Google, Stripe, and generic patterns)
- Database Connection Strings (MongoDB, MySQL, PostgreSQL, Redis)
- JWT Tokens and Bearer Tokens
- SSH Private Keys
- Slack and Discord Bot Tokens
- Basic Password Patterns

### Export Formats
- **JSON**: Structured data with metadata, timestamps, and risk assessment
- **CSV**: Spreadsheet-compatible format for analysis tools
- **Secure Handling**: Exports contain unmasked values - delete after analysis

## 📋 Installation

### From Pre-built Package (Recommended)
1. Download `ferretwatch-firefox-v2.0.0.zip` from the dist/ folder
2. Extract to a permanent location on your computer
3. Open Firefox → `about:debugging` → "This Firefox"
4. Click "Load Temporary Add-on..." and select `manifest.json`
5. The FerretWatch icon will appear in your toolbar

### Browser Compatibility
- **Firefox**: Full support with Manifest V2
- **Chrome**: Full support with Manifest V3 compatibility  
- **Edge**: Full support with Manifest V3 compatibility

## 🚀 Usage Guide

### Basic Scanning
- Browse any website - FerretWatch scans automatically on page load
- Color-coded notifications appear for detected credentials
- Click notifications to dismiss (won't reappear for same credentials)
- Check browser console (F12) for detailed findings with masked values

### Manual Rescanning  
- Click the FerretWatch icon in your toolbar
- Click "Rescan Page" to scan dynamic content or updated pages
- Manual rescans will show notifications again (resets dismissed state)

### Domain Whitelisting
- Click "Add to Whitelist" to disable scanning on current domain
- Choose domain-only or include all subdomains
- Manage whitelist in Settings → Domain Whitelist
- Visual indicators show whitelisted domains

### Exporting Findings
- Click "Export" dropdown for JSON or CSV formats
- Exports contain full unmasked credential values for analysis
- Handle exported files securely and delete after use
- Includes comprehensive metadata and risk assessment

## 🛡️ Security Considerations

### For Security Analysts
- **Unmasked Exports**: Export files contain full credential values for analysis
- **Secure Handling**: Delete exported files immediately after analysis
- **Local Processing**: All data stays on your device, no external transmission
- **Risk Assessment**: Built-in risk scoring for prioritizing findings

### For Developers
- **Development Sites**: Use whitelist feature for internal/development domains
- **False Positives**: Extension filters common test values but may detect valid test credentials
- **Performance**: Single scan per page load minimizes CPU usage
- **Privacy**: No data collection or external connections

## 📞 Support & Development

**Created by CyberCyberLabs**
- 🌐 GitHub: [https://github.com/cybercyberlabs](https://github.com/cybercyberlabs)
- 🔗 Website: [cybercyberlabs.com](https://cybercyberlabs.com)

### Reporting Issues
- Report bugs or feature requests via GitHub Issues
- Include browser version, extension version, and error details
- Provide sanitized examples (never include actual credentials)

### Contributing
- Extension uses professional modular architecture
- See `docs/DEVELOPER_GUIDE.md` for development setup
- All contributions welcome via GitHub Pull Requests

## 📜 License

MIT License - See LICENSE file for details

## ⚠️ Disclaimer

This tool is intended for educational and authorized security research purposes only. Do not use it to scan websites without proper authorization. Always respect website terms of service and applicable laws.

---

**FerretWatch v2.0.0** - Professional credential scanning for security analysts and developers.
