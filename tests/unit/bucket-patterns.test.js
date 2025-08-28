/**
 * Unit tests for cloud bucket pattern detection
 * Tests the pattern matching functionality for various cloud storage providers
 */

let TestFramework, Assert, patterns;

// Load testing framework and patterns
if (typeof require !== 'undefined') {
    const framework = require('../framework.js');
    TestFramework = framework.TestFramework;
    Assert = framework.Assert;

    const patternsModule = require('../../config/patterns.js');
    patterns = patternsModule.SECURITY_PATTERNS;
} else if (typeof window !== 'undefined') {
    TestFramework = window.TestFramework;
    Assert = window.Assert;
    patterns = window.SECURITY_PATTERNS;
}

const testFramework = new TestFramework();

// AWS S3 Pattern Detection Tests
testFramework.test('should detect s3:// protocol URLs', () => {
    const s3Pattern = patterns.cloudStorage.s3Protocol.pattern;
    const testUrls = [
        's3://ab',
        's3://abc/path/to/file.txt',
        's3://test-bucket-123'
    ];
    
    testUrls.forEach(url => {
        // Reset regex state before each test
        s3Pattern.lastIndex = 0;
        const matches = url.match(s3Pattern);
        Assert.ok(matches && matches.length > 0, `Should match S3 URL: ${url}`);
    });
});

testFramework.test('should detect https S3 bucket URLs', () => {
    const s3Pattern = patterns.cloudStorage.s3VirtualHosted.pattern;
    const testUrls = [
        'https://ab.s3.amazonaws.com',
        'https://abc.s3.amazonaws.com/file.txt',
        'https://test-bucket-123.s3.amazonaws.com'
    ];
    
    testUrls.forEach(url => {
        s3Pattern.lastIndex = 0;
        const matches = url.match(s3Pattern);
        Assert.ok(matches && matches.length > 0, `Should match S3 HTTPS URL: ${url}`);
    });
});

testFramework.test('should not match non-S3 URLs', () => {
    const s3Pattern = patterns.cloudStorage.s3Protocol.pattern;
    const nonS3Urls = [
        'https://example.com',
        'https://storage.googleapis.com/bucket',
        'ftp://s3.amazonaws.com/bucket'
    ];
    
    nonS3Urls.forEach(url => {
        s3Pattern.lastIndex = 0;
        const matches = url.match(s3Pattern);
        Assert.ok(!matches || matches.length === 0, `Should not match non-S3 URL: ${url}`);
    });
});

// Google Cloud Storage Pattern Detection Tests
testFramework.test('should detect gs:// protocol URLs', () => {
    const gcsPattern = patterns.cloudStorage.gcsProtocol.pattern;
    const testUrls = [
        'gs://ab',
        'gs://abc/path/to/file.txt',
        'gs://test-bucket-gcs-123'
    ];
    
    testUrls.forEach(url => {
        gcsPattern.lastIndex = 0;
        const matches = url.match(gcsPattern);
        Assert.ok(matches && matches.length > 0, `Should match GCS URL: ${url}`);
    });
});

testFramework.test('should detect https GCS URLs', () => {
    const gcsPattern = patterns.cloudStorage.gcsApi.pattern;
    const testUrls = [
        'https://storage.googleapis.com/ab',
        'https://storage.googleapis.com/abc/file.txt',
        'https://storage.googleapis.com/test-bucket-123/path/to/file'
    ];
    
    testUrls.forEach(url => {
        gcsPattern.lastIndex = 0;
        const matches = url.match(gcsPattern);
        Assert.ok(matches && matches.length > 0, `Should match GCS HTTPS URL: ${url}`);
    });
});

testFramework.test('should not match non-GCS URLs', () => {
    const gcsPattern = patterns.cloudStorage.gcsProtocol.pattern;
    const nonGcsUrls = [
        'https://example.com',
        'https://ab.s3.amazonaws.com',
        'gs://'
    ];
    
    nonGcsUrls.forEach(url => {
        gcsPattern.lastIndex = 0;
        const matches = url.match(gcsPattern);
        Assert.ok(!matches || matches.length === 0, `Should not match non-GCS URL: ${url}`);
    });
});

// Azure Blob Storage Pattern Detection Tests
testFramework.test('should detect Azure blob storage URLs', () => {
    const azurePattern = patterns.cloudStorage.azureBlob.pattern;
    const testUrls = [
        'https://mystorageaccount.blob.core.windows.net/ab',
        'https://test123.blob.core.windows.net/abc/file.txt',
        'https://storageaccount.blob.core.windows.net/test-container-123/path/file'
    ];
    
    testUrls.forEach(url => {
        azurePattern.lastIndex = 0;
        const matches = url.match(azurePattern);
        Assert.ok(matches && matches.length > 0, `Should match Azure URL: ${url}`);
    });
});

testFramework.test('should not match non-Azure URLs', () => {
    const azurePattern = patterns.cloudStorage.azureBlob.pattern;
    const nonAzureUrls = [
        'https://example.com',
        'https://storage.googleapis.com/bucket',
        'https://s3.amazonaws.com/bucket'
    ];
    
    nonAzureUrls.forEach(url => {
        azurePattern.lastIndex = 0;
        const matches = url.match(azurePattern);
        Assert.ok(!matches || matches.length === 0, `Should not match non-Azure URL: ${url}`);
    });
});

// DigitalOcean Spaces Pattern Detection Tests
testFramework.test('should detect DigitalOcean Spaces URLs', () => {
    const doPattern = patterns.cloudStorage.doSpaces.pattern;
    const testUrls = [
        'https://ab.nyc3.digitaloceanspaces.com',
        'https://abc.fra1.digitaloceanspaces.com/file.txt',
        'https://example-space.sfo2.digitaloceanspaces.com/path/to/file'
    ];
    
    testUrls.forEach(url => {
        doPattern.lastIndex = 0;
        const matches = url.match(doPattern);
        Assert.ok(matches && matches.length > 0, `Should match DigitalOcean URL: ${url}`);
    });
});

testFramework.test('should not match non-DigitalOcean URLs', () => {
    const doPattern = patterns.cloudStorage.doSpaces.pattern;
    const nonDoUrls = [
        'https://example.com',
        'https://storage.googleapis.com/bucket',
        'https://s3.amazonaws.com/bucket'
    ];
    
    nonDoUrls.forEach(url => {
        doPattern.lastIndex = 0;
        const matches = url.match(doPattern);
        Assert.ok(!matches || matches.length === 0, `Should not match non-DigitalOcean URL: ${url}`);
    });
});

// Alibaba Cloud OSS Pattern Detection Tests
testFramework.test('should detect Alibaba Cloud OSS URLs', () => {
    const ossPattern = patterns.cloudStorage.alibabaOss.pattern;
    const testUrls = [
        'https://ab.oss-cn-hangzhou.aliyuncs.com',
        'https://abc.oss-us-west-1.aliyuncs.com/file.txt',
        'https://example-bucket.oss-ap-southeast-1.aliyuncs.com/path/file'
    ];
    
    testUrls.forEach(url => {
        ossPattern.lastIndex = 0;
        const matches = url.match(ossPattern);
        Assert.ok(matches && matches.length > 0, `Should match Alibaba OSS URL: ${url}`);
    });
});

testFramework.test('should not match non-OSS URLs', () => {
    const ossPattern = patterns.cloudStorage.alibabaOss.pattern;
    const nonOssUrls = [
        'https://example.com',
        'https://storage.googleapis.com/bucket',
        'https://s3.amazonaws.com/bucket'
    ];
    
    nonOssUrls.forEach(url => {
        ossPattern.lastIndex = 0;
        const matches = url.match(ossPattern);
        Assert.ok(!matches || matches.length === 0, `Should not match non-OSS URL: ${url}`);
    });
});

// Pattern Integration Tests
testFramework.test('should detect multiple cloud storage URLs in text', () => {
    const testText = `
        Check out these buckets:
        s3://my-s3-bucket/data.json
        https://storage.googleapis.com/my-gcs-bucket/file.txt
        https://mystorageaccount.blob.core.windows.net/container/blob
        https://my-space.nyc3.digitaloceanspaces.com/image.png
        https://my-bucket.oss-cn-hangzhou.aliyuncs.com/document.pdf
    `;
    
    const allPatterns = Object.values(patterns.cloudStorage);
    let totalMatches = 0;
    
    allPatterns.forEach(patternConfig => {
        const matches = testText.match(patternConfig.pattern);
        if (matches) {
            totalMatches += matches.length;
        }
    });
    
    Assert.equal(totalMatches, 5, 'Should detect all 5 cloud storage URLs');
});

testFramework.test('should handle edge cases and malformed URLs', () => {
    const edgeCases = [
        'https://.s3.amazonaws.com',
        'gs://',
        'https://storage.googleapis.com/',
        'https://.blob.core.windows.net',
        'not-a-url'
    ];
    
    const allPatterns = Object.values(patterns.cloudStorage);
    
    edgeCases.forEach(testCase => {
        allPatterns.forEach(patternConfig => {
            const matches = testCase.match(patternConfig.pattern);
            // Should either match properly or not match at all
            if (matches) {
                Assert.ok(matches[0], `Pattern should match properly for: ${testCase}`);
            }
        });
    });
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment, auto-run tests
    if (typeof window !== 'undefined') {
        window.bucketPatternTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}