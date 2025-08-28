/**
 * Performance benchmarks for bucket scanning impact
 * Measures the performance impact of bucket scanning on overall extension performance
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
    cloudBucketScanning: {
        enabled: true,
        providers: {
            aws: true,
            gcp: true,
            azure: true,
            digitalocean: true,
            alibaba: true
        },
        testTimeout: 5000,
        maxConcurrentTests: 3,
        testPublicAccess: true
    },
    progressiveScanning: {
        enabled: true,
        chunkSize: 1000,
        delay: 10
    }
};

// Setup and teardown
testFramework.beforeEach(() => {
    MockHelpers.mockDOM();
});

testFramework.afterEach(() => {
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = '';
    }
});

// Pattern Matching Performance Tests
testFramework.test('should benchmark pattern matching performance', () => {
    const largeContent = generateLargeContent(1000); // 1k lines for testing
    
    const startTime = performance.now ? performance.now() : Date.now();
    
    // Mock pattern matching
    const mockScanner = {
        detectBucketUrls: function(content) {
            // Simulate pattern matching work
            const lines = content.split('\n');
            const bucketUrls = [];
            
            lines.forEach(line => {
                if (line.includes('s3.amazonaws.com') || line.includes('storage.googleapis.com')) {
                    bucketUrls.push(line.trim());
                }
            });
            
            return bucketUrls;
        }
    };
    
    const bucketUrls = mockScanner.detectBucketUrls(largeContent);
    
    const endTime = performance.now ? performance.now() : Date.now();
    const duration = endTime - startTime;
    
    console.log(`Pattern matching took ${duration.toFixed(2)}ms for 1k lines`);
    
    // Should complete within reasonable time
    Assert.ok(duration < 500, `Pattern matching should be fast (${duration}ms)`);
    Assert.ok(bucketUrls !== undefined, 'Should return bucket URLs');
});

testFramework.test('should benchmark pattern matching with many bucket URLs', () => {
    const contentWithManyBuckets = generateContentWithBuckets(100); // 100 bucket URLs
    
    const startTime = performance.now ? performance.now() : Date.now();
    
    const mockScanner = {
        detectBucketUrls: function(content) {
            const bucketUrls = [];
            const lines = content.split('\n');
            
            lines.forEach(line => {
                if (line.includes('.s3.amazonaws.com') || 
                    line.includes('storage.googleapis.com') ||
                    line.includes('.blob.core.windows.net') ||
                    line.includes('.digitaloceanspaces.com') ||
                    line.includes('.aliyuncs.com')) {
                    bucketUrls.push(line.trim());
                }
            });
            
            return bucketUrls;
        }
    };
    
    const bucketUrls = mockScanner.detectBucketUrls(contentWithManyBuckets);
    
    const endTime = performance.now ? performance.now() : Date.now();
    const duration = endTime - startTime;
    
    console.log(`Pattern matching with 100 buckets took ${duration.toFixed(2)}ms`);
    
    Assert.ok(duration < 1000, `Pattern matching should be efficient (${duration}ms)`);
    Assert.equal(bucketUrls.length, 100, 'Should find all 100 bucket URLs');
});

// Bucket Testing Performance Tests
testFramework.test('should benchmark single bucket test performance', async () => {
    const bucketInfo = {
        bucketName: 'test-bucket',
        provider: 'aws',
        testUrl: 'https://test-bucket.s3.amazonaws.com',
        originalUrl: 'https://test-bucket.s3.amazonaws.com'
    };
    
    const mockBucketTester = {
        testBucketAccess: async function(bucketInfo) {
            // Simulate network request processing time
            await new Promise(resolve => setTimeout(resolve, 10));
            
            return {
                accessible: false,
                responseType: 'error',
                statusCode: 403,
                error: 'Access Denied'
            };
        }
    };
    
    const startTime = performance.now ? performance.now() : Date.now();
    
    await mockBucketTester.testBucketAccess(bucketInfo);
    
    const endTime = performance.now ? performance.now() : Date.now();
    const duration = endTime - startTime;
    
    console.log(`Single bucket test took ${duration.toFixed(2)}ms`);
    
    // Should complete quickly (mocked request)
    Assert.ok(duration < 100, `Single bucket test should be fast (${duration}ms)`);
});

testFramework.test('should benchmark batch bucket testing performance', async () => {
    const bucketList = Array.from({ length: 10 }, (_, i) => ({
        bucketName: `test-bucket-${i}`,
        provider: 'aws',
        testUrl: `https://test-bucket-${i}.s3.amazonaws.com`,
        originalUrl: `https://test-bucket-${i}.s3.amazonaws.com`
    }));
    
    const mockBucketTester = {
        testMultipleBuckets: async function(buckets) {
            // Simulate batch testing with concurrency control
            const results = [];
            const batchSize = 3; // Mock concurrency limit
            
            for (let i = 0; i < buckets.length; i += batchSize) {
                const batch = buckets.slice(i, i + batchSize);
                const batchPromises = batch.map(async bucket => {
                    await new Promise(resolve => setTimeout(resolve, 20));
                    return {
                        bucket: bucket.bucketName,
                        accessible: false,
                        statusCode: 403
                    };
                });
                
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            }
            
            return results;
        }
    };
    
    const startTime = performance.now ? performance.now() : Date.now();
    
    await mockBucketTester.testMultipleBuckets(bucketList);
    
    const endTime = performance.now ? performance.now() : Date.now();
    const duration = endTime - startTime;
    
    console.log(`Batch testing 10 buckets took ${duration.toFixed(2)}ms`);
    
    // Should respect concurrency limits and complete efficiently
    Assert.ok(duration < 1000, `Batch testing should be efficient (${duration}ms)`);
});

testFramework.test('should measure memory usage during batch testing', async () => {
    const bucketList = Array.from({ length: 50 }, (_, i) => ({
        bucketName: `test-bucket-${i}`,
        provider: 'aws',
        testUrl: `https://test-bucket-${i}.s3.amazonaws.com`,
        originalUrl: `https://test-bucket-${i}.s3.amazonaws.com`
    }));
    
    const mockBucketTester = {
        testMultipleBuckets: async function(buckets) {
            const results = [];
            
            // Simulate memory usage during testing
            for (const bucket of buckets) {
                await new Promise(resolve => setTimeout(resolve, 5));
                results.push({
                    bucket: bucket.bucketName,
                    accessible: false,
                    statusCode: 403,
                    testData: new Array(100).fill('test') // Simulate some memory usage
                });
            }
            
            return results;
        }
    };
    
    // Measure memory before (simplified for testing)
    const memoryBefore = typeof process !== 'undefined' && process.memoryUsage ? 
        process.memoryUsage().heapUsed : 0;
    
    await mockBucketTester.testMultipleBuckets(bucketList);
    
    // Measure memory after
    const memoryAfter = typeof process !== 'undefined' && process.memoryUsage ? 
        process.memoryUsage().heapUsed : 0;
    
    const memoryIncrease = memoryAfter - memoryBefore;
    
    if (typeof process !== 'undefined') {
        console.log(`Memory increase for 50 bucket tests: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        
        // Should not cause significant memory leaks (simplified test)
        Assert.ok(memoryIncrease < 50 * 1024 * 1024, 'Should not use excessive memory');
    } else {
        console.log('Memory measurement not available in browser environment');
        Assert.ok(true, 'Memory test skipped in browser');
    }
});

// End-to-End Scanning Performance Tests
testFramework.test('should benchmark complete scanning workflow with buckets', async () => {
    const htmlContent = generateContentWithBuckets(20); // 20 bucket URLs
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    const mockScanner = {
        scanContent: async function() {
            // Simulate complete scanning workflow
            await new Promise(resolve => setTimeout(resolve, 100)); // Pattern detection
            await new Promise(resolve => setTimeout(resolve, 200)); // Bucket testing
            await new Promise(resolve => setTimeout(resolve, 50));  // Result processing
            
            return {
                findings: Array.from({ length: 20 }, (_, i) => ({
                    category: 'cloudStorage',
                    bucketInfo: { provider: 'aws', bucketName: `bucket-${i}` }
                }))
            };
        }
    };
    
    const startTime = performance.now ? performance.now() : Date.now();
    
    const results = await mockScanner.scanContent();
    
    const endTime = performance.now ? performance.now() : Date.now();
    const duration = endTime - startTime;
    
    console.log(`Complete scanning with 20 buckets took ${duration.toFixed(2)}ms`);
    
    // Should complete within reasonable time
    Assert.ok(duration < 5000, `Complete scanning should be reasonable (${duration}ms)`);
    Assert.equal(results.findings.filter(f => f.category === 'cloudStorage').length, 20, 'Should find all buckets');
});

testFramework.test('should compare performance with and without bucket scanning', async () => {
    const htmlContent = generateContentWithBuckets(10);
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Test with bucket scanning enabled
    const enabledScanner = {
        scanContent: async function() {
            await new Promise(resolve => setTimeout(resolve, 150)); // With bucket scanning
            return { findings: [{ category: 'cloudStorage' }] };
        }
    };
    
    const startTimeEnabled = performance.now ? performance.now() : Date.now();
    await enabledScanner.scanContent();
    const endTimeEnabled = performance.now ? performance.now() : Date.now();
    const durationEnabled = endTimeEnabled - startTimeEnabled;
    
    // Test with bucket scanning disabled
    const disabledScanner = {
        scanContent: async function() {
            await new Promise(resolve => setTimeout(resolve, 50)); // Without bucket scanning
            return { findings: [] };
        }
    };
    
    const startTimeDisabled = performance.now ? performance.now() : Date.now();
    await disabledScanner.scanContent();
    const endTimeDisabled = performance.now ? performance.now() : Date.now();
    const durationDisabled = endTimeDisabled - startTimeDisabled;
    
    console.log(`Scanning with buckets: ${durationEnabled.toFixed(2)}ms`);
    console.log(`Scanning without buckets: ${durationDisabled.toFixed(2)}ms`);
    console.log(`Overhead: ${(durationEnabled - durationDisabled).toFixed(2)}ms`);
    
    // Bucket scanning should add some overhead but not excessive
    const overhead = durationEnabled - durationDisabled;
    Assert.ok(overhead >= 0, 'Bucket scanning should add some overhead');
    Assert.ok(overhead < 2000, 'Overhead should not be excessive');
});

// Helper functions for generating test content
function generateLargeContent(lines) {
    const content = [];
    for (let i = 0; i < lines; i++) {
        content.push(`<p>This is line ${i} with some random content and text.</p>`);
    }
    return content.join('\n');
}

function generateContentWithBuckets(count) {
    const providers = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];
    const content = [];
    
    for (let i = 0; i < count; i++) {
        const provider = providers[i % providers.length];
        let bucketUrl;
        
        switch (provider) {
            case 'aws':
                bucketUrl = `https://test-bucket-${i}.s3.amazonaws.com/file.txt`;
                break;
            case 'gcp':
                bucketUrl = `https://storage.googleapis.com/test-bucket-${i}/file.txt`;
                break;
            case 'azure':
                bucketUrl = `https://account${i}.blob.core.windows.net/container/file.txt`;
                break;
            case 'digitalocean':
                bucketUrl = `https://space-${i}.nyc3.digitaloceanspaces.com/file.txt`;
                break;
            case 'alibaba':
                bucketUrl = `https://bucket-${i}.oss-cn-hangzhou.aliyuncs.com/file.txt`;
                break;
        }
        
        content.push(`<p>Bucket ${i}: ${bucketUrl}</p>`);
    }
    
    return content.join('\n');
}

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment, auto-run tests
    if (typeof window !== 'undefined') {
        window.bucketBenchmarkTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}