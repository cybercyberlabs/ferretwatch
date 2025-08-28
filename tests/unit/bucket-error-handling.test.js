/**
 * Comprehensive Error Handling Tests for Bucket Scanner
 * Tests various error scenarios and edge cases
 */

const { TestFramework, Assert } = require('../framework.js');
const BucketTester = require('../../utils/bucket-tester.js');
const BucketParser = require('../../utils/bucket-parser.js');

// Create test framework instance
const testFramework = new TestFramework();

// Mock fetch and AbortController for testing
let mockFetch;
let mockAbortController;

testFramework.beforeEach(() => {
    // Mock fetch
    mockFetch = {
        calls: [],
        responses: [],
        mockResolvedValue: function(response) {
            this.responses.push({ type: 'resolve', value: response });
            return this;
        },
        mockRejectedValue: function(error) {
            this.responses.push({ type: 'reject', value: error });
            return this;
        },
        mockClear: function() {
            this.calls = [];
            this.responses = [];
        }
    };

    // Mock AbortController
    mockAbortController = class {
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    };

    // Replace global fetch
    global.fetch = async function(url, options) {
        mockFetch.calls.push({ url, options });
        
        if (mockFetch.responses.length === 0) {
            throw new Error('No mock response configured');
        }
        
        const response = mockFetch.responses.shift();
        if (response.type === 'resolve') {
            return response.value;
        } else {
            throw response.value;
        }
    };

    global.AbortController = mockAbortController;
});

// Network Error Handling Tests
testFramework.test('should handle connection timeout errors', async () => {
    const bucketTester = new BucketTester({ bucketTestTimeout: 1000 });
    const bucketInfo = {
        testUrls: ['https://timeout-test.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'timeout-test'
    };

    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.errorType, 'timeout');
    Assert.ok(result.error.includes('timeout'));
});

testFramework.test('should handle CORS policy errors', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://cors-blocked.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'cors-blocked'
    };

    const corsError = new Error('NetworkError when attempting to fetch resource. CORS policy blocked');
    mockFetch.mockRejectedValue(corsError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, null); // Unknown due to CORS
    Assert.equal(result.errorType, 'cors');
    Assert.ok(result.error.includes('CORS restriction'));
});

testFramework.test('should handle DNS resolution failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://nonexistent-domain-xyz123.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'nonexistent'
    };

    const dnsError = new Error('getaddrinfo ENOTFOUND nonexistent-domain-xyz123.s3.amazonaws.com');
    mockFetch.mockRejectedValue(dnsError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.errorType, 'dns');
    Assert.ok(result.error.includes('DNS resolution failed'));
});

testFramework.test('should handle network connection failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://unreachable.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'unreachable'
    };

    const networkError = new Error('Failed to fetch');
    mockFetch.mockRejectedValue(networkError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.errorType, 'network');
    Assert.ok(result.error.includes('Network connection failed'));
});

// Response Validation Tests
testFramework.test('should handle malformed HTTP responses', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://malformed-response.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'malformed'
    };

    const malformedResponse = {
        status: 'not-a-number', // Invalid status
        headers: new Map(),
        text: () => Promise.resolve('')
    };

    mockFetch.mockResolvedValue(malformedResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.ok(result.error.includes('Invalid response'));
});

testFramework.test('should handle responses with malicious content', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://malicious.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'malicious'
    };

    const maliciousResponse = {
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve('<script>alert("XSS")</script><html></html>')
    };

    mockFetch.mockResolvedValue(maliciousResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('potentially malicious content'));
});

testFramework.test('should handle invalid JSON responses', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://invalid-json.s3.amazonaws.com/'],
        provider: 'gcp',
        bucketName: 'invalid-json'
    };

    const invalidJsonResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve('{ invalid json content }')
    };

    mockFetch.mockResolvedValue(invalidJsonResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('Invalid JSON structure'));
});

testFramework.test('should handle invalid XML responses', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://invalid-xml.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'invalid-xml'
    };

    const invalidXmlResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('not xml content at all')
    };

    mockFetch.mockResolvedValue(invalidXmlResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('Invalid XML structure'));
});

// URL Validation Tests
testFramework.test('should reject malicious URLs during parsing', () => {
    const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'https://bucket.s3.amazonaws.com/<script>alert(1)</script>',
        'https://bucket.s3.amazonaws.com/onload=alert(1)',
        'https://bucket.s3.amazonaws.com/../../../etc/passwd'
    ];

    maliciousUrls.forEach(url => {
        Assert.throws(() => {
            BucketParser.parseBucketUrl(url, 'aws');
        });
    });
});

testFramework.test('should reject private IP addresses', () => {
    const privateIpUrls = [
        'https://127.0.0.1/bucket',
        'https://localhost/bucket',
        'https://192.168.1.1/bucket',
        'https://10.0.0.1/bucket',
        'https://172.16.0.1/bucket'
    ];

    privateIpUrls.forEach(url => {
        Assert.false(BucketParser.isValidCloudStorageUrl(url));
    });
});

// Batch Processing Error Handling Tests
testFramework.test('should handle partial failures in batch processing', async () => {
    const bucketTester = new BucketTester();
    const bucketList = [
        { testUrls: ['https://good1.s3.amazonaws.com/'], provider: 'aws', bucketName: 'good1' },
        { testUrls: ['https://bad.s3.amazonaws.com/'], provider: 'aws', bucketName: 'bad' },
        { testUrls: ['https://good2.s3.amazonaws.com/'], provider: 'aws', bucketName: 'good2' },
        { testUrls: ['https://timeout.s3.amazonaws.com/'], provider: 'aws', bucketName: 'timeout' }
    ];

    // Mock different types of responses and errors
    const successResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<?xml><ListBucketResult></ListBucketResult>')
    };

    const networkError = new Error('Network failure');
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';

    mockFetch.mockResolvedValue(successResponse);
    mockFetch.mockRejectedValue(networkError);
    mockFetch.mockResolvedValue(successResponse);
    mockFetch.mockRejectedValue(timeoutError);

    const results = await bucketTester.testMultipleBuckets(bucketList);
    
    Assert.arrayLength(results, 4);
    Assert.equal(results[0].accessible, true);
    Assert.equal(results[1].accessible, false);
    Assert.equal(results[2].accessible, true);
    Assert.equal(results[3].accessible, false);
    Assert.equal(results[3].errorType, 'timeout');
});

testFramework.test('should handle chunk-level failures gracefully', async () => {
    const bucketTester = new BucketTester({ maxConcurrentTests: 2 });
    const bucketList = [
        { testUrls: ['https://bucket1.s3.amazonaws.com/'], provider: 'aws', bucketName: 'bucket1' },
        { testUrls: ['https://bucket2.s3.amazonaws.com/'], provider: 'aws', bucketName: 'bucket2' },
        { testUrls: ['https://bucket3.s3.amazonaws.com/'], provider: 'aws', bucketName: 'bucket3' }
    ];

    // Simulate a chunk processing failure
    let callCount = 0;
    global.fetch = async function() {
        callCount++;
        if (callCount <= 2) {
            // First chunk succeeds
            return {
                status: 200,
                headers: new Map([['content-type', 'application/xml']]),
                text: () => Promise.resolve('<?xml><ListBucketResult></ListBucketResult>')
            };
        } else {
            // Second chunk fails
            throw new Error('Chunk processing error');
        }
    };

    const results = await bucketTester.testMultipleBuckets(bucketList);
    
    Assert.arrayLength(results, 3);
    Assert.equal(results[0].accessible, true);
    Assert.equal(results[1].accessible, true);
    Assert.equal(results[2].accessible, false);
    Assert.equal(results[2].errorType, 'batch_failure');
});

// Edge Case Tests
testFramework.test('should handle extremely large responses', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://large-response.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'large-response'
    };

    // Create response larger than 1MB
    const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
    const largeResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve(largeContent)
    };

    mockFetch.mockResolvedValue(largeResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    // Should handle large responses without crashing
    Assert.ok(result !== null);
    Assert.ok(typeof result.accessible === 'boolean' || result.accessible === null);
});

testFramework.test('should handle response reading failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://unreadable-response.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'unreadable'
    };

    const unreadableResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.reject(new Error('Cannot read response body'))
    };

    mockFetch.mockResolvedValue(unreadableResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    
    // Should handle response reading failures gracefully
    Assert.ok(result !== null);
    Assert.equal(typeof result.accessible, 'boolean');
});

// Input Sanitization Tests
testFramework.test('should sanitize bucket names with special characters', () => {
    const specialCharUrls = [
        's3://bucket-with-unicode-\u0000',
        's3://bucket\nwith\nnewlines',
        's3://bucket\twith\ttabs',
        's3://bucket with spaces'
    ];

    specialCharUrls.forEach(url => {
        Assert.throws(() => {
            BucketParser.parseBucketUrl(url, 'aws');
        });
    });
});

testFramework.test('should handle URL encoding edge cases', () => {
    // Test various URL encoding scenarios
    const encodedUrls = [
        'https://bucket.s3.amazonaws.com/path%2Fwith%2Fencoded%2Fslashes',
        'https://bucket.s3.amazonaws.com/path%20with%20spaces',
        'https://bucket.s3.amazonaws.com/path%3Fwith%3Dquery%26params'
    ];

    encodedUrls.forEach(url => {
        const result = BucketParser.parseBucketUrl(url, 'aws');
        Assert.ok(result.bucketName === 'bucket');
        Assert.ok(result.testUrls.length > 0);
    });
});

// Export the test framework
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else if (typeof window !== 'undefined') {
    window.bucketErrorHandlingTests = testFramework;
}

// Auto-run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}