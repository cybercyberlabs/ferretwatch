/**
 * Unit tests for BucketTester class
 */

const { TestFramework, Assert, MockHelpers } = require('../framework.js');
const BucketTester = require('../../utils/bucket-tester.js');

// Mock fetch for testing
let mockFetch;
let mockAbortController;

// Create test framework instance
const testFramework = new TestFramework();

// Setup mocks before each test
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
        mockResolvedValueOnce: function(response) {
            this.responses.push({ type: 'resolve', value: response });
            return this;
        },
        mockRejectedValueOnce: function(error) {
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

// Constructor tests
testFramework.test('should use default settings when none provided', () => {
    const tester = new BucketTester();
    Assert.equal(tester.timeout, 5000);
    Assert.equal(tester.maxConcurrent, 3);
});

testFramework.test('should use custom settings when provided', () => {
    const settings = {
        bucketTestTimeout: 10000,
        maxConcurrentTests: 5
    };
    const tester = new BucketTester(settings);
    Assert.equal(tester.timeout, 10000);
    Assert.equal(tester.maxConcurrent, 5);
});

// testBucketAccess tests
testFramework.test('should return error for invalid bucket info', async () => {
    const bucketTester = new BucketTester();
    const result = await bucketTester.testBucketAccess(null);
    Assert.equal(result.accessible, false);
    Assert.equal(result.error, 'Bucket information is required');
});

testFramework.test('should return error for bucket info without testUrl', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = { bucketName: 'test' };
    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.error, 'No test URLs available for bucket');
});

testFramework.test('should handle successful S3 bucket listing', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test-bucket'
    };

    const mockResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<?xml version="1.0"?><ListBucketResult><Contents></Contents></ListBucketResult>')
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, true);
    Assert.equal(result.statusCode, 200);
    Assert.equal(result.responseType, 'xml');
    Assert.equal(result.listingEnabled, true);
});

testFramework.test('should handle S3 access denied', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test-bucket'
    };

    const mockResponse = {
        status: 403,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<Error><Code>AccessDenied</Code></Error>')
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.statusCode, 403);
    Assert.equal(result.error, 'Access denied');
    Assert.equal(result.listingEnabled, false);
});

testFramework.test('should handle GCS JSON response', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://storage.googleapis.com/test-bucket'],
        provider: 'gcp',
        bucketName: 'test-bucket'
    };

    const mockResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve('{"items": [{"name": "file1.txt"}]}')
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, true);
    Assert.equal(result.statusCode, 200);
    Assert.equal(result.responseType, 'json');
    Assert.equal(result.listingEnabled, true);
});

testFramework.test('should handle network timeout', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test-bucket'
    };

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.error, 'Request timeout');
});

testFramework.test('should handle CORS errors', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test-bucket'
    };

    const corsError = new Error('NetworkError: CORS policy blocked');
    mockFetch.mockRejectedValueOnce(corsError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, null);
    Assert.equal(result.error, 'CORS restriction - cannot determine accessibility');
});

testFramework.test('should return empty array for empty bucket list', async () => {
    const bucketTester = new BucketTester();
    const result = await bucketTester.testMultipleBuckets([]);
    Assert.arrayLength(result, 0);
});

testFramework.test('should return empty array for null bucket list', async () => {
    const bucketTester = new BucketTester();
    const result = await bucketTester.testMultipleBuckets(null);
    Assert.arrayLength(result, 0);
});

testFramework.test('should handle 404 errors correctly', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://nonexistent-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'nonexistent-bucket'
    };

    const mockResponse = {
        status: 404,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<Error><Code>NoSuchBucket</Code></Error>')
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.statusCode, 404);
    Assert.equal(result.error, 'Bucket not found');
});

testFramework.test('should chunk arrays correctly', () => {
    const tester = new BucketTester();
    const array = [1, 2, 3, 4, 5, 6, 7];
    const chunks = tester._chunkArray(array, 3);
    
    Assert.arrayLength(chunks, 3);
    Assert.arrayLength(chunks[0], 3);
    Assert.arrayLength(chunks[1], 3);
    Assert.arrayLength(chunks[2], 1);
});

testFramework.test('should handle empty arrays in chunking', () => {
    const tester = new BucketTester();
    const chunks = tester._chunkArray([], 3);
    Assert.arrayLength(chunks, 0);
});

// Enhanced Error Handling Tests
testFramework.test('should validate bucket info with missing testUrls', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = { 
        bucketName: 'test',
        provider: 'aws'
        // Missing testUrls
    };
    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('No test URLs available'));
});

testFramework.test('should validate bucket info with invalid testUrls', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = { 
        bucketName: 'test',
        provider: 'aws',
        testUrls: ['invalid-url', 'not-a-url']
    };
    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('Invalid test URL'));
});

testFramework.test('should validate bucket info with missing provider', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = { 
        bucketName: 'test',
        testUrls: ['https://test.s3.amazonaws.com/']
        // Missing provider
    };
    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('Valid provider is required'));
});

testFramework.test('should handle DNS resolution failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://nonexistent-domain-12345.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test'
    };

    const dnsError = new Error('DNS resolution failed: ENOTFOUND');
    mockFetch.mockRejectedValueOnce(dnsError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.errorType, 'dns');
    Assert.ok(result.error.includes('DNS resolution failed'));
});

testFramework.test('should handle network connection failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test'
    };

    const networkError = new Error('Failed to fetch');
    mockFetch.mockRejectedValueOnce(networkError);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.errorType, 'network');
    Assert.ok(result.error.includes('Network connection failed'));
});

testFramework.test('should handle invalid response objects', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test'
    };

    const invalidResponse = {
        status: 'invalid', // Should be number
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<xml></xml>')
    };

    mockFetch.mockResolvedValueOnce(invalidResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.ok(result.error.includes('Invalid response'));
});

testFramework.test('should handle response content validation failures', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test'
    };

    const maliciousResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<script>alert("xss")</script>')
    };

    mockFetch.mockResolvedValueOnce(maliciousResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, false);
    Assert.equal(result.validationFailed, true);
    Assert.ok(result.error.includes('potentially malicious content'));
});

testFramework.test('should handle large response truncation', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: ['https://test-bucket.s3.amazonaws.com/'],
        provider: 'aws',
        bucketName: 'test'
    };

    // Create a large response (over 1MB)
    const largeContent = 'x'.repeat(1024 * 1024 + 1000);
    const largeResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve(largeContent)
    };

    mockFetch.mockResolvedValueOnce(largeResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    // Should handle large responses without crashing
    Assert.ok(result !== null);
});

testFramework.test('should handle batch testing with partial failures', async () => {
    const bucketTester = new BucketTester();
    const bucketList = [
        { testUrls: ['https://good-bucket.s3.amazonaws.com/'], provider: 'aws', bucketName: 'good' },
        { testUrls: ['https://bad-bucket.s3.amazonaws.com/'], provider: 'aws', bucketName: 'bad' },
        { testUrls: ['https://another-good.s3.amazonaws.com/'], provider: 'aws', bucketName: 'another' }
    ];

    // Mock responses: success, failure, success
    const successResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<?xml><ListBucketResult></ListBucketResult>')
    };
    
    const failureError = new Error('Network failure');

    mockFetch.mockResolvedValueOnce(successResponse);
    mockFetch.mockRejectedValueOnce(failureError);
    mockFetch.mockResolvedValueOnce(successResponse);

    const results = await bucketTester.testMultipleBuckets(bucketList);
    
    Assert.arrayLength(results, 3);
    Assert.equal(results[0].accessible, true);
    Assert.equal(results[1].accessible, false);
    Assert.equal(results[2].accessible, true);
});

testFramework.test('should handle multiple test URLs fallback', async () => {
    const bucketTester = new BucketTester();
    const bucketInfo = {
        testUrls: [
            'https://first-url.s3.amazonaws.com/',
            'https://second-url.s3.amazonaws.com/'
        ],
        provider: 'aws',
        bucketName: 'test'
    };

    // First URL fails with CORS, second succeeds
    const corsError = new Error('NetworkError: CORS policy blocked');
    const successResponse = {
        status: 200,
        headers: new Map([['content-type', 'application/xml']]),
        text: () => Promise.resolve('<?xml><ListBucketResult></ListBucketResult>')
    };

    mockFetch.mockRejectedValueOnce(corsError);
    mockFetch.mockResolvedValueOnce(successResponse);

    const result = await bucketTester.testBucketAccess(bucketInfo);
    Assert.equal(result.accessible, true);
    Assert.equal(result.statusCode, 200);
});

// Export the test framework
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else if (typeof window !== 'undefined') {
    window.bucketTesterTests = testFramework;
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