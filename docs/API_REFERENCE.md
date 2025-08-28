# Firefox Credential Scanner - API Reference

## Overview

This document provides detailed API reference for the Firefox Credential Scanner Extension, covering all public interfaces, classes, and utility functions.

## Table of Contents

1. [Core Scanner API](#core-scanner-api)
2. [Pattern Configuration API](#pattern-configuration-api)
3. [Export System API](#export-system-api)
4. [Storage Utilities API](#storage-utilities-api)
5. [Context Filtering API](#context-filtering-api)
6. [Entropy Analysis API](#entropy-analysis-api)
7. [Masking Utilities API](#masking-utilities-api)
8. [Highlighting System API](#highlighting-system-api)
9. [Cloud Bucket Scanning API](#cloud-bucket-scanning-api)
10. [Browser Extension APIs](#browser-extension-apis)
11. [Testing Framework API](#testing-framework-api)

---

## Core Scanner API

### Scanner Class

The main scanning engine for credential detection.

```javascript
class Scanner {
    constructor(config = {})
    async scanContent(content, options = {})
    async progressiveScan(content, patterns, options = {})
    getResults()
    clearResults()
    updateConfig(newConfig)
    getStats()
}
```

#### Constructor

```javascript
/**
 * Creates a new Scanner instance
 * @param {Object} config - Scanner configuration
 * @param {boolean} config.enableProgressiveScan - Enable batch processing
 * @param {boolean} config.enableEntropyFilter - Enable entropy filtering
 * @param {boolean} config.enableContextFilter - Enable context filtering
 * @param {number} config.batchSize - Size of scanning batches
 */
new Scanner({
    enableProgressiveScan: true,
    enableEntropyFilter: true,
    enableContextFilter: true,
    batchSize: 1000
})
```

#### Methods

##### scanContent()

```javascript
/**
 * Scans content for credentials
 * @param {string} content - Content to scan
 * @param {Object} options - Scan options
 * @param {Array} options.patterns - Custom patterns to use
 * @param {string} options.riskThreshold - Minimum risk level
 * @param {boolean} options.includeContext - Include surrounding context
 * @returns {Promise<Array<Finding>>} Array of detected credentials
 */
async scanContent(content, options = {})
```

**Example:**
```javascript
const scanner = new Scanner();
const findings = await scanner.scanContent(pageContent, {
    riskThreshold: 'medium',
    includeContext: true
});
```

##### progressiveScan()

```javascript
/**
 * Performs progressive scanning for large content
 * @param {string} content - Content to scan
 * @param {Object} patterns - Pattern configuration
 * @param {Object} options - Scan options
 * @returns {Promise<Array<Finding>>} Scan results
 */
async progressiveScan(content, patterns, options = {})
```

##### getResults()

```javascript
/**
 * Gets current scan results
 * @returns {Array<Finding>} Current findings
 */
getResults()
```

##### clearResults()

```javascript
/**
 * Clears all stored results
 * @returns {void}
 */
clearResults()
```

##### updateConfig()

```javascript
/**
 * Updates scanner configuration
 * @param {Object} newConfig - New configuration options
 * @returns {void}
 */
updateConfig(newConfig)
```

##### getStats()

```javascript
/**
 * Gets scanning statistics
 * @returns {Object} Statistics object
 */
getStats()
```

**Returns:**
```javascript
{
    totalScans: number,
    totalFindings: number,
    averageScanTime: number,
    lastScanTime: number,
    categoryBreakdown: Object
}
```

---

## Pattern Configuration API

### Pattern Object Structure

```javascript
{
    type: string,           // Human-readable credential type
    regex: RegExp,          // Regular expression for matching
    riskLevel: string,      // 'low', 'medium', 'high', 'critical'
    category: string,       // Pattern category
    description: string,    // Detailed description
    examples: Array<string>, // Valid examples
    falsePositives: Array<string> // Known false positives
}
```

### PatternManager Class

```javascript
class PatternManager {
    constructor(patterns = {})
    validatePattern(pattern)
    compilePatterns(patternConfig)
    getCategoryPatterns(category)
    getRiskLevelPatterns(riskLevel)
    addCustomPattern(category, pattern)
}
```

#### Methods

##### validatePattern()

```javascript
/**
 * Validates a pattern object
 * @param {Object} pattern - Pattern to validate
 * @throws {Error} If pattern is invalid
 * @returns {boolean} True if valid
 */
validatePattern(pattern)
```

##### compilePatterns()

```javascript
/**
 * Compiles pattern configuration for optimized scanning
 * @param {Object} patternConfig - Pattern configuration object
 * @returns {Object} Compiled patterns
 */
compilePatterns(patternConfig)
```

##### getCategoryPatterns()

```javascript
/**
 * Gets patterns for a specific category
 * @param {string} category - Category name
 * @returns {Array<Object>} Category patterns
 */
getCategoryPatterns(category)
```

### Pattern Categories

| Category | Description | Risk Levels |
|----------|-------------|-------------|
| `aws` | Amazon Web Services credentials | Critical, High |
| `github` | GitHub tokens and keys | High, Medium |
| `api-keys` | Generic API keys | High, Medium, Low |
| `databases` | Database connection strings | Critical |
| `certificates` | SSL/TLS certificates and keys | Critical |
| `cloud` | Cloud provider credentials | Critical, High |
| `messaging` | Chat/messaging platform tokens | High, Medium |
| `payment` | Payment processor keys | Critical |

---

## Export System API

### ExportManager Class

```javascript
class ExportManager {
    constructor()
    exportToJSON(findings, metadata = {})
    exportToCSV(findings, metadata = {})
    generateReport(sessionData)
    getSessionHistory()
    clearSessionHistory()
}
```

#### Methods

##### exportToJSON()

```javascript
/**
 * Exports findings to JSON format
 * @param {Array<Finding>} findings - Findings to export
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Export data object
 */
exportToJSON(findings, metadata = {})
```

**Returns:**
```javascript
{
    metadata: {
        exportDate: string,
        format: 'json',
        findingsCount: number,
        sessionId: string,
        ...customMetadata
    },
    findings: Array<Finding>
}
```

##### exportToCSV()

```javascript
/**
 * Exports findings to CSV format
 * @param {Array<Finding>} findings - Findings to export
 * @param {Object} metadata - Additional metadata
 * @returns {string} CSV formatted data
 */
exportToCSV(findings, metadata = {})
```

##### generateReport()

```javascript
/**
 * Generates comprehensive report
 * @param {Object} sessionData - Complete session data
 * @returns {Object} Detailed report
 */
generateReport(sessionData)
```

### Finding Object Structure

```javascript
{
    id: string,              // Unique finding ID
    type: string,            // Credential type
    value: string,           // Masked credential value
    riskLevel: string,       // Risk assessment
    category: string,        // Pattern category
    url: string,             // Source URL
    timestamp: number,       // Detection timestamp
    context: string,         // Surrounding context
    metadata: Object         // Additional metadata
}
```

---

## Storage Utilities API

### StorageManager Class

```javascript
class StorageManager {
    async getSettings()
    async saveSettings(settings)
    async getSessionData()
    async saveSessionData(data)
    async clearStorage()
    onStorageChanged(callback)
}
```

#### Methods

##### getSettings()

```javascript
/**
 * Retrieves user settings
 * @returns {Promise<Object>} User settings
 */
async getSettings()
```

##### saveSettings()

```javascript
/**
 * Saves user settings
 * @param {Object} settings - Settings to save
 * @returns {Promise<void>}
 */
async saveSettings(settings)
```

##### onStorageChanged()

```javascript
/**
 * Listens for storage changes
 * @param {Function} callback - Change handler
 * @returns {void}
 */
onStorageChanged(callback)
```

**Callback signature:**
```javascript
(changes, namespace) => {
    // changes: Object with changed keys
    // namespace: 'local' or 'sync'
}
```

---

## Context Filtering API

### ContextFilter Class

```javascript
class ContextFilter {
    constructor(config = {})
    shouldSkipElement(element)
    filterByContext(findings, content)
    isMinifiedCode(content)
    extractContext(content, position, length)
}
```

#### Methods

##### shouldSkipElement()

```javascript
/**
 * Determines if element should be skipped during scanning
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if element should be skipped
 */
shouldSkipElement(element)
```

**Skipped elements:**
- `<script>` tags
- `<style>` tags  
- `<noscript>` tags
- Hidden elements (`display: none`)
- Minified code blocks

##### filterByContext()

```javascript
/**
 * Filters findings based on context analysis
 * @param {Array<Finding>} findings - Raw findings
 * @param {string} content - Original content
 * @returns {Array<Finding>} Filtered findings
 */
filterByContext(findings, content)
```

##### isMinifiedCode()

```javascript
/**
 * Detects minified JavaScript/CSS
 * @param {string} content - Content to analyze
 * @returns {boolean} True if content appears minified
 */
isMinifiedCode(content)
```

---

## Entropy Analysis API

### EntropyCalculator Class

```javascript
class EntropyCalculator {
    static calculate(string)
    static isHighEntropy(string, threshold = 3.5)
    static analyzePattern(matches)
    static filterLowEntropy(findings, threshold = 3.0)
}
```

#### Methods

##### calculate()

```javascript
/**
 * Calculates Shannon entropy for a string
 * @param {string} string - String to analyze
 * @returns {number} Entropy value (0-8)
 */
static calculate(string)
```

**Example:**
```javascript
const entropy = EntropyCalculator.calculate('password123'); // ~3.2
const entropy2 = EntropyCalculator.calculate('X9kL2mN8qP5wR3'); // ~3.9
```

##### isHighEntropy()

```javascript
/**
 * Determines if string has high entropy
 * @param {string} string - String to test
 * @param {number} threshold - Entropy threshold (default: 3.5)
 * @returns {boolean} True if high entropy
 */
static isHighEntropy(string, threshold = 3.5)
```

##### filterLowEntropy()

```javascript
/**
 * Filters out low entropy findings
 * @param {Array<Finding>} findings - Findings to filter
 * @param {number} threshold - Minimum entropy
 * @returns {Array<Finding>} High entropy findings
 */
static filterLowEntropy(findings, threshold = 3.0)
```

---

## Masking Utilities API

### SecretMasker Class

```javascript
class SecretMasker {
    static mask(secret, options = {})
    static partialMask(secret, visibleChars = 6)
    static hashMask(secret)
    static isCommonPlaceholder(value)
}
```

#### Methods

##### mask()

```javascript
/**
 * Masks a secret value for safe display/logging
 * @param {string} secret - Secret to mask
 * @param {Object} options - Masking options
 * @param {string} options.maskChar - Character to use for masking
 * @param {number} options.visibleStart - Visible characters at start
 * @param {number} options.visibleEnd - Visible characters at end
 * @returns {string} Masked secret
 */
static mask(secret, options = {})
```

**Example:**
```javascript
SecretMasker.mask('AKIAIOSFODNN7EXAMPLE'); 
// Returns: 'AKI***MPLE'

SecretMasker.mask('sk_live_1234567890abcdef', { visibleStart: 8, visibleEnd: 4 });
// Returns: 'sk_live_***cdef'
```

##### partialMask()

```javascript
/**
 * Shows partial content with masking
 * @param {string} secret - Secret to partially mask
 * @param {number} visibleChars - Total visible characters
 * @returns {string} Partially masked secret
 */
static partialMask(secret, visibleChars = 6)
```

##### isCommonPlaceholder()

```javascript
/**
 * Checks if value is a common placeholder
 * @param {string} value - Value to check
 * @returns {boolean} True if common placeholder
 */
static isCommonPlaceholder(value)
```

**Common placeholders:**
- `YOUR_API_KEY`
- `example_token`
- `test_key_123`
- `<API_KEY>`
- `[TOKEN_HERE]`

---

## Highlighting System API

### HighlightManager Class

```javascript
class HighlightManager {
    constructor(options = {})
    highlightFindings(findings)
    clearHighlights()
    toggleHighlights()
    updateHighlightStyle(riskLevel, style)
    getHighlightedElements()
}
```

#### Methods

##### highlightFindings()

```javascript
/**
 * Highlights findings on the page
 * @param {Array<Finding>} findings - Findings to highlight
 * @returns {Array<Element>} Created highlight elements
 */
highlightFindings(findings)
```

##### clearHighlights()

```javascript
/**
 * Removes all highlights from the page
 * @returns {void}
 */
clearHighlights()
```

##### toggleHighlights()

```javascript
/**
 * Toggles highlight visibility
 * @returns {boolean} New visibility state
 */
toggleHighlights()
```

##### updateHighlightStyle()

```javascript
/**
 * Updates highlight styling for a risk level
 * @param {string} riskLevel - Risk level to update
 * @param {Object} style - CSS style object
 * @returns {void}
 */
updateHighlightStyle(riskLevel, style)
```

### Highlight Styles

Default highlight styles by risk level:

```javascript
const HIGHLIGHT_STYLES = {
    critical: {
        backgroundColor: 'rgba(220, 53, 69, 0.3)',
        borderColor: '#dc3545',
        color: '#721c24'
    },
    high: {
        backgroundColor: 'rgba(255, 193, 7, 0.3)',
        borderColor: '#ffc107',
        color: '#856404'
    },
    medium: {
        backgroundColor: 'rgba(253, 126, 20, 0.3)',
        borderColor: '#fd7e14',
        color: '#8a4700'
    },
    low: {
        backgroundColor: 'rgba(40, 167, 69, 0.3)',
        borderColor: '#28a745',
        color: '#155724'
    }
};
```

---

## Cloud Bucket Scanning API

### BucketParser Class

Parses and normalizes cloud bucket URLs for testing.

```javascript
class BucketParser {
    static parseBucketUrl(url, provider)
    static extractBucketName(url, provider)
    static extractRegion(url, provider)
    static generateTestUrls(bucketInfo)
    static normalizeBucketUrl(url)
}
```

#### Methods

##### parseBucketUrl()

```javascript
/**
 * Parses a bucket URL and extracts metadata
 * @param {string} url - Bucket URL to parse
 * @param {string} provider - Cloud provider (aws, gcp, azure, etc.)
 * @returns {Object} Parsed bucket information
 */
static parseBucketUrl(url, provider)
```

**Returns:**
```javascript
{
    bucketName: string,     // Extracted bucket name
    provider: string,       // Cloud provider
    region: string,         // Bucket region (if detectable)
    originalUrl: string,    // Original URL
    testUrls: Array<string>, // URLs to test for accessibility
    urlType: string         // URL format type (subdomain, path, etc.)
}
```

##### generateTestUrls()

```javascript
/**
 * Generates test URLs for bucket accessibility testing
 * @param {Object} bucketInfo - Parsed bucket information
 * @returns {Array<string>} URLs to test
 */
static generateTestUrls(bucketInfo)
```

### BucketTester Class

Tests cloud buckets for public accessibility.

```javascript
class BucketTester {
    constructor(settings = {})
    async testBucketAccess(bucketInfo)
    async testMultipleBuckets(bucketList)
    async testS3Bucket(bucketInfo)
    async testGCSBucket(bucketInfo)
    async testAzureBucket(bucketInfo)
}
```

#### Constructor

```javascript
/**
 * Creates a new BucketTester instance
 * @param {Object} settings - Tester configuration
 * @param {number} settings.timeout - Request timeout in milliseconds
 * @param {number} settings.maxConcurrent - Maximum concurrent tests
 * @param {boolean} settings.enableTesting - Enable actual HTTP testing
 */
new BucketTester({
    timeout: 5000,
    maxConcurrent: 3,
    enableTesting: true
})
```

#### Methods

##### testBucketAccess()

```javascript
/**
 * Tests a single bucket for public accessibility
 * @param {Object} bucketInfo - Parsed bucket information
 * @returns {Promise<Object>} Test results
 */
async testBucketAccess(bucketInfo)
```

**Returns:**
```javascript
{
    accessible: boolean,        // Whether bucket is publicly accessible
    statusCode: number,         // HTTP response code
    responseType: string,       // Response content type
    error: string,             // Error message if test failed
    testDuration: number,      // Test duration in milliseconds
    testMethod: string         // Testing method used
}
```

##### testMultipleBuckets()

```javascript
/**
 * Tests multiple buckets with concurrency control
 * @param {Array<Object>} bucketList - List of bucket information objects
 * @returns {Promise<Array<Object>>} Array of test results
 */
async testMultipleBuckets(bucketList)
```

### BucketScanningSettings Class

Manages bucket scanning configuration.

```javascript
class BucketScanningSettings {
    constructor()
    async getBucketScanningSettings()
    async updateBucketScanningSettings(newSettings)
    async isBucketScanningEnabled()
    async isProviderEnabled(provider)
    async resetToDefaults()
}
```

#### Methods

##### getBucketScanningSettings()

```javascript
/**
 * Retrieves current bucket scanning settings
 * @returns {Promise<Object>} Current settings
 */
async getBucketScanningSettings()
```

##### updateBucketScanningSettings()

```javascript
/**
 * Updates bucket scanning settings
 * @param {Object} newSettings - Settings to update
 * @returns {Promise<void>}
 */
async updateBucketScanningSettings(newSettings)
```

##### isProviderEnabled()

```javascript
/**
 * Checks if a specific provider is enabled
 * @param {string} provider - Provider to check (aws, gcp, azure, etc.)
 * @returns {Promise<boolean>} True if provider is enabled
 */
async isProviderEnabled(provider)
```

### Bucket Finding Model

```javascript
{
    id: string,                 // Unique finding ID
    type: string,               // "AWS S3 Bucket (Open)" or similar
    value: string,              // Bucket URL (may be masked)
    riskLevel: string,          // "high" for open, "low" for secured
    category: "cloudStorage",   // Always "cloudStorage"
    url: string,                // Source page URL
    timestamp: number,          // Detection timestamp
    context: string,            // Surrounding page context
    bucketInfo: {
        bucketName: string,     // Extracted bucket name
        provider: string,       // Cloud provider
        region: string,         // Bucket region
        accessible: boolean,    // Accessibility test result
        testResults: {
            statusCode: number,
            responseType: string,
            testDuration: number,
            error: string
        }
    }
}
```

### Provider Support

| Provider | Identifier | Supported URL Formats |
|----------|------------|----------------------|
| AWS S3 | `aws` | `s3://`, `https://*.s3.amazonaws.com`, `https://s3.amazonaws.com/*` |
| Google Cloud Storage | `gcp` | `gs://`, `https://storage.googleapis.com/*` |
| Azure Blob Storage | `azure` | `https://*.blob.core.windows.net/*` |
| DigitalOcean Spaces | `digitalocean` | `https://*.digitaloceanspaces.com/*` |
| Alibaba Cloud OSS | `alibaba` | `https://*.oss-*.aliyuncs.com/*` |

### Error Handling

#### BucketScanError

```javascript
class BucketScanError extends Error {
    constructor(message, code, bucketInfo = {}) {
        super(message);
        this.name = 'BucketScanError';
        this.code = code;
        this.bucketInfo = bucketInfo;
    }
}
```

**Error codes:**
- `INVALID_URL`: Bucket URL format is invalid
- `UNSUPPORTED_PROVIDER`: Cloud provider not supported
- `NETWORK_ERROR`: Network request failed
- `TIMEOUT_ERROR`: Request timed out
- `PARSE_ERROR`: Failed to parse bucket information

### Usage Examples

#### Basic Bucket Scanning

```javascript
// Initialize components
const parser = new BucketParser();
const tester = new BucketTester({ timeout: 5000, maxConcurrent: 3 });

// Parse bucket URL
const bucketInfo = parser.parseBucketUrl('s3://my-test-bucket', 'aws');

// Test accessibility
const testResult = await tester.testBucketAccess(bucketInfo);

console.log('Bucket accessible:', testResult.accessible);
console.log('Status code:', testResult.statusCode);
```

#### Batch Testing

```javascript
// Test multiple buckets
const bucketUrls = [
    's3://bucket1',
    'https://bucket2.s3.amazonaws.com',
    'gs://gcs-bucket'
];

const bucketInfoList = bucketUrls.map(url => {
    const provider = url.includes('s3') ? 'aws' : 'gcp';
    return BucketParser.parseBucketUrl(url, provider);
});

const results = await tester.testMultipleBuckets(bucketInfoList);
results.forEach((result, index) => {
    console.log(`Bucket ${index + 1}: ${result.accessible ? 'Open' : 'Secured'}`);
});
```

#### Settings Management

```javascript
// Get current settings
const settings = new BucketScanningSettings();
const currentConfig = await settings.getBucketScanningSettings();

// Update settings
await settings.updateBucketScanningSettings({
    enabled: true,
    providers: {
        aws: true,
        gcp: true,
        azure: false
    },
    testTimeout: 10000,
    maxConcurrentTests: 2
});

// Check if provider is enabled
const awsEnabled = await settings.isProviderEnabled('aws');
```

---

## Browser Extension APIs

### Extension Messaging

#### Content Script to Background

```javascript
// Send message
browser.runtime.sendMessage({
    type: 'SCAN_COMPLETE',
    data: {
        findings: scanResults,
        url: window.location.href,
        timestamp: Date.now()
    }
});
```

#### Background to Content Script

```javascript
// Send to specific tab
browser.tabs.sendMessage(tabId, {
    type: 'UPDATE_HIGHLIGHTS',
    data: { enabled: true }
});
```

#### Message Types

| Type | Direction | Data | Purpose |
|------|-----------|------|---------|
| `SCAN_COMPLETE` | Content → Background | `{findings, url, timestamp}` | Report scan results |
| `SETTINGS_UPDATED` | Background → Content | `{settings}` | Sync settings |
| `TOGGLE_HIGHLIGHTS` | Popup → Content | `{enabled}` | Control highlighting |
| `EXPORT_REQUEST` | Popup → Background | `{format, data}` | Request data export |

### Storage API Usage

```javascript
// Get settings
const settings = await browser.storage.local.get('userSettings');

// Save settings with change listener
await browser.storage.local.set({ userSettings: newSettings });

// Listen for changes
browser.storage.onChanged.addListener((changes, namespace) => {
    if (changes.userSettings) {
        handleSettingsChange(changes.userSettings.newValue);
    }
});
```

---

## Testing Framework API

### TestFramework Class

```javascript
class TestFramework {
    constructor(options = {})
    test(name, testFunction)
    beforeEach(setupFunction)
    afterEach(teardownFunction)
    async runAll()
    getResults()
}
```

#### Methods

##### test()

```javascript
/**
 * Defines a test case
 * @param {string} name - Test name
 * @param {Function} testFunction - Test function (can be async)
 * @returns {void}
 */
test(name, testFunction)
```

**Example:**
```javascript
testFramework.test('Should detect AWS keys', async () => {
    const content = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
    const findings = await scanner.scanContent(content);
    Assert.ok(findings.length > 0, 'Should find AWS key');
});
```

##### runAll()

```javascript
/**
 * Runs all registered tests
 * @returns {Promise<Object>} Test results
 */
async runAll()
```

**Returns:**
```javascript
{
    passed: number,
    failed: number,
    total: number,
    executionTime: number,
    failures: Array<{testName: string, error: string}>
}
```

### Assert Class

Available assertion methods:

```javascript
Assert.equal(actual, expected, message)
Assert.notEqual(actual, expected, message)
Assert.true(value, message)
Assert.false(value, message)
Assert.ok(value, message)
Assert.arrayLength(array, expectedLength, message)
Assert.arrayIncludes(array, value, message)
Assert.objectHasProperty(obj, property, message)
Assert.throws(fn, message)
```

### MockHelpers Class

```javascript
class MockHelpers {
    static mockBrowserAPI()
    static mockDOM()
    static mockStorage()
    static mockNotifications()
    static restoreMocks()
}
```

---

## Error Handling

### Common Error Types

#### ScanError

```javascript
class ScanError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ScanError';
        this.code = code;
        this.details = details;
    }
}
```

**Error codes:**
- `PATTERN_COMPILE_ERROR`: Pattern compilation failed
- `CONTENT_ACCESS_ERROR`: Cannot access page content
- `SCAN_TIMEOUT`: Scanning operation timed out

#### StorageError

```javascript
class StorageError extends Error {
    constructor(message, operation, key = null) {
        super(message);
        this.name = 'StorageError';
        this.operation = operation;
        this.key = key;
    }
}
```

### Error Handling Patterns

```javascript
try {
    const findings = await scanner.scanContent(content);
} catch (error) {
    if (error instanceof ScanError) {
        console.error('Scan failed:', error.code, error.details);
        // Handle gracefully
    } else {
        console.error('Unexpected error:', error);
        throw error;
    }
}
```

---

## Performance Considerations

### Async Operations

All major operations support async/await:

```javascript
// Good: Non-blocking
const findings = await scanner.scanContent(largeContent);

// Avoid: Blocking
const findings = scanner.scanContentSync(largeContent);
```

### Memory Management

```javascript
// Clean up resources
scanner.clearResults();
highlightManager.clearHighlights();
exportManager.clearSessionHistory();

// Monitor memory usage
if (performance.memory.usedJSHeapSize > MEMORY_THRESHOLD) {
    triggerCleanup();
}
```

### Performance Thresholds

| Operation | Target Time | Memory Limit |
|-----------|-------------|--------------|
| Small content scan (1KB) | < 100ms | < 5MB |
| Medium content scan (10KB) | < 250ms | < 15MB |
| Large content scan (100KB) | < 500ms | < 50MB |
| Pattern compilation | < 50ms | < 10MB |
| Export generation | < 200ms | < 25MB |

---

## Version Compatibility

### API Versioning

Current API version: `1.5.0`

Breaking changes are documented in migration guides.

### Browser Support

- **Firefox**: 78+ (Primary target)
- **Chrome**: 88+ (Via compatibility layer)
- **Edge**: 88+ (Chromium-based)

---

## Examples

### Complete Scanning Example

```javascript
// Initialize scanner
const scanner = new Scanner({
    enableProgressiveScan: true,
    enableEntropyFilter: true,
    batchSize: 1000
});

// Scan page content
try {
    const findings = await scanner.scanContent(document.body.textContent, {
        riskThreshold: 'medium',
        includeContext: true
    });
    
    // Process results
    findings.forEach(finding => {
        console.log(`Found ${finding.type}: ${finding.value} (Risk: ${finding.riskLevel})`);
    });
    
    // Export if needed
    if (findings.length > 0) {
        const exportManager = new ExportManager();
        const exportData = exportManager.exportToJSON(findings, {
            url: window.location.href,
            scanDate: new Date().toISOString()
        });
        console.log('Export data:', exportData);
    }
    
} catch (error) {
    console.error('Scanning failed:', error);
}
```

### Custom Pattern Example

```javascript
// Define custom pattern
const customPattern = {
    type: 'Custom API Key',
    regex: /custom_[a-zA-Z0-9]{32}/g,
    riskLevel: 'high',
    category: 'api-keys',
    description: 'Custom service API key',
    examples: ['custom_1234567890abcdef1234567890abcdef'],
    falsePositives: ['custom_example', 'custom_test']
};

// Add to pattern manager
const patternManager = new PatternManager();
patternManager.addCustomPattern('custom', customPattern);
```

This API reference covers all public interfaces and methods available in the Firefox Credential Scanner Extension. For implementation details and internal APIs, refer to the source code and developer guide.
