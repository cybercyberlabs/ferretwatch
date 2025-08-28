/**
 * Integration tests for bucket scanning in ProgressiveScanner
 */

// Mock dependencies for testing
const mockStorageUtils = {
    getSetting: (key, defaultValue) => {
        const settings = {
            'scanningMode': 'progressive',
            'maxFindings': 10,
            'bucketTestTimeout': 5000,
            'maxConcurrentTests': 3
        };
        return settings[key] || defaultValue;
    },
    getSettings: () => ({
        cloudBucketScanning: {
            enabled: true,
            providers: {
                aws: true,
                gcp: true,
                azure: true
            }
        }
    }),
    isCategoryEnabled: (category) => true
};

const mockBucketParser = {
    parseBucketUrl: (url, provider) => ({
        originalUrl: url,
        provider: provider,
        bucketName: 'test-bucket',
        region: 'us-east-1',
        testUrls: [`https://test-bucket.s3.amazonaws.com/`]
    })
};

const mockBucketTester = {
    testBucketAccess: async (bucketInfo) => ({
        accessible: true,
        statusCode: 200,
        responseType: 'xml',
        listingEnabled: true,
        error: null
    })
};

// Set up global mocks
if (typeof window === 'undefined') {
    global.window = {};
}
window.StorageUtils = mockStorageUtils;
window.BucketParser = mockBucketParser;
window.BucketTester = function(settings) {
    return mockBucketTester;
};

// Mock performance API for Node.js
if (typeof performance === 'undefined') {
    global.performance = {
        now: () => Date.now()
    };
}

// Load the scanner
const { ProgressiveScanner } = require('../../utils/scanner.js');

// Test suite
const tests = {
    'Scanner should initialize with bucket testing capabilities': async () => {
        const scanner = new ProgressiveScanner();
        
        if (!scanner.bucketTester) {
            throw new Error('Bucket tester should be initialized');
        }
        
        if (!scanner.isBucketScanningEnabled()) {
            throw new Error('Bucket scanning should be enabled by default');
        }
        
        return true;
    },

    'Scanner should detect cloud storage patterns': async () => {
        const scanner = new ProgressiveScanner();
        
        // Mock patterns for cloud storage
        const patterns = [{
            pattern: /https?:\/\/[a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9]\.s3\.amazonaws\.com/gi,
            description: "AWS S3 Bucket",
            riskLevel: "medium",
            provider: "aws",
            category: "cloudStorage"
        }];
        
        const content = 'Check out this bucket: https://my-test-bucket.s3.amazonaws.com/data.txt';
        
        const findings = await scanner.scanWithPatterns(content, patterns);
        
        if (findings.length === 0) {
            throw new Error('Should detect S3 bucket URL');
        }
        
        const bucketFinding = findings[0];
        if (bucketFinding.category !== 'cloudStorage') {
            throw new Error('Should categorize as cloudStorage');
        }
        
        if (bucketFinding.provider !== 'aws') {
            throw new Error('Should identify AWS provider');
        }
        
        return true;
    },

    'Scanner should enhance bucket findings with accessibility test results': async () => {
        const scanner = new ProgressiveScanner();
        
        // Create mock findings with cloud storage
        const mockFindings = [{
            value: 'https://test-bucket.s3.amazonaws.com/',
            type: 'AWS S3 Bucket',
            riskLevel: 'medium',
            category: 'cloudStorage',
            provider: 'aws',
            context: 'Found in page source',
            position: 100,
            timestamp: Date.now()
        }];
        
        const enhancedFindings = await scanner.scanCloudBuckets(mockFindings);
        
        if (enhancedFindings.length === 0) {
            throw new Error('Should return enhanced findings');
        }
        
        const enhanced = enhancedFindings[0];
        
        if (!enhanced.bucketInfo) {
            throw new Error('Should include bucket info');
        }
        
        if (enhanced.bucketInfo.accessible !== true) {
            throw new Error('Should indicate bucket is accessible');
        }
        
        if (enhanced.riskLevel !== 'high') {
            throw new Error('Should upgrade risk level for accessible bucket');
        }
        
        if (!enhanced.type.includes('Public Access Confirmed')) {
            throw new Error('Should update type to indicate public access');
        }
        
        return true;
    },

    'Scanner should handle bucket parsing errors gracefully': async () => {
        const scanner = new ProgressiveScanner();
        
        // Mock parser that throws errors
        window.BucketParser = {
            parseBucketUrl: () => {
                throw new Error('Invalid URL format');
            }
        };
        
        const mockFindings = [{
            value: 'invalid-bucket-url',
            category: 'cloudStorage',
            provider: 'aws'
        }];
        
        // Should not throw error
        const result = await scanner.scanCloudBuckets(mockFindings);
        
        if (result.length !== 0) {
            throw new Error('Should return empty array for invalid URLs');
        }
        
        return true;
    },

    'Scanner should respect concurrency limits': async () => {
        const scanner = new ProgressiveScanner();
        
        // Track concurrent calls
        let concurrentCalls = 0;
        let maxConcurrent = 0;
        
        window.BucketTester = function() {
            return {
                testBucketAccess: async (bucketInfo) => {
                    concurrentCalls++;
                    maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
                    
                    // Simulate async work
                    await new Promise(resolve => setTimeout(resolve, 10));
                    
                    concurrentCalls--;
                    
                    return {
                        accessible: false,
                        statusCode: 403,
                        error: 'Access denied'
                    };
                }
            };
        };
        
        // Use working parser for this test
        window.BucketParser = mockBucketParser;
        
        // Create multiple bucket findings
        const mockFindings = Array.from({ length: 10 }, (_, i) => ({
            value: `https://bucket-${i}.s3.amazonaws.com/`,
            category: 'cloudStorage',
            provider: 'aws'
        }));
        
        await scanner.scanCloudBuckets(mockFindings);
        
        const expectedMaxConcurrent = mockStorageUtils.getSetting('maxConcurrentTests', 3);
        if (maxConcurrent > expectedMaxConcurrent) {
            throw new Error(`Exceeded concurrency limit: ${maxConcurrent} > ${expectedMaxConcurrent}`);
        }
        
        return true;
    },

    'Scanner should update statistics for bucket scanning': async () => {
        const scanner = new ProgressiveScanner();
        
        // Reset parser and tester to working versions
        window.BucketParser = mockBucketParser;
        window.BucketTester = function() {
            return mockBucketTester;
        };
        
        const initialBucketsScanned = scanner.stats.bucketsScanned;
        const initialBucketsAccessible = scanner.stats.bucketsAccessible;
        
        const mockFindings = [{
            value: 'https://accessible-bucket.s3.amazonaws.com/',
            category: 'cloudStorage',
            provider: 'aws'
        }];
        
        const results = await scanner.scanCloudBuckets(mockFindings);
        
        if (scanner.stats.bucketsScanned <= initialBucketsScanned) {
            throw new Error('Should increment bucketsScanned counter');
        }
        
        if (scanner.stats.bucketsAccessible <= initialBucketsAccessible) {
            throw new Error('Should increment bucketsAccessible counter');
        }
        
        // Verify the result has the right structure
        if (results.length === 0) {
            throw new Error('Should return enhanced findings');
        }
        
        if (!results[0].bucketInfo || results[0].bucketInfo.accessible !== true) {
            throw new Error('Enhanced finding should have accessible bucket info');
        }
        
        return true;
    }
};

// Export for test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { tests };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.scannerBucketIntegrationTests = tests;
}