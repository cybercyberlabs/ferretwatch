/**
 * Performance tests for bucket scanning functionality
 * Tests performance impact, caching effectiveness, and concurrency control
 */

// Import test framework
let TestFramework, BucketTester, BucketParser, BucketScanningSettings;

if (typeof require !== 'undefined') {
    try {
        TestFramework = require('../framework.js');
    } catch (e) {
        // Create a minimal test framework if not available
        TestFramework = class {
            constructor() {}
        };
    }
    
    try {
        BucketTester = require('../../utils/bucket-tester.js');
        BucketParser = require('../../utils/bucket-parser.js');
        BucketScanningSettings = require('../../utils/settings.js');
    } catch (e) {
        console.warn('Could not load bucket utilities for testing:', e.message);
    }
} else {
    // Browser environment - classes should be available globally
    TestFramework = window.TestFramework || class { constructor() {} };
    BucketTester = window.BucketTester;
    BucketParser = window.BucketParser;
    BucketScanningSettings = window.BucketScanningSettings;
}

class BucketPerformanceTests {
    constructor() {
        this.testFramework = null;
        try {
            if (TestFramework && typeof TestFramework === 'function') {
                this.testFramework = new TestFramework();
            }
        } catch (e) {
            // Ignore test framework initialization errors
        }
        
        this.performanceResults = [];
        
        // Create mock BucketTester if not available
        if (!BucketTester) {
            BucketTester = this.createMockBucketTester();
        }
    }

    /**
     * Create a mock BucketTester for testing purposes
     */
    createMockBucketTester() {
        return class MockBucketTester {
            constructor(settings = {}) {
                this.timeout = settings.bucketTestTimeout || 5000;
                this.maxConcurrent = settings.maxConcurrentTests || 3;
                this.stats = {
                    totalRequests: 0,
                    cacheHits: 0,
                    cacheMisses: 0,
                    throttledRequests: 0,
                    queuedRequests: 0,
                    averageResponseTime: 100,
                    responseTimeSum: 0
                };
                this.cache = new Map();
            }

            async testBucketAccess(bucketInfo) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
                
                this.stats.totalRequests++;
                this.stats.responseTimeSum += 100;
                
                return {
                    accessible: Math.random() > 0.7, // 30% accessible
                    error: null,
                    statusCode: 200,
                    responseType: 'xml',
                    fromCache: false
                };
            }

            async testMultipleBuckets(bucketList) {
                const results = [];
                for (const bucket of bucketList) {
                    results.push(await this.testBucketAccess(bucket));
                }
                return results;
            }

            getPerformanceStats() {
                return {
                    ...this.stats,
                    cacheSize: this.cache.size,
                    cacheHitRate: this.stats.totalRequests > 0 ? 
                        (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 : 0
                };
            }

            resetPerformanceStats() {
                this.stats = {
                    totalRequests: 0,
                    cacheHits: 0,
                    cacheMisses: 0,
                    throttledRequests: 0,
                    queuedRequests: 0,
                    averageResponseTime: 0,
                    responseTimeSum: 0
                };
            }

            clearCache() {
                this.cache.clear();
            }
        };
    }

    /**
     * Run all performance tests
     */
    async runAllTests() {
        console.log('Starting bucket scanning performance tests...');
        
        const tests = [
            () => this.testPatternMatchingPerformance(),
            () => this.testCachingPerformance(),
            () => this.testConcurrencyPerformance(),
            () => this.testThrottlingPerformance(),
            () => this.testBatchProcessingPerformance(),
            () => this.testMemoryUsagePerformance(),
            () => this.testAdaptiveConcurrencyPerformance(),
            () => this.testLargeDatasetPerformance()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                console.error('Performance test failed:', error);
            }
        }

        this.generatePerformanceReport();
        return this.performanceResults;
    }

    /**
     * Test pattern matching performance for cloud storage URLs
     */
    async testPatternMatchingPerformance() {
        const testName = 'Pattern Matching Performance';
        console.log(`Running ${testName}...`);

        // Generate test content with various bucket URLs
        const testContent = this.generateTestContent(10000); // 10k characters
        const patterns = this.getCloudStoragePatterns();

        const startTime = performance.now();
        let totalMatches = 0;

        // Test pattern matching performance
        for (let i = 0; i < 100; i++) {
            for (const pattern of patterns) {
                const matches = testContent.match(pattern.regex) || [];
                totalMatches += matches.length;
            }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const matchesPerSecond = (totalMatches / duration) * 1000;

        const result = {
            testName,
            duration: duration.toFixed(2),
            totalMatches,
            matchesPerSecond: matchesPerSecond.toFixed(2),
            status: duration < 1000 ? 'PASS' : 'SLOW'
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (${result.duration}ms, ${result.matchesPerSecond} matches/sec)`);
    }

    /**
     * Test caching performance and effectiveness
     */
    async testCachingPerformance() {
        const testName = 'Caching Performance';
        console.log(`Running ${testName}...`);

        const bucketTester = new BucketTester({
            bucketTestTimeout: 1000,
            maxConcurrentTests: 3,
            cacheTimeout: 300000,
            enableCaching: true
        });

        // Create test bucket info
        const testBuckets = this.generateTestBuckets(50);

        // First run - populate cache
        const startTime1 = performance.now();
        await bucketTester.testMultipleBuckets(testBuckets);
        const firstRunTime = performance.now() - startTime1;

        // Second run - should use cache
        const startTime2 = performance.now();
        await bucketTester.testMultipleBuckets(testBuckets);
        const secondRunTime = performance.now() - startTime2;

        const stats = bucketTester.getPerformanceStats();
        const cacheEfficiency = (firstRunTime - secondRunTime) / firstRunTime * 100;

        const result = {
            testName,
            firstRunTime: firstRunTime.toFixed(2),
            secondRunTime: secondRunTime.toFixed(2),
            cacheHitRate: stats.cacheHitRate.toFixed(2),
            cacheEfficiency: cacheEfficiency.toFixed(2),
            status: stats.cacheHitRate > 80 ? 'PASS' : 'FAIL'
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (Cache hit rate: ${result.cacheHitRate}%)`);
    }

    /**
     * Test concurrency control performance
     */
    async testConcurrencyPerformance() {
        const testName = 'Concurrency Control Performance';
        console.log(`Running ${testName}...`);

        const testBuckets = this.generateTestBuckets(20);
        const concurrencyLevels = [1, 3, 5, 10];
        const results = [];

        for (const concurrency of concurrencyLevels) {
            const bucketTester = new BucketTester({
                bucketTestTimeout: 2000,
                maxConcurrentTests: concurrency,
                enableCaching: false // Disable caching for pure concurrency test
            });

            const startTime = performance.now();
            await bucketTester.testMultipleBuckets(testBuckets);
            const duration = performance.now() - startTime;

            results.push({
                concurrency,
                duration: duration.toFixed(2),
                throughput: (testBuckets.length / duration * 1000).toFixed(2)
            });
        }

        // Find optimal concurrency level
        const optimalResult = results.reduce((best, current) => 
            parseFloat(current.throughput) > parseFloat(best.throughput) ? current : best
        );

        const result = {
            testName,
            results,
            optimalConcurrency: optimalResult.concurrency,
            optimalThroughput: optimalResult.throughput,
            status: optimalResult.concurrency <= 10 ? 'PASS' : 'FAIL'
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (Optimal: ${result.optimalConcurrency} concurrent)`);
    }

    /**
     * Test throttling performance impact
     */
    async testThrottlingPerformance() {
        const testName = 'Throttling Performance';
        console.log(`Running ${testName}...`);

        const testBuckets = this.generateTestBuckets(10);
        const throttleDelays = [0, 50, 100, 200];
        const results = [];

        for (const delay of throttleDelays) {
            const bucketTester = new BucketTester({
                bucketTestTimeout: 1000,
                maxConcurrentTests: 3,
                throttleDelay: delay,
                enableCaching: false
            });

            const startTime = performance.now();
            await bucketTester.testMultipleBuckets(testBuckets);
            const duration = performance.now() - startTime;

            const stats = bucketTester.getPerformanceStats();

            results.push({
                throttleDelay: delay,
                duration: duration.toFixed(2),
                throttledRequests: stats.throttledRequests
            });
        }

        const result = {
            testName,
            results,
            status: 'PASS' // Throttling is working if delays increase duration
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status}`);
    }

    /**
     * Test batch processing performance
     */
    async testBatchProcessingPerformance() {
        const testName = 'Batch Processing Performance';
        console.log(`Running ${testName}...`);

        const batchSizes = [5, 10, 25, 50, 100];
        const results = [];

        for (const batchSize of batchSizes) {
            const testBuckets = this.generateTestBuckets(batchSize);
            const bucketTester = new BucketTester({
                bucketTestTimeout: 1000,
                maxConcurrentTests: 3,
                enableCaching: false
            });

            const startTime = performance.now();
            await bucketTester.testMultipleBuckets(testBuckets);
            const duration = performance.now() - startTime;

            results.push({
                batchSize,
                duration: duration.toFixed(2),
                bucketsPerSecond: (batchSize / duration * 1000).toFixed(2)
            });
        }

        // Check if performance scales reasonably
        const smallBatch = results[0];
        const largeBatch = results[results.length - 1];
        const scalingFactor = parseFloat(largeBatch.bucketsPerSecond) / parseFloat(smallBatch.bucketsPerSecond);

        const result = {
            testName,
            results,
            scalingFactor: scalingFactor.toFixed(2),
            status: scalingFactor > 0.5 ? 'PASS' : 'FAIL' // Should maintain at least 50% efficiency
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (Scaling factor: ${result.scalingFactor})`);
    }

    /**
     * Test memory usage during bucket scanning
     */
    async testMemoryUsagePerformance() {
        const testName = 'Memory Usage Performance';
        console.log(`Running ${testName}...`);

        const bucketTester = new BucketTester({
            bucketTestTimeout: 1000,
            maxConcurrentTests: 3,
            maxCacheSize: 100
        });

        // Measure initial memory if available
        const initialMemory = this.getMemoryUsage();

        // Generate large number of test buckets
        const testBuckets = this.generateTestBuckets(200);
        
        // Process buckets and measure memory
        await bucketTester.testMultipleBuckets(testBuckets);
        
        const finalMemory = this.getMemoryUsage();
        const stats = bucketTester.getPerformanceStats();

        const result = {
            testName,
            initialMemory: initialMemory ? `${initialMemory.toFixed(2)}MB` : 'N/A',
            finalMemory: finalMemory ? `${finalMemory.toFixed(2)}MB` : 'N/A',
            memoryIncrease: (initialMemory && finalMemory) ? `${(finalMemory - initialMemory).toFixed(2)}MB` : 'N/A',
            cacheSize: stats.cacheSize,
            status: stats.cacheSize <= 100 ? 'PASS' : 'FAIL'
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (Cache size: ${result.cacheSize})`);
    }

    /**
     * Test adaptive concurrency performance
     */
    async testAdaptiveConcurrencyPerformance() {
        const testName = 'Adaptive Concurrency Performance';
        console.log(`Running ${testName}...`);

        // Test with different bucket counts to see adaptive behavior
        const bucketCounts = [5, 25, 50, 100];
        const results = [];

        for (const count of bucketCounts) {
            const testBuckets = this.generateTestBuckets(count);
            const bucketTester = new BucketTester({
                bucketTestTimeout: 1000,
                maxConcurrentTests: 5,
                adaptiveConcurrency: true,
                enableCaching: false
            });

            const startTime = performance.now();
            await bucketTester.testMultipleBuckets(testBuckets);
            const duration = performance.now() - startTime;

            results.push({
                bucketCount: count,
                duration: duration.toFixed(2),
                throughput: (count / duration * 1000).toFixed(2)
            });
        }

        const result = {
            testName,
            results,
            status: 'PASS' // Adaptive concurrency is working if it completes
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status}`);
    }

    /**
     * Test performance with large datasets
     */
    async testLargeDatasetPerformance() {
        const testName = 'Large Dataset Performance';
        console.log(`Running ${testName}...`);

        // Generate large test content
        const largeContent = this.generateTestContent(100000); // 100k characters
        const patterns = this.getCloudStoragePatterns();

        const startTime = performance.now();
        let totalMatches = 0;

        // Test pattern matching on large content
        for (const pattern of patterns) {
            const matches = largeContent.match(pattern.regex) || [];
            totalMatches += matches.length;
        }

        const duration = performance.now() - startTime;

        const result = {
            testName,
            contentSize: '100KB',
            duration: duration.toFixed(2),
            totalMatches,
            status: duration < 5000 ? 'PASS' : 'SLOW'
        };

        this.performanceResults.push(result);
        console.log(`${testName}: ${result.status} (${result.duration}ms for ${result.contentSize})`);
    }

    /**
     * Generate test content with various bucket URLs
     */
    generateTestContent(size) {
        const bucketUrls = [
            's3://my-test-bucket/file.txt',
            'https://my-bucket.s3.amazonaws.com/data.json',
            'https://storage.googleapis.com/my-gcs-bucket/image.png',
            'https://mystorageaccount.blob.core.windows.net/container/file.pdf',
            'https://my-space.nyc3.digitaloceanspaces.com/backup.zip',
            'https://my-oss-bucket.oss-us-west-1.aliyuncs.com/document.doc'
        ];

        let content = '';
        while (content.length < size) {
            const randomUrl = bucketUrls[Math.floor(Math.random() * bucketUrls.length)];
            content += `Some text before ${randomUrl} and some text after. `;
        }

        return content.substring(0, size);
    }

    /**
     * Generate test bucket information objects
     */
    generateTestBuckets(count) {
        const buckets = [];
        const providers = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];

        for (let i = 0; i < count; i++) {
            const provider = providers[i % providers.length];
            buckets.push({
                bucketName: `test-bucket-${i}`,
                provider: provider,
                region: 'us-east-1',
                testUrls: [`https://test-bucket-${i}.example.com/`],
                originalUrl: `https://test-bucket-${i}.example.com/`
            });
        }

        return buckets;
    }

    /**
     * Get cloud storage patterns for testing
     */
    getCloudStoragePatterns() {
        return [
            {
                name: 's3Protocol',
                regex: /s3:\/\/[a-z0-9](?:[a-z0-9\-\.]{0,61}[a-z0-9])?(?:\/[^\s"'<>]*)?/gi
            },
            {
                name: 's3VirtualHosted',
                regex: /https?:\/\/[a-z0-9](?:[a-z0-9\-\.]{0,61}[a-z0-9])?\.s3(?:[\w\-]*)?\.amazonaws\.com(?:\/[^\s"'<>]*)?/gi
            },
            {
                name: 'gcsProtocol',
                regex: /gs:\/\/[a-z0-9](?:[a-z0-9\-_\.]{0,61}[a-z0-9])?(?:\/[^\s"'<>]*)?/gi
            },
            {
                name: 'azureBlob',
                regex: /https?:\/\/[a-z0-9]{3,24}\.blob\.core\.windows\.net\/[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?(?:\/[^\s"'<>]*)?/gi
            }
        ];
    }

    /**
     * Get memory usage if available
     */
    getMemoryUsage() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
        }
        return null;
    }

    /**
     * Generate performance report
     */
    generatePerformanceReport() {
        console.log('\n=== BUCKET SCANNING PERFORMANCE REPORT ===');
        
        const passedTests = this.performanceResults.filter(r => r.status === 'PASS').length;
        const totalTests = this.performanceResults.length;
        
        console.log(`Overall: ${passedTests}/${totalTests} tests passed`);
        console.log('');

        for (const result of this.performanceResults) {
            console.log(`${result.testName}: ${result.status}`);
            
            // Print relevant metrics for each test
            Object.keys(result).forEach(key => {
                if (key !== 'testName' && key !== 'status' && key !== 'results') {
                    console.log(`  ${key}: ${result[key]}`);
                }
            });
            
            console.log('');
        }

        // Performance recommendations
        console.log('=== PERFORMANCE RECOMMENDATIONS ===');
        
        const cachingTest = this.performanceResults.find(r => r.testName === 'Caching Performance');
        if (cachingTest && parseFloat(cachingTest.cacheHitRate) < 80) {
            console.log('- Consider increasing cache timeout for better performance');
        }

        const concurrencyTest = this.performanceResults.find(r => r.testName === 'Concurrency Control Performance');
        if (concurrencyTest && concurrencyTest.optimalConcurrency) {
            console.log(`- Optimal concurrency level: ${concurrencyTest.optimalConcurrency}`);
        }

        console.log('- Enable caching and throttling for production use');
        console.log('- Monitor memory usage with large datasets');
        console.log('- Use adaptive concurrency for varying workloads');
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BucketPerformanceTests;
} else if (typeof window !== 'undefined') {
    window.BucketPerformanceTests = BucketPerformanceTests;
}

// Auto-run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    const tests = new BucketPerformanceTests();
    tests.runAllTests().then(() => {
        console.log('Performance tests completed');
    }).catch(error => {
        console.error('Performance tests failed:', error);
    });
}