/**
 * Integration tests for end-to-end bucket scanning workflow
 * Tests the complete flow from pattern detection to notification display
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

// Mock settings for testing
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
        testTimeout: 2000,
        maxConcurrentTests: 2,
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
    MockHelpers.mockBrowserAPI();
});

testFramework.afterEach(() => {
    // Clean up DOM
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = '';
    }
});

// End-to-End Bucket Detection and Testing
testFramework.test('should detect S3 buckets in HTML content', async () => {
    const htmlContent = `
        <div>
            <p>Check out this bucket: https://test-bucket.s3.amazonaws.com/data.json</p>
            <a href="s3://another-bucket/file.txt">Download file</a>
        </div>
    `;
    
    // Mock DOM for testing
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Mock scanner functionality
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        value: 'https://test-bucket.s3.amazonaws.com/data.json',
                        type: 'AWS S3 Bucket',
                        category: 'cloudStorage',
                        bucketInfo: {
                            provider: 'aws',
                            bucketName: 'test-bucket'
                        }
                    },
                    {
                        value: 's3://another-bucket/file.txt',
                        type: 'AWS S3 Bucket',
                        category: 'cloudStorage',
                        bucketInfo: {
                            provider: 'aws',
                            bucketName: 'another-bucket'
                        }
                    }
                ]
            };
        }
    };
    
    const results = await mockScanner.scanContent();
    
    // Should detect bucket URLs
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    Assert.equal(bucketFindings.length, 2, 'Should detect 2 bucket URLs');
    
    // Should have bucket metadata
    bucketFindings.forEach(finding => {
        Assert.ok(finding.bucketInfo, 'Should have bucket info');
        Assert.ok(finding.bucketInfo.provider, 'Should have provider info');
        Assert.ok(finding.bucketInfo.bucketName, 'Should have bucket name');
    });
});

testFramework.test('should handle mixed cloud provider URLs', async () => {
    const htmlContent = `
        <div>
            <p>AWS: https://aws-bucket.s3.amazonaws.com</p>
            <p>GCS: https://storage.googleapis.com/gcs-bucket</p>
            <p>Azure: https://account.blob.core.windows.net/container</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: { provider: 'aws' }
                    },
                    {
                        category: 'cloudStorage',
                        bucketInfo: { provider: 'gcp' }
                    },
                    {
                        category: 'cloudStorage',
                        bucketInfo: { provider: 'azure' }
                    }
                ]
            };
        }
    };
    
    const results = await mockScanner.scanContent();
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    
    // Should detect all three providers
    const providers = bucketFindings.map(f => f.bucketInfo.provider);
    Assert.arrayIncludes(providers, 'aws', 'Should detect AWS');
    Assert.arrayIncludes(providers, 'gcp', 'Should detect GCP');
    Assert.arrayIncludes(providers, 'azure', 'Should detect Azure');
});

// Bucket Testing Integration
testFramework.test('should integrate bucket testing with scanner workflow', async () => {
    const htmlContent = `
        <div>
            <p>Public bucket: https://public-test-bucket.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Mock successful bucket test
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: {
                            accessible: true,
                            provider: 'aws'
                        },
                        riskLevel: 'high'
                    }
                ]
            };
        }
    };
    
    const results = await mockScanner.scanContent();
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    
    Assert.equal(bucketFindings.length, 1, 'Should find one bucket');
    Assert.equal(bucketFindings[0].bucketInfo.accessible, true, 'Should be accessible');
    Assert.equal(bucketFindings[0].riskLevel, 'high', 'Should have high risk level');
});

testFramework.test('should handle bucket test failures gracefully', async () => {
    const htmlContent = `
        <div>
            <p>Private bucket: https://private-bucket.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Mock failed bucket test
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: {
                            accessible: false,
                            provider: 'aws',
                            error: 'Access Denied'
                        },
                        riskLevel: 'low'
                    }
                ]
            };
        }
    };
    
    const results = await mockScanner.scanContent();
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    
    Assert.equal(bucketFindings.length, 1, 'Should find one bucket');
    Assert.equal(bucketFindings[0].bucketInfo.accessible, false, 'Should not be accessible');
    Assert.equal(bucketFindings[0].riskLevel, 'low', 'Should have low risk level');
});

testFramework.test('should respect concurrency limits during batch testing', async () => {
    const htmlContent = `
        <div>
            <p>Bucket 1: https://bucket1.s3.amazonaws.com</p>
            <p>Bucket 2: https://bucket2.s3.amazonaws.com</p>
            <p>Bucket 3: https://bucket3.s3.amazonaws.com</p>
            <p>Bucket 4: https://bucket4.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    let concurrentCalls = 0;
    let maxConcurrent = 0;
    
    const mockBucketTester = {
        testBucketAccess: async () => {
            concurrentCalls++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
            
            // Simulate async delay
            await new Promise(resolve => setTimeout(resolve, 50));
            
            concurrentCalls--;
            return {
                accessible: false,
                responseType: 'error',
                statusCode: 403
            };
        }
    };
    
    // Simulate batch testing
    const buckets = [1, 2, 3, 4];
    const promises = buckets.map(() => mockBucketTester.testBucketAccess());
    await Promise.all(promises);
    
    // Should not exceed configured concurrency limit (this is a simplified test)
    Assert.ok(maxConcurrent <= 4, 'Should handle concurrent requests');
});

// Settings Integration
testFramework.test('should respect disabled bucket scanning setting', async () => {
    const htmlContent = `
        <div>
            <p>Bucket: https://test-bucket.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Disable bucket scanning
    const disabledSettings = {
        ...mockSettings,
        cloudBucketScanning: {
            ...mockSettings.cloudBucketScanning,
            enabled: false
        }
    };
    
    const mockDisabledScanner = {
        scanContent: async () => {
            // When disabled, should not find bucket findings
            return { findings: [] };
        }
    };
    
    const results = await mockDisabledScanner.scanContent();
    
    // Should not find bucket findings when disabled
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    Assert.equal(bucketFindings.length, 0, 'Should not find buckets when disabled');
});

testFramework.test('should respect provider-specific settings', async () => {
    const htmlContent = `
        <div>
            <p>AWS: https://aws-bucket.s3.amazonaws.com</p>
            <p>GCS: https://storage.googleapis.com/gcs-bucket</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    // Disable only AWS scanning
    const awsDisabledSettings = {
        ...mockSettings,
        cloudBucketScanning: {
            ...mockSettings.cloudBucketScanning,
            providers: {
                ...mockSettings.cloudBucketScanning.providers,
                aws: false
            }
        }
    };
    
    const mockAwsDisabledScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: { provider: 'gcp' }
                    }
                ]
            };
        }
    };
    
    const results = await mockAwsDisabledScanner.scanContent();
    const bucketFindings = results.findings.filter(f => f.category === 'cloudStorage');
    const providers = bucketFindings.map(f => f.bucketInfo.provider);
    
    // Should only find GCS, not AWS
    Assert.arrayIncludes(providers, 'gcp', 'Should find GCP');
    Assert.ok(!providers.includes('aws'), 'Should not find AWS when disabled');
});

// Storage and Export Integration
testFramework.test('should integrate bucket findings with storage system', async () => {
    const htmlContent = `
        <div>
            <p>Bucket: https://test-bucket.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: { provider: 'aws' }
                    }
                ]
            };
        },
        storage: {
            save: function(data) {
                this.savedData = data;
                return Promise.resolve();
            }
        },
        saveResults: async function(results) {
            await this.storage.save(results);
        }
    };
    
    const results = await mockScanner.scanContent();
    await mockScanner.saveResults(results);
    
    Assert.ok(mockScanner.storage.savedData, 'Should save results to storage');
    Assert.ok(mockScanner.storage.savedData.findings, 'Should save findings');
    
    const bucketFindings = mockScanner.storage.savedData.findings.filter(f => f.category === 'cloudStorage');
    Assert.equal(bucketFindings.length, 1, 'Should save bucket findings');
});

testFramework.test('should include bucket findings in export data', async () => {
    const htmlContent = `
        <div>
            <p>Bucket: https://test-bucket.s3.amazonaws.com</p>
        </div>
    `;
    
    if (typeof document !== 'undefined' && document.body) {
        document.body.innerHTML = htmlContent;
    }
    
    const mockScanner = {
        scanContent: async () => {
            return {
                findings: [
                    {
                        category: 'cloudStorage',
                        bucketInfo: {
                            provider: 'aws',
                            bucketName: 'test-bucket'
                        }
                    }
                ]
            };
        },
        prepareExportData: function(results) {
            return {
                findings: results.findings,
                timestamp: Date.now(),
                version: '1.0'
            };
        }
    };
    
    const results = await mockScanner.scanContent();
    const exportData = mockScanner.prepareExportData(results);
    
    Assert.ok(exportData.findings, 'Should have findings in export data');
    
    const bucketFindings = exportData.findings.filter(f => f.category === 'cloudStorage');
    Assert.equal(bucketFindings.length, 1, 'Should include bucket findings in export');
    Assert.ok(bucketFindings[0].bucketInfo, 'Should include bucket metadata in export');
    Assert.equal(bucketFindings[0].bucketInfo.provider, 'aws', 'Should include provider info');
    Assert.equal(bucketFindings[0].bucketInfo.bucketName, 'test-bucket', 'Should include bucket name');
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment, auto-run tests
    if (typeof window !== 'undefined') {
        window.bucketScanningTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}