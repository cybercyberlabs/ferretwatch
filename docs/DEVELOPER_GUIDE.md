# Firefox Credential Scanner - Developer Guide

## Overview

This guide provides comprehensive information for developers working on the Firefox Credential Scanner Extension. It covers architecture, code organization, development workflows, and contribution guidelines.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Code Structure](#code-structure)
3. [Pattern System](#pattern-system)
4. [Adding New Patterns](#adding-new-patterns)
5. [Development Workflow](#development-workflow)
6. [Testing Procedures](#testing-procedures)
7. [Performance Considerations](#performance-considerations)
8. [Security Guidelines](#security-guidelines)
9. [Browser Extension APIs](#browser-extension-apis)
10. [Contributing](#contributing)

## Architecture Overview

The extension follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Content Script │    │   Background    │    │   Popup/UI      │
│   (content.js)   │    │   (background)  │    │   (popup/)      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Page scanning  │    │ • Storage mgmt  │    │ • User controls │
│ • DOM injection  │    │ • Settings sync │    │ • Results view  │
│ • Highlighting   │    │ • Notifications │    │ • Export tools  │
│ • Event handling │    │ • Cross-tab com │    │ • Settings UI   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Utilities     │
                    │   (utils/)      │
                    ├─────────────────┤
                    │ • Scanner engine│
                    │ • Pattern config│
                    │ • Export system │
                    │ • Context filter│
                    │ • Entropy calc  │
                    └─────────────────┘
```

### Key Components

1. **Content Script** (`content.js`)
   - Scans page content for credentials
   - Manages in-page highlighting
   - Handles user interactions with highlighted elements

2. **Popup Interface** (`popup/`)
   - Displays scan results and statistics
   - Provides user controls and settings
   - Manages export functionality

3. **Utility Modules** (`utils/`)
   - Modular scanning engine
   - Pattern configuration system
   - Export and storage utilities
   - **Cloud bucket parsing and testing utilities**

4. **Configuration** (`config/`)
   - Pattern definitions and metadata
   - Risk level classifications
   - Default settings
   - **Cloud storage bucket patterns**

## Code Structure

### File Organization

```
firefox-addon/
├── manifest.json                 # Extension manifest
├── content.js                   # Main content script
├── config/
│   └── patterns.js             # Pattern definitions
├── popup/
│   ├── popup.html              # Popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styling
├── utils/
│   ├── scanner.js             # Core scanning engine
│   ├── entropy.js             # Entropy calculations
│   ├── masking.js             # Secret masking
│   ├── export.js              # Export functionality
│   ├── storage.js             # Storage operations
│   ├── context.js             # Context filtering
│   ├── highlighting.js        # Page highlighting
│   ├── bucket-parser.js       # Cloud bucket URL parsing
│   └── bucket-tester.js       # Cloud bucket accessibility testing
├── tests/
│   ├── framework.js           # Testing framework
│   ├── test-runner.js         # Test orchestrator
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── performance/           # Performance tests
└── docs/
    ├── DEVELOPER_GUIDE.md                      # This document
    ├── USER_GUIDE.md                           # User documentation
    ├── API_REFERENCE.md                        # API documentation
    ├── BUCKET_SCANNING_SETTINGS.md             # Bucket scanning configuration
    ├── BUCKET_SCANNING_TROUBLESHOOTING.md      # Troubleshooting guide
    ├── BUCKET_SCANNING_CONFIGURATION_EXAMPLES.md # Configuration examples
    └── BUCKET_SCANNING_SECURITY_GUIDE.md       # Security and responsible usage
```

### Code Style Guidelines

- **ES6+ JavaScript**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over callbacks
- **Module Pattern**: Use ES6 modules where possible
- **Naming Conventions**:
  - Variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Functions: `camelCase`
  - Classes: `PascalCase`
- **Documentation**: Use JSDoc for all public functions

## Pattern System

### Pattern Structure

Patterns are defined in `config/patterns.js` with the following structure:

```javascript
const PATTERNS = {
    aws: {
        name: 'AWS Credentials',
        patterns: [
            {
                type: 'AWS Access Key',
                regex: /AKIA[0-9A-Z]{16}/g,
                riskLevel: 'critical',
                category: 'aws',
                description: 'AWS Access Key ID',
                examples: ['AKIAIOSFODNN7EXAMPLE'],
                falsePositives: ['AKIAEXAMPLEEXAMPLE']
            }
        ]
    }
};
```

### Pattern Properties

- **type**: Human-readable name for the credential type
- **regex**: Regular expression for matching
- **riskLevel**: One of 'low', 'medium', 'high', 'critical'
- **category**: Grouping category (aws, github, api-keys, etc.)
- **description**: Detailed description of the pattern
- **examples**: Array of valid example matches
- **falsePositives**: Known false positive patterns to filter out

### Risk Level Classification

| Level | Description | Examples |
|-------|-------------|----------|
| **Critical** | Complete account access | AWS keys, private keys, database passwords |
| **High** | Significant access | GitHub tokens, API keys with write access, open cloud buckets |
| **Medium** | Limited access | Read-only API keys, webhooks, secured cloud buckets |
| **Low** | Minimal risk | Public identifiers, non-sensitive tokens |

## Adding New Patterns

### Step 1: Define the Pattern

Add to `config/patterns.js`:

```javascript
// Example: Adding Stripe API key pattern
stripe: {
    name: 'Stripe',
    patterns: [
        {
            type: 'Stripe Secret Key',
            regex: /sk_live_[0-9a-zA-Z]{24}/g,
            riskLevel: 'critical',
            category: 'payment',
            description: 'Stripe live secret key for payment processing',
            examples: ['sk_live_1234567890abcdef12345678'],
            falsePositives: ['sk_live_test', 'sk_live_example']
        }
    ]
}
```

### Step 2: Add Unit Tests

Create tests in `tests/unit/patterns.test.js`:

```javascript
testFramework.test('Should detect Stripe secret keys', async () => {
    const testContent = 'const key = "sk_live_1234567890abcdef12345678";';
    const findings = await mockScanner.scan(testContent);
    
    const stripeFindings = findings.filter(f => f.category === 'payment');
    Assert.ok(stripeFindings.length > 0, 'Should detect Stripe keys');
    Assert.equal(stripeFindings[0].riskLevel, 'critical', 'Should have critical risk level');
});
```

### Step 3: Update Documentation

1. Update pattern count in README
2. Add to pattern list in user guide
3. Document any special handling requirements

### Step 4: Test the Pattern

```bash
# Run pattern-specific tests
node tests/unit/patterns.test.js

# Run full test suite
node tests/test-runner.js
```

## Cloud Bucket Pattern System

### Bucket Pattern Structure

Cloud bucket patterns are defined in `config/patterns.js` under the `cloudStorage` category:

```javascript
cloudStorage: {
    name: 'Cloud Storage Buckets',
    patterns: [
        {
            type: 'AWS S3 Bucket',
            regex: /(?:s3:\/\/|https?:\/\/(?:[\w\-]+\.)?s3(?:[\w\-\.]*)?\.amazonaws\.com\/?)[\w\-\.\/]+/gi,
            riskLevel: 'medium',
            category: 'cloudStorage',
            description: 'AWS S3 bucket URL that may be publicly accessible',
            provider: 'aws',
            examples: [
                's3://my-bucket',
                'https://my-bucket.s3.amazonaws.com/',
                'https://s3.amazonaws.com/my-bucket'
            ]
        }
    ]
}
```

### Bucket-Specific Properties

- **provider**: Cloud provider identifier (aws, gcp, azure, digitalocean, alibaba)
- **testEndpoint**: Optional custom endpoint for accessibility testing
- **regionPattern**: Regex to extract region from URL
- **bucketNamePattern**: Regex to extract bucket name

### Adding New Cloud Providers

1. **Define Provider Patterns**
   ```javascript
   // Example: Adding Backblaze B2
   backblazeB2: {
       type: 'Backblaze B2 Bucket',
       regex: /https?:\/\/[\w\-]+\.backblazeb2\.com\/[\w\-\.\/]+/gi,
       riskLevel: 'medium',
       category: 'cloudStorage',
       provider: 'backblaze',
       description: 'Backblaze B2 bucket URL'
   }
   ```

2. **Update Bucket Parser**
   ```javascript
   // In utils/bucket-parser.js
   static parseBucketUrl(url, provider) {
       switch (provider) {
           case 'backblaze':
               return this.parseBackblazeUrl(url);
           // ... other providers
       }
   }
   ```

3. **Update Bucket Tester**
   ```javascript
   // In utils/bucket-tester.js
   async testBucketAccess(bucketInfo) {
       switch (bucketInfo.provider) {
           case 'backblaze':
               return await this.testBackblazeBucket(bucketInfo);
           // ... other providers
       }
   }
   ```

### Bucket Testing Integration

The bucket scanning system integrates with the main scanner through:

1. **Pattern Detection**: Standard pattern matching in scanner.js
2. **URL Parsing**: Extract bucket details using bucket-parser.js
3. **Accessibility Testing**: Test public access using bucket-tester.js
4. **Result Processing**: Generate findings with bucket metadata

## Development Workflow

### Setting Up Development Environment

1. **Clone and Setup**:
   ```bash
   git clone <repository-url>
   cd firefox-addon
   ```

2. **Load Extension in Firefox**:
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

3. **Development Tools**:
   - Use Firefox Developer Tools for debugging
   - Console logs appear in the extension's console
   - Use `about:addons` for extension management

### Hot Reloading During Development

Firefox doesn't support hot reloading, but you can:

1. Make code changes
2. Go to `about:debugging`
3. Click "Reload" next to your extension
4. Refresh any test pages

### Debugging Techniques

#### Content Script Debugging
```javascript
// Add debug logging
if (typeof browser !== 'undefined' && browser.runtime) {
    console.log('[Credential Scanner]', 'Debug message');
}

// Use browser DevTools
// Right-click page -> Inspect -> Console tab
```

#### Background Script Debugging
```javascript
// Access via about:debugging -> Inspect
console.log('Background script message');
```

#### Popup Debugging
```javascript
// Right-click extension icon -> Inspect popup
console.log('Popup debug message');
```

## Testing Procedures

### Running Tests

#### Browser Testing (Recommended)
```bash
# Open in Firefox
firefox tests/test-runner.html
```

#### Command Line Testing
```bash
# All tests
node tests/test-runner.js

# Specific test suites
node tests/test-runner.js --unit-only
node tests/test-runner.js --no-performance
```

### Test Types

#### Unit Tests
- Test individual functions and modules
- Mock external dependencies
- Focus on edge cases and error conditions

```javascript
testFramework.test('Entropy calculation should be accurate', () => {
    const entropy = calculateEntropy('password123');
    Assert.ok(entropy > 3.0, 'Password should have reasonable entropy');
});
```

#### Integration Tests
- Test complete workflows
- Verify component interactions
- Test with realistic data

```javascript
testFramework.test('Complete scanning workflow', async () => {
    const scanner = new Scanner();
    const results = await scanner.scanPage(mockPageContent);
    Assert.ok(results.length > 0, 'Should find credentials');
});
```

#### Performance Tests
- Benchmark execution times
- Monitor memory usage
- Test scalability limits

```javascript
testFramework.test('Large page scanning performance', async () => {
    const startTime = performance.now();
    await scanner.scanLargeContent(largeMockContent);
    const duration = performance.now() - startTime;
    Assert.ok(duration < 500, 'Should complete within 500ms');
});
```

### Test Coverage Goals

- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: All major workflows
- **Performance Tests**: All critical paths
- **Browser Tests**: Firefox, Chrome compatibility

## Performance Considerations

### Scanning Performance

#### Best Practices
1. **Batch Processing**: Process content in chunks
2. **Debouncing**: Avoid excessive rescanning
3. **Efficient Patterns**: Optimize regex performance
4. **Early Termination**: Stop scanning when limits reached

```javascript
// Good: Batch processing
async function scanInBatches(content, batchSize = 1000) {
    const results = [];
    for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);
        results.push(...await scanBatch(batch));
    }
    return results;
}

// Avoid: Processing entire content at once
function scanAll(content) {
    return scanEntireContent(content); // May block UI
}
```

### Memory Management

#### Strategies
1. **Cleanup Event Listeners**: Remove when not needed
2. **Limit Result Storage**: Cap number of stored results
3. **Efficient Data Structures**: Use appropriate collections
4. **Garbage Collection**: Help GC by nullifying references

```javascript
// Good: Cleanup
function cleanup() {
    document.removeEventListener('scroll', handleScroll);
    resultsCache.clear();
    highlightElements = null;
}

// Monitor memory usage
function checkMemoryUsage() {
    if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / 1024 / 1024;
        if (used > 50) { // 50MB threshold
            triggerCleanup();
        }
    }
}
```

### UI Performance

#### Recommendations
1. **Async Operations**: Keep UI responsive
2. **Progressive Loading**: Show results as they're found
3. **Virtualization**: For large result lists
4. **Throttled Updates**: Limit update frequency

## Security Guidelines

### Secret Handling

#### Never Log Secrets
```javascript
// BAD: Logs actual secret
console.log('Found secret:', secretValue);

// GOOD: Use masking
console.log('Found secret:', maskSecret(secretValue));

function maskSecret(secret) {
    if (secret.length <= 6) return '***';
    return secret.slice(0, 3) + '***' + secret.slice(-3);
}
```

#### Secure Storage
```javascript
// Store settings securely
await browser.storage.local.set({
    settings: {
        // Never store actual credentials
        enabledCategories: ['aws', 'github'],
        riskThreshold: 'medium'
    }
});
```

### Input Validation

```javascript
function validatePattern(pattern) {
    if (!pattern || typeof pattern !== 'object') {
        throw new Error('Invalid pattern object');
    }
    
    if (!pattern.regex || !(pattern.regex instanceof RegExp)) {
        throw new Error('Pattern must have valid regex');
    }
    
    if (!VALID_RISK_LEVELS.includes(pattern.riskLevel)) {
        throw new Error('Invalid risk level');
    }
}
```

### Content Security

#### Sanitize DOM Content
```javascript
function sanitizeContent(content) {
    // Remove script tags and potentially dangerous content
    return content.replace(/<script[\s\S]*?<\/script>/gi, '');
}
```

## Browser Extension APIs

### Storage API Usage

```javascript
// Get settings
const settings = await browser.storage.local.get('userSettings');

// Save settings
await browser.storage.local.set({
    userSettings: newSettings
});

// Listen for changes
browser.storage.onChanged.addListener((changes, namespace) => {
    if (changes.userSettings) {
        updateUI(changes.userSettings.newValue);
    }
});
```

### Messaging Between Components

```javascript
// Content script to background
browser.runtime.sendMessage({
    type: 'SCAN_RESULT',
    data: scanResults
});

// Background script listener
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'SCAN_RESULT') {
        handleScanResults(message.data, sender.tab.id);
    }
});
```

### Permissions Management

Current required permissions:
- `activeTab`: Access current tab content
- `storage`: Store user settings
- `notifications`: Show scan results

### Cross-Browser Compatibility

#### Firefox vs Chrome API Differences
```javascript
// Use browser namespace (Firefox) or chrome (Chrome)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Handle callback vs promise differences
function storageGet(key) {
    if (typeof browser !== 'undefined') {
        // Firefox - returns Promise
        return browser.storage.local.get(key);
    } else {
        // Chrome - uses callbacks
        return new Promise(resolve => {
            chrome.storage.local.get(key, resolve);
        });
    }
}
```

## Contributing

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] New patterns include unit tests
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Documentation updated
- [ ] Cross-browser compatibility verified

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-pattern-support
   ```

2. **Make Changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation

3. **Test Thoroughly**
   ```bash
   node tests/test-runner.js
   ```

4. **Submit Pull Request**
   - Clear description of changes
   - Reference any related issues
   - Include test results

### Commit Message Format

```
type(scope): description

Examples:
feat(patterns): add Stripe API key detection
fix(scanner): resolve memory leak in large pages  
docs(readme): update installation instructions
test(unit): add entropy calculation tests
```

### Issue Reporting

When reporting bugs:
1. **Extension version** and browser version
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Console errors** (if any)
5. **Test page URL** (if public)

### Feature Requests

Include:
1. **Use case description**
2. **Proposed implementation** (if applicable)
3. **Alternative solutions** considered
4. **Impact assessment** (performance, security)

## API Reference

### Core Scanner API

```javascript
class Scanner {
    async scanContent(content, options = {})
    async scanPage()
    getResults()
    clearResults()
    updateConfig(newConfig)
}
```

### Pattern Utilities

```javascript
function validatePattern(pattern)
function compilePatterns(patternConfig)
function calculateRiskScore(findings)
function filterFalsePositives(results)
```

### Export Utilities

```javascript
function exportToJSON(findings, metadata)
function exportToCSV(findings)
function generateReport(sessionData)
```

## Troubleshooting

### Common Development Issues

#### Extension Not Loading
- Check manifest.json syntax
- Verify all referenced files exist
- Check browser console for errors

#### Patterns Not Matching
- Test regex patterns in isolation
- Check for escaping issues
- Verify pattern compilation

#### Performance Issues
- Profile with browser DevTools
- Check for infinite loops in patterns
- Monitor memory usage

#### Storage Issues
- Verify permission in manifest
- Check async/await usage
- Handle storage quota limits

### Debug Configuration

Enable debug mode:
```javascript
// In content.js
const DEBUG_MODE = true;

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[Credential Scanner Debug]', ...args);
    }
}
```

## Resources

- [Firefox Extension Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Regular Expression Testing](https://regex101.com/)
- [Security Best Practices](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Security_best_practices)

## Conclusion

This developer guide provides the foundation for contributing to and maintaining the Firefox Credential Scanner Extension. For questions not covered here, please check the existing issues or create a new one for discussion.

Remember to always prioritize security and performance when making changes, and ensure comprehensive testing before submitting contributions.
