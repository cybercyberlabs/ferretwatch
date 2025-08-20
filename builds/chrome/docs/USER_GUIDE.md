# Firefox Credential Scanner - User Guide

## Overview

The Firefox Credential Scanner is a browser extension that automatically detects exposed credentials, API keys, and other sensitive information on web pages. It helps protect you from accidentally exposing or encountering compromised credentials while browsing.

## Table of Contents

1. [Installation](#installation)
2. [Getting Started](#getting-started)
3. [Features Overview](#features-overview)
4. [Using the Extension](#using-the-extension)
5. [Settings & Configuration](#settings--configuration)
6. [Understanding Results](#understanding-results)
7. [Export & Reporting](#export--reporting)
8. [Privacy & Security](#privacy--security)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

## Installation

### From Firefox Add-ons Store (Recommended)
1. Open Firefox browser
2. Visit [Firefox Add-ons store](https://addons.mozilla.org)
3. Search for "Firefox Credential Scanner"
4. Click "Add to Firefox"
5. Confirm installation when prompted

### Manual Installation (Development)
1. Download the extension files
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" 
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file
6. The extension will be loaded temporarily

## Getting Started

### First Time Setup

1. **Extension Icon**: Look for the credential scanner icon in your Firefox toolbar
2. **Initial Scan**: Visit any webpage - the extension automatically scans for credentials
3. **View Results**: Click the extension icon to see scan results
4. **Configure Settings**: Click the settings button to customize behavior

### Quick Tour

```
🔍 Automatic Scanning    → Extension scans pages as you browse
🚨 Real-time Alerts     → Instant notifications for detected credentials  
📊 Results Dashboard    → Click extension icon to view findings
⚙️ Settings Control    → Customize scanning behavior
📤 Export Options      → Save results for analysis
🎨 Visual Highlighting → See credentials highlighted on pages
```

## Features Overview

### Core Features

#### 🔍 **Automatic Credential Detection**
- Scans web pages for 60+ types of credentials and API keys
- Real-time detection as pages load
- Progressive scanning for large pages

#### 🚨 **Risk-Based Alerting** 
- Color-coded alerts based on risk level:
  - 🔴 **Critical**: Full account access (AWS keys, private keys)
  - 🟡 **High**: Significant access (GitHub tokens, API keys)
  - 🟠 **Medium**: Limited access (read-only keys)
  - 🟢 **Low**: Minimal risk (public identifiers)

#### 📊 **Interactive Dashboard**
- View all detected credentials in one place
- Filter by risk level, type, or category  
- Real-time statistics and summaries
- Quick access to settings and controls

#### 🎨 **In-Page Highlighting**
- Highlights detected credentials directly on web pages
- Interactive tooltips with credential information
- Toggle highlighting on/off as needed
- Different colors for different risk levels

#### 📤 **Export & Reporting**
- Export findings to JSON or CSV formats
- Session history tracking
- Detailed metadata including timestamps and URLs
- Share reports with security teams

### Detected Credential Types

| Category | Examples | Risk Level |
|----------|----------|------------|
| **AWS** | Access Keys, Secret Keys, Session Tokens | Critical |
| **GitHub** | Personal Tokens, App Tokens, Fine-grained Tokens | High |
| **API Keys** | Generic API keys, Service-specific keys | High/Medium |
| **Databases** | Connection strings (MySQL, PostgreSQL, MongoDB) | Critical |
| **Certificates** | Private Keys, SSL Certificates, PGP Keys | Critical |
| **Cloud Providers** | Azure, Google Cloud, Digital Ocean | Critical/High |
| **Messaging** | Slack, Discord, Teams tokens | High/Medium |
| **Payment** | Stripe, PayPal keys | Critical |
| **SSH** | Private keys, authorized keys | Critical |
| **JWT** | JSON Web Tokens | Medium |

## Using the Extension

### Basic Operation

#### Automatic Scanning
The extension automatically scans every webpage you visit. No manual action required!

#### Viewing Results  
1. Click the extension icon in the toolbar
2. View the popup dashboard with:
   - **Scan Summary**: Total findings and risk breakdown
   - **Recent Findings**: Latest detected credentials
   - **Quick Actions**: Settings, export, highlighting controls

#### Manual Rescan
- Click the "🔄 Rescan Page" button in the popup
- Useful after page content changes dynamically

### Dashboard Interface

```
┌─────────────────────────────────────────┐
│ 🛡️ Credential Scanner                   │
├─────────────────────────────────────────┤
│ 📊 Scan Results                         │
│ ┌─────┬─────┬─────┬─────┐              │
│ │ 🔴3 │ 🟡5 │ 🟠2 │ 🟢1 │ Risk Level │
│ └─────┴─────┴─────┴─────┘              │
├─────────────────────────────────────────┤
│ 🔍 Recent Findings                      │
│ • AWS Access Key (Critical)             │
│ • GitHub Token (High)                   │
│ • API Key (Medium)                      │
├─────────────────────────────────────────┤
│ ⚙️ Controls                             │
│ [Settings] [Export] [Highlight]         │
└─────────────────────────────────────────┘
```

### In-Page Highlighting

#### Enabling Highlighting
1. Click the extension icon
2. Click "🎨 Toggle Highlighting" button
3. Credentials will be highlighted directly on the page

#### Highlight Features
- **Color Coding**: Different colors for different risk levels
- **Interactive Tooltips**: Hover over highlights for details
- **Click Actions**: Click highlighted text for options
- **Floating Panel**: Shows highlight statistics

#### Highlight Colors
- 🔴 **Red**: Critical risk credentials
- 🟡 **Yellow**: High risk credentials  
- 🟠 **Orange**: Medium risk credentials
- 🟢 **Green**: Low risk credentials

## Settings & Configuration

### Accessing Settings
1. Click the extension icon
2. Click the "⚙️ Settings" button
3. Configure options in the settings modal

### Settings Options

#### 🔍 **Scanning Settings**
- **Enable/Disable Categories**: Toggle detection for specific credential types
- **Risk Threshold**: Set minimum risk level for alerts
- **Scan Delay**: Configure delay for dynamic pages
- **Progressive Scanning**: Enable/disable batch processing

#### 🚨 **Notification Settings**  
- **Alert Style**: Choose notification appearance
- **Alert Duration**: Set how long notifications appear
- **Sound Alerts**: Enable/disable audio notifications
- **Risk-Based Colors**: Customize color scheme

#### 🎨 **Highlighting Settings**
- **Auto-highlight**: Automatically highlight on page load
- **Highlight Colors**: Customize colors for each risk level
- **Tooltip Details**: Configure tooltip information
- **Highlight Persistence**: Keep highlights across page navigation

#### 🌐 **Domain Management**
- **Trusted Domains**: Add domains to skip scanning
- **Whitelist Management**: Import/export domain lists
- **Per-Site Settings**: Configure site-specific behaviors

#### 📊 **Privacy Settings**
- **Data Storage**: Configure what data is stored locally
- **Session History**: Enable/disable result tracking
- **Export Permissions**: Control data export capabilities

### Default Settings

The extension comes with sensible defaults:
- All credential categories enabled
- Medium risk threshold
- Notifications enabled for high/critical findings
- Auto-highlighting disabled (to avoid clutter)
- No domains whitelisted

## Understanding Results

### Risk Levels Explained

#### 🔴 **Critical Risk**
**What it means**: Complete account or system access
**Examples**: AWS secret keys, private keys, database passwords
**Action needed**: Immediate rotation/revocation required
**Potential impact**: Full data breach, system compromise

#### 🟡 **High Risk** 
**What it means**: Significant application or service access
**Examples**: GitHub tokens, API keys with write permissions
**Action needed**: Review and rotate within 24 hours
**Potential impact**: Code repository access, service disruption

#### 🟠 **Medium Risk**
**What it means**: Limited access to specific features
**Examples**: Read-only API keys, webhook URLs
**Action needed**: Review and consider rotation
**Potential impact**: Data exposure, limited functionality access

#### 🟢 **Low Risk**
**What it means**: Minimal security impact
**Examples**: Public client IDs, non-sensitive identifiers
**Action needed**: Review for context appropriateness
**Potential impact**: Information disclosure, limited impact

### Result Details

Each detected credential includes:
- **Type**: Specific credential type (e.g., "AWS Access Key")
- **Category**: Grouping (e.g., "aws", "github", "api-keys")
- **Risk Level**: Security impact assessment
- **Location**: Where on the page it was found
- **Context**: Surrounding text for context
- **Timestamp**: When it was detected

### False Positives

The extension includes filters for common false positives:
- Example/placeholder values (`YOUR_API_KEY`, `example_token`)
- Test credentials (`test_key_123`)
- Documentation examples
- Low-entropy strings

If you encounter false positives:
1. Report them through the feedback system
2. Use domain whitelisting for trusted sites
3. Adjust risk threshold settings

## Export & Reporting

### Export Options

#### 📄 **JSON Export**
- Complete findings data with metadata
- Structured format for programmatic analysis
- Includes timestamps, URLs, and risk assessments
- Best for: Integration with security tools

#### 📊 **CSV Export**
- Spreadsheet-friendly format
- Columns: Type, Risk, Category, URL, Timestamp
- Easy sorting and filtering
- Best for: Manual analysis and reporting

### Export Process
1. Click extension icon
2. Click "📤 Export" button  
3. Choose export format (JSON/CSV)
4. File downloads automatically
5. Open in your preferred tool for analysis

### Session History
- Tracks all findings during your browsing session
- Export entire session data
- Clear history option available
- Useful for security audits

### Report Analysis

#### Sample JSON Export Structure
```json
{
  "metadata": {
    "exportDate": "2024-01-15T10:30:00Z",
    "sessionDuration": "2.5 hours",
    "totalFindings": 15
  },
  "findings": [
    {
      "type": "AWS Access Key",
      "value": "AKIA***EXAMPLE",
      "riskLevel": "critical",
      "category": "aws",
      "url": "https://example.com",
      "timestamp": "2024-01-15T10:25:30Z"
    }
  ]
}
```

## Privacy & Security

### Data Handling

#### What We Store
- User settings and preferences (locally only)
- Session findings history (optional, local storage)
- Domain whitelist (locally only)

#### What We DON'T Store
- Actual credential values (always masked)
- Personal browsing history
- Data on external servers
- User identification information

### Security Measures

#### Credential Masking
- All secret values are masked in logs and exports
- Only partial values shown for identification
- Full values never transmitted or stored

#### Local Storage Only
- All data stored locally in browser
- No external servers or cloud storage
- You control all your data

#### Permission Minimization
- Only requests necessary browser permissions
- Active tab access for scanning
- Local storage for settings
- No network permissions required

### Best Practices

#### For Users
1. **Regular Updates**: Keep extension updated
2. **Review Settings**: Periodically check configuration
3. **Domain Whitelist**: Use for trusted internal sites
4. **Export Data**: Regular backups of important findings

#### For Organizations
1. **Policy Compliance**: Ensure extension meets security policies
2. **Training**: Educate users on interpreting results
3. **Integration**: Use exports for security monitoring
4. **Review Process**: Regular review of findings and actions

## Troubleshooting

### Common Issues

#### Extension Not Working
**Symptoms**: No scan results, extension icon greyed out
**Solutions**:
- Refresh the page
- Check if extension is enabled in `about:addons`
- Restart Firefox browser
- Reload extension in `about:debugging`

#### No Credentials Detected  
**Symptoms**: Extension working but no results on pages with credentials
**Solutions**:
- Check risk threshold settings
- Verify credential categories are enabled
- Try manual rescan
- Check if domain is whitelisted

#### Too Many False Positives
**Symptoms**: Extension detecting non-sensitive content as credentials
**Solutions**:
- Increase risk threshold
- Add domains to whitelist
- Adjust category settings
- Report false positives for improvement

#### Performance Issues
**Symptoms**: Page loading slowly, browser becoming unresponsive
**Solutions**:
- Disable auto-highlighting on large pages
- Increase scan delay setting
- Clear session history
- Restart browser

#### Export Not Working
**Symptoms**: Export button not responding or files not downloading
**Solutions**:
- Check Firefox download permissions
- Clear browser cache
- Try different export format
- Check disk space

### Error Messages

#### "Scanning failed for this page"
- **Cause**: Page content not accessible or parsing error
- **Solution**: Refresh page, try manual rescan

#### "Storage quota exceeded"  
- **Cause**: Too much session history stored
- **Solution**: Clear session history, reduce retention settings

#### "Extension permissions required"
- **Cause**: Missing browser permissions
- **Solution**: Check extension permissions in browser settings

### Getting Help

#### Self-Help Resources
1. Check this user guide
2. Review FAQ section below
3. Test with known credential examples
4. Check browser console for errors

#### Reporting Issues
When reporting problems, include:
- Firefox version and extension version
- Steps to reproduce the issue
- Expected vs actual behavior
- Console error messages (if any)
- Example URL (if public)

## FAQ

### General Questions

**Q: Does this extension send my data anywhere?**
A: No, all scanning and storage happens locally in your browser. No data is transmitted to external servers.

**Q: Will this slow down my browsing?**  
A: The extension is optimized for performance with progressive scanning and minimal impact on page loading.

**Q: Can I use this on internal company websites?**
A: Yes, but consider adding trusted internal domains to the whitelist to reduce noise from legitimate credential usage.

### Technical Questions

**Q: What types of credentials are detected?**
A: 60+ types including AWS keys, GitHub tokens, API keys, database credentials, private keys, and more.

**Q: How accurate is the detection?**
A: The extension uses sophisticated pattern matching with entropy analysis and false positive filtering for high accuracy.

**Q: Can I add custom credential patterns?**
A: Currently not supported in the user interface, but the extension is designed to be extensible for future updates.

### Privacy Questions

**Q: Are my credentials stored anywhere?**
A: No, actual credential values are never stored. Only masked versions for identification are kept locally.

**Q: Can other websites see my scan results?**
A: No, scan results are isolated per tab and only accessible through the extension interface.

**Q: How do I completely remove all extension data?**
A: Remove the extension from Firefox, which will delete all locally stored settings and data.

### Usage Questions

**Q: Should I be concerned about every detected credential?**
A: Focus on Critical and High risk findings first. Low risk items may be acceptable depending on context.

**Q: What should I do if I find credentials on a public website?**
A: Consider reporting to the website owner through responsible disclosure practices.

**Q: Can I use this for security auditing?**
A: Yes, the export functionality makes it suitable for security assessments and compliance auditing.

### Troubleshooting Questions

**Q: Why isn't the extension detecting obvious credentials?**
A: Check that the credential type is enabled in settings and that your risk threshold isn't set too high.

**Q: How do I stop false positives on a trusted site?**
A: Add the domain to your whitelist in the extension settings.

**Q: The highlighting is interfering with page functionality.**
A: Disable auto-highlighting in settings or toggle it off for specific pages.

## Getting Support

### Community Resources
- User forums and discussions
- GitHub issues for bug reports
- Documentation and guides

### Professional Support
For enterprise users or security teams:
- Extended configuration guidance
- Custom pattern development
- Integration assistance
- Security consultation

## Conclusion

The Firefox Credential Scanner Extension is a powerful tool for detecting exposed credentials and maintaining browsing security. By understanding its features and configuring it appropriately for your needs, you can significantly improve your security posture while browsing the web.

Remember to:
- Keep the extension updated
- Review and act on critical findings promptly  
- Use export functionality for security reporting
- Configure settings appropriate to your environment
- Report issues to help improve the extension

Stay secure and happy browsing! 🛡️
