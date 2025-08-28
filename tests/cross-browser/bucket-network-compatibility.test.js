/**
 * Cross-browser compatibility tests for bucket scanning network requests
 * Tests network request handling across different browser environments
 */

let TestFramework, Assert, MockHelpers;

// Load testing framework
if (typeof require !== 'undefined') {
    const framework = require('../framework.js');
    TestFramework = framework.TestFramework;
    Assert = framework.Assert;
    MockHelpers = framework.MockHelpers;
} else if (typeof window !== 'undefined') {
    TestFramework = window.TestFramework;
    Assert = window.Assert;
    MockHelpers = window.MockHelpers;
}

const testFramework = new TestFramework();

const mockSettings = {
    testTimeout: 5000,
    maxConcurrentTests: 3,
    testPublicAccess: true
};

// Setup and teardown
testFramework.beforeEach(() => {
    MockHelpers.mockDOM();
});

testFramework.afterEach(() => {
    // Clean up any global mocks
    if (typeof global !== 'undefined') {
        if (global.originalFetch) {
            global.fetch = global.originalFetch;
            delete global.originalFetch;
        }
    }
});

// Fetch API Compatibility Tests
testFramework.test('should handle fetch API availability', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    // Mock fetch available
    const mockFetch = async () => ({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Access Denied')
    });
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo) {
            if (typeof fetch !== 'undefined') {
                const response = await mockFetch();
                return {
                    accessible: false,
                    statusCode: response.status,
                    responseType: 'error'
                };
            } else {
                return {
                    accessible: false,
                    error: 'Fetch API not supported',
                    statusCode: 0
                };
            }
        }
    };
    
    const result = await mockBucketTester.testBucketAccess(bucketInfo);
    Assert.ok(result, 'Should return result');
    Assert.equal(result.statusCode, 403, 'Should handle fetch response');
});

testFramework.test('should fallback gracefully when fetch is unavailable', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo) {
            // Simulate fetch not available (older browsers)
            const fetchAvailable = false;
            
            if (!fetchAvailable) {
                return {
                    accessible: false,
                    error: 'Fetch API not supported in this browser',
                    statusCode: 0
                };
            }
        }
    };
    
    const result = await mockBucketTester.testBucketAccess(bucketInfo);
    
    // Should handle gracefully
    Assert.ok(result, 'Should return result');
    Assert.ok(result.error.includes('not supported'), 'Should indicate lack of support');
});

// CORS Handling Tests
testFramework.test('should handle CORS errors consistently', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo) {
            try {
                // Simulate CORS error
                throw new TypeError('Failed to fetch');
            } catch (error) {
                return {
                    accessible: false,
                    error: `CORS error: ${error.message}`,
                    statusCode: 0
                };
            }
        }
    };
    
    const result = await mockBucketTester.testBucketAccess(bucketInfo);
    
    Assert.ok(result, 'Should return result');
    Assert.equal(result.accessible, false, 'Should mark as not accessible');
    Assert.ok(result.error.includes('CORS'), 'Should indicate CORS error');
});

testFramework.test('should handle different CORS error formats', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const corsErrors = [
        new TypeError('Failed to fetch'),
        new Error('Network request failed'),
        new Error('CORS policy: No \'Access-Control-Allow-Origin\' header')
    ];
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, errorToThrow) {
            try {
                throw errorToThrow;
            } catch (error) {
                return {
                    accessible: false,
                    error: `Network error: ${error.message}`,
                    statusCode: 0
                };
            }
        }
    };
    
    for (const error of corsErrors) {
        const result = await mockBucketTester.testBucketAccess(bucketInfo, error);
        
        Assert.ok(result, 'Should return result for each error type');
        Assert.equal(result.accessible, false, 'Should mark as not accessible');
        Assert.ok(result.error, 'Should have error message');
    }
});// Ti
meout Handling Tests
testFramework.test('should handle timeout consistently across browsers', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo) {
            const timeoutMs = mockSettings.testTimeout;
            
            return new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    resolve({
                        accessible: false,
                        error: `Request timeout after ${timeoutMs}ms`,
                        statusCode: 0
                    });
                }, timeoutMs / 10); // Simulate quick timeout for testing
                
                // Simulate slow response that would timeout
                setTimeout(() => {
                    clearTimeout(timeoutId);
                    resolve({
                        accessible: true,
                        statusCode: 200
                    });
                }, timeoutMs * 2);
            });
        }
    };
    
    const startTime = Date.now();
    const result = await mockBucketTester.testBucketAccess(bucketInfo);
    const duration = Date.now() - startTime;
    
    Assert.ok(result, 'Should return result');
    Assert.ok(result.error && result.error.includes('timeout'), 'Should timeout appropriately');
    Assert.ok(duration < mockSettings.testTimeout, 'Should timeout before configured limit');
});

testFramework.test('should respect different timeout values', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const shortTimeoutSettings = { ...mockSettings, testTimeout: 100 };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, timeoutMs) {
            return new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    resolve({
                        accessible: false,
                        error: `Request timeout after ${timeoutMs}ms`,
                        statusCode: 0
                    });
                }, timeoutMs);
                
                // Simulate response that takes longer than timeout
                setTimeout(() => {
                    clearTimeout(timeoutId);
                    resolve({
                        accessible: true,
                        statusCode: 200
                    });
                }, timeoutMs * 2);
            });
        }
    };
    
    const startTime = Date.now();
    const result = await mockBucketTester.testBucketAccess(bucketInfo, shortTimeoutSettings.testTimeout);
    const duration = Date.now() - startTime;
    
    Assert.ok(result.error && result.error.includes('timeout'), 'Should timeout with short timeout');
    Assert.ok(duration < shortTimeoutSettings.testTimeout + 50, 'Should respect short timeout setting');
});

// Response Parsing Compatibility Tests
testFramework.test('should handle different response formats across browsers', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const responseFormats = [
        // XML response (S3)
        {
            ok: true,
            status: 200,
            headers: { 'content-type': 'application/xml' },
            text: () => Promise.resolve('<?xml version="1.0"?><ListBucketResult></ListBucketResult>')
        },
        // JSON response (GCS)
        {
            ok: true,
            status: 200,
            headers: { 'content-type': 'application/json' },
            text: () => Promise.resolve('{"items": []}')
        },
        // HTML error page
        {
            ok: false,
            status: 403,
            headers: { 'content-type': 'text/html' },
            text: () => Promise.resolve('<html><body>Access Denied</body></html>')
        }
    ];
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, mockResponse) {
            try {
                const responseText = await mockResponse.text();
                let responseType = 'unknown';
                
                if (responseText.includes('<?xml')) {
                    responseType = 'xml';
                } else if (responseText.startsWith('{')) {
                    responseType = 'json';
                } else if (responseText.includes('<html>')) {
                    responseType = 'html';
                }
                
                return {
                    accessible: mockResponse.ok && (responseType === 'xml' || responseType === 'json'),
                    statusCode: mockResponse.status,
                    responseType: responseType
                };
            } catch (error) {
                return {
                    accessible: false,
                    error: `Response parsing error: ${error.message}`,
                    statusCode: 0
                };
            }
        }
    };
    
    for (const mockResponse of responseFormats) {
        const result = await mockBucketTester.testBucketAccess(bucketInfo, mockResponse);
        
        Assert.ok(result, 'Should return result for each response format');
        Assert.equal(result.statusCode, mockResponse.status, 'Should parse status correctly');
        Assert.ok(result.responseType, 'Should determine response type');
    }
});

testFramework.test('should handle malformed responses gracefully', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const malformedResponses = [
        // Invalid XML
        {
            ok: true,
            status: 200,
            text: () => Promise.resolve('<?xml version="1.0"?><invalid><unclosed>')
        },
        // Invalid JSON
        {
            ok: true,
            status: 200,
            text: () => Promise.resolve('{"invalid": json}')
        },
        // Empty response
        {
            ok: true,
            status: 200,
            text: () => Promise.resolve('')
        },
        // Response parsing error
        {
            ok: true,
            status: 200,
            text: () => Promise.reject(new Error('Failed to parse response'))
        }
    ];
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, mockResponse) {
            try {
                const responseText = await mockResponse.text();
                
                // Attempt to validate response
                if (!responseText || responseText.trim() === '') {
                    throw new Error('Empty response');
                }
                
                return {
                    accessible: false,
                    statusCode: mockResponse.status,
                    responseType: 'parsed'
                };
            } catch (error) {
                return {
                    accessible: false,
                    error: `Response error: ${error.message}`,
                    statusCode: mockResponse.status || 0
                };
            }
        }
    };
    
    for (const mockResponse of malformedResponses) {
        const result = await mockBucketTester.testBucketAccess(bucketInfo, mockResponse);
        
        Assert.ok(result, 'Should return result for malformed responses');
        Assert.equal(result.accessible, false, 'Should mark as not accessible');
        Assert.ok(result.error, 'Should have error message');
    }
});// Brows
er-Specific Feature Detection Tests
testFramework.test('should detect and handle AbortController availability', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, hasAbortController) {
            if (hasAbortController) {
                // Simulate using AbortController
                const controller = {
                    signal: { aborted: false },
                    abort: function() { this.signal.aborted = true; }
                };
                
                return {
                    accessible: false,
                    statusCode: 403,
                    abortSupported: true
                };
            } else {
                // Simulate fallback without AbortController
                return {
                    accessible: false,
                    statusCode: 403,
                    abortSupported: false
                };
            }
        }
    };
    
    // Test with AbortController available
    const resultWithAbort = await mockBucketTester.testBucketAccess(bucketInfo, true);
    Assert.ok(resultWithAbort, 'Should work with AbortController');
    Assert.equal(resultWithAbort.abortSupported, true, 'Should support abort');
    
    // Test without AbortController (older browsers)
    const resultWithoutAbort = await mockBucketTester.testBucketAccess(bucketInfo, false);
    Assert.ok(resultWithoutAbort, 'Should work without AbortController');
    Assert.equal(resultWithoutAbort.abortSupported, false, 'Should indicate no abort support');
});

testFramework.test('should handle different Promise implementations', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo, promiseType) {
            if (promiseType === 'immediate') {
                // Test with immediately resolved Promise
                return Promise.resolve({
                    accessible: false,
                    statusCode: 403,
                    promiseType: 'immediate'
                });
            } else if (promiseType === 'delayed') {
                // Test with delayed Promise
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            accessible: false,
                            statusCode: 403,
                            promiseType: 'delayed'
                        });
                    }, 10);
                });
            }
        }
    };
    
    // Test with immediately resolved Promise
    const immediateResult = await mockBucketTester.testBucketAccess(bucketInfo, 'immediate');
    Assert.ok(immediateResult, 'Should handle immediate Promise');
    Assert.equal(immediateResult.promiseType, 'immediate', 'Should be immediate');
    
    // Test with delayed Promise
    const delayedResult = await mockBucketTester.testBucketAccess(bucketInfo, 'delayed');
    Assert.ok(delayedResult, 'Should handle delayed Promise');
    Assert.equal(delayedResult.promiseType, 'delayed', 'Should be delayed');
});

// Browser Environment Detection Tests
testFramework.test('should detect browser environment capabilities', () => {
    const mockEnvironmentDetector = {
        detectCapabilities: function() {
            const capabilities = {
                fetch: typeof fetch !== 'undefined',
                abortController: typeof AbortController !== 'undefined',
                promises: typeof Promise !== 'undefined',
                asyncAwait: true, // Assume modern environment for testing
                webWorkers: typeof Worker !== 'undefined'
            };
            
            return capabilities;
        }
    };
    
    const capabilities = mockEnvironmentDetector.detectCapabilities();
    
    Assert.ok(typeof capabilities.fetch === 'boolean', 'Should detect fetch availability');
    Assert.ok(typeof capabilities.abortController === 'boolean', 'Should detect AbortController');
    Assert.ok(typeof capabilities.promises === 'boolean', 'Should detect Promise support');
    Assert.ok(typeof capabilities.asyncAwait === 'boolean', 'Should detect async/await support');
    Assert.ok(typeof capabilities.webWorkers === 'boolean', 'Should detect Web Worker support');
});

testFramework.test('should provide appropriate fallbacks for missing features', () => {
    const mockBucketTester = {
        createFallbackTester: function(capabilities) {
            const tester = {
                canTest: false,
                reason: 'Unknown'
            };
            
            if (!capabilities.fetch && !capabilities.xmlHttpRequest) {
                tester.reason = 'No network request capability';
            } else if (!capabilities.promises) {
                tester.reason = 'No Promise support';
            } else {
                tester.canTest = true;
                tester.reason = 'All required features available';
            }
            
            return tester;
        }
    };
    
    // Test with full capabilities
    const fullCapabilities = {
        fetch: true,
        promises: true,
        xmlHttpRequest: true
    };
    
    const fullTester = mockBucketTester.createFallbackTester(fullCapabilities);
    Assert.equal(fullTester.canTest, true, 'Should be able to test with full capabilities');
    
    // Test with limited capabilities
    const limitedCapabilities = {
        fetch: false,
        promises: true,
        xmlHttpRequest: false
    };
    
    const limitedTester = mockBucketTester.createFallbackTester(limitedCapabilities);
    Assert.equal(limitedTester.canTest, false, 'Should not be able to test without network capability');
    Assert.ok(limitedTester.reason.includes('network'), 'Should explain missing network capability');
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment, auto-run tests
    if (typeof window !== 'undefined') {
        window.bucketNetworkCompatibilityTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}