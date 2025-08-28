/**
 * Unit Tests for BucketParser
 * Tests URL parsing accuracy across different cloud providers
 */

// Import the test framework and BucketParser
let TestFramework, Assert, BucketParser;

if (typeof require !== 'undefined') {
    const framework = require('../framework.js');
    TestFramework = framework.TestFramework;
    Assert = framework.Assert;
    BucketParser = require('../../utils/bucket-parser.js');
} else {
    TestFramework = window.TestFramework;
    Assert = window.Assert;
    BucketParser = window.BucketParser;
}

// Create test framework instance
const testFramework = new TestFramework();

// AWS S3 URL Parsing Tests
testFramework.test('should parse s3:// protocol URLs', () => {
    const url = 's3://my-test-bucket/path/to/file.txt';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-test-bucket');
    Assert.equal(result.provider, 'aws');
    Assert.equal(result.path, 'path/to/file.txt');
    Assert.equal(result.region, 'us-east-1');
    Assert.ok(result.testUrls.length > 0);
});

testFramework.test('should parse virtual-hosted style URLs', () => {
    const url = 'https://my-bucket.s3.us-west-2.amazonaws.com/file.jpg';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.region, 'us-west-2');
    Assert.equal(result.path, 'file.jpg');
});

testFramework.test('should parse path style URLs', () => {
    const url = 'https://s3.eu-west-1.amazonaws.com/my-bucket/folder/file.pdf';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.region, 'eu-west-1');
    Assert.equal(result.path, 'folder/file.pdf');
});

testFramework.test('should parse S3 website URLs', () => {
    const url = 'https://my-website-bucket.s3-website-us-east-1.amazonaws.com/index.html';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-website-bucket');
    Assert.equal(result.region, 'us-east-1');
    Assert.equal(result.path, 'index.html');
    Assert.equal(result.isWebsite, true);
});

testFramework.test('should handle bucket names with dots and hyphens', () => {
    const url = 's3://my-bucket.with.dots/';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-bucket.with.dots');
});

testFramework.test('should default to us-east-1 for URLs without region', () => {
    const url = 'https://my-bucket.s3.amazonaws.com/';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.region, 'us-east-1');
});

// Google Cloud Storage URL Parsing Tests
testFramework.test('should parse gs:// protocol URLs', () => {
    const url = 'gs://my-gcs-bucket/path/to/object';
    const result = BucketParser.parseBucketUrl(url, 'gcp');
    
    Assert.equal(result.bucketName, 'my-gcs-bucket');
    Assert.equal(result.provider, 'gcp');
    Assert.equal(result.path, 'path/to/object');
});

testFramework.test('should parse googleapis.com URLs', () => {
    const url = 'https://storage.googleapis.com/my-bucket/image.png';
    const result = BucketParser.parseBucketUrl(url, 'gcp');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.path, 'image.png');
});

testFramework.test('should parse cloud.google.com URLs', () => {
    const url = 'https://storage.cloud.google.com/test-bucket/data.json';
    const result = BucketParser.parseBucketUrl(url, 'gcp');
    
    Assert.equal(result.bucketName, 'test-bucket');
    Assert.equal(result.path, 'data.json');
});

testFramework.test('should handle bucket names with underscores', () => {
    const url = 'gs://my_bucket_name/';
    const result = BucketParser.parseBucketUrl(url, 'gcp');
    
    Assert.equal(result.bucketName, 'my_bucket_name');
});

// Azure Blob Storage URL Parsing Tests
testFramework.test('should parse Azure blob URLs', () => {
    const url = 'https://mystorageaccount.blob.core.windows.net/mycontainer/blob.txt';
    const result = BucketParser.parseBucketUrl(url, 'azure');
    
    Assert.equal(result.accountName, 'mystorageaccount');
    Assert.equal(result.bucketName, 'mycontainer');
    Assert.equal(result.path, 'blob.txt');
    Assert.equal(result.region, 'global');
});

testFramework.test('should parse Azure China URLs', () => {
    const url = 'https://chinaaccount.blob.core.chinacloudapi.cn/container/file.pdf';
    const result = BucketParser.parseBucketUrl(url, 'azure');
    
    Assert.equal(result.accountName, 'chinaaccount');
    Assert.equal(result.region, 'china');
});

testFramework.test('should parse Azure US Government URLs', () => {
    const url = 'https://govaccount.blob.core.usgovcloudapi.net/govcontainer/document.docx';
    const result = BucketParser.parseBucketUrl(url, 'azure');
    
    Assert.equal(result.accountName, 'govaccount');
    Assert.equal(result.region, 'usgov');
});

// DigitalOcean Spaces URL Parsing Tests
testFramework.test('should parse DigitalOcean Spaces URLs', () => {
    const url = 'https://my-space.nyc3.digitaloceanspaces.com/file.zip';
    const result = BucketParser.parseBucketUrl(url, 'digitalocean');
    
    Assert.equal(result.bucketName, 'my-space');
    Assert.equal(result.region, 'nyc3');
    Assert.equal(result.path, 'file.zip');
    Assert.equal(result.isCdn, false);
});

testFramework.test('should parse DigitalOcean CDN URLs', () => {
    const url = 'https://my-space.fra1.cdn.digitaloceanspaces.com/image.jpg';
    const result = BucketParser.parseBucketUrl(url, 'digitalocean');
    
    Assert.equal(result.bucketName, 'my-space');
    Assert.equal(result.region, 'fra1');
    Assert.equal(result.isCdn, true);
});

// Alibaba Cloud OSS URL Parsing Tests
testFramework.test('should parse Alibaba OSS URLs', () => {
    const url = 'https://my-oss-bucket.oss-cn-hangzhou.aliyuncs.com/data/file.csv';
    const result = BucketParser.parseBucketUrl(url, 'alibaba');
    
    Assert.equal(result.bucketName, 'my-oss-bucket');
    Assert.equal(result.region, 'cn-hangzhou');
    Assert.equal(result.path, 'data/file.csv');
    Assert.equal(result.isInternal, false);
});

testFramework.test('should parse internal OSS URLs', () => {
    const url = 'https://internal-bucket.oss-us-west-1-internal.aliyuncs.com/';
    const result = BucketParser.parseBucketUrl(url, 'alibaba');
    
    Assert.equal(result.bucketName, 'internal-bucket');
    Assert.equal(result.region, 'us-west-1');
    Assert.equal(result.isInternal, true);
});

// IBM Cloud Object Storage URL Parsing Tests
testFramework.test('should parse IBM COS URLs', () => {
    const url = 'https://my-cos-bucket.s3.us-south.cloud-object-storage.appdomain.cloud/document.pdf';
    const result = BucketParser.parseBucketUrl(url, 'ibm');
    
    Assert.equal(result.bucketName, 'my-cos-bucket');
    Assert.equal(result.region, 'us-south');
    Assert.equal(result.path, 'document.pdf');
});

// Oracle Cloud Infrastructure URL Parsing Tests
testFramework.test('should parse Oracle OCI URLs', () => {
    const url = 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/my-namespace/b/my-bucket/o/file.txt';
    const result = BucketParser.parseBucketUrl(url, 'oracle');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.region, 'us-ashburn-1');
    Assert.equal(result.namespace, 'my-namespace');
    Assert.equal(result.path, 'file.txt');
});

// Wasabi Hot Cloud Storage URL Parsing Tests
testFramework.test('should parse Wasabi URLs', () => {
    const url = 'https://my-wasabi-bucket.s3.us-east-1.wasabisys.com/backup.tar.gz';
    const result = BucketParser.parseBucketUrl(url, 'wasabi');
    
    Assert.equal(result.bucketName, 'my-wasabi-bucket');
    Assert.equal(result.region, 'us-east-1');
    Assert.equal(result.path, 'backup.tar.gz');
});

// Backblaze B2 URL Parsing Tests
testFramework.test('should parse Backblaze B2 URLs', () => {
    const url = 'https://f003.backblazeb2.com/file/my-b2-bucket/archive.zip';
    const result = BucketParser.parseBucketUrl(url, 'backblaze');
    
    Assert.equal(result.bucketName, 'my-b2-bucket');
    Assert.equal(result.endpoint, 'f003');
    Assert.equal(result.path, 'archive.zip');
});

// Test URL Generation Tests
testFramework.test('should generate AWS S3 test URLs', () => {
    const bucketInfo = {
        provider: 'aws',
        bucketName: 'test-bucket',
        region: 'us-west-2'
    };
    
    const testUrls = BucketParser.generateTestUrls(bucketInfo);
    
    Assert.arrayIncludes(testUrls, 'https://test-bucket.s3.us-west-2.amazonaws.com/');
    Assert.arrayIncludes(testUrls, 'https://s3.us-west-2.amazonaws.com/test-bucket/');
});

testFramework.test('should generate GCP test URLs', () => {
    const bucketInfo = {
        provider: 'gcp',
        bucketName: 'gcp-bucket'
    };
    
    const testUrls = BucketParser.generateTestUrls(bucketInfo);
    
    Assert.arrayIncludes(testUrls, 'https://storage.googleapis.com/gcp-bucket/');
    Assert.arrayIncludes(testUrls, 'https://storage.cloud.google.com/gcp-bucket/');
});

testFramework.test('should generate Azure test URLs', () => {
    const bucketInfo = {
        provider: 'azure',
        accountName: 'myaccount',
        bucketName: 'mycontainer',
        region: 'global'
    };
    
    const testUrls = BucketParser.generateTestUrls(bucketInfo);
    
    Assert.ok(testUrls[0].includes('myaccount.blob.core.windows.net/mycontainer'));
    Assert.ok(testUrls[0].includes('restype=container&comp=list'));
});

testFramework.test('should not generate test URLs for S3 websites', () => {
    const bucketInfo = {
        provider: 'aws',
        bucketName: 'website-bucket',
        region: 'us-east-1',
        isWebsite: true
    };
    
    const testUrls = BucketParser.generateTestUrls(bucketInfo);
    
    Assert.arrayLength(testUrls, 0);
});

testFramework.test('should not generate test URLs for Backblaze B2', () => {
    const bucketInfo = {
        provider: 'backblaze',
        bucketName: 'b2-bucket',
        endpoint: 'f003'
    };
    
    const testUrls = BucketParser.generateTestUrls(bucketInfo);
    
    Assert.arrayLength(testUrls, 0);
});

// URL Normalization Tests
testFramework.test('should remove trailing slashes', () => {
    const url = 'https://example.com/path///';
    const normalized = BucketParser.normalizeUrl(url);
    
    Assert.equal(normalized, 'https://example.com/path');
});

testFramework.test('should trim whitespace', () => {
    const url = '  https://example.com/path  ';
    const normalized = BucketParser.normalizeUrl(url);
    
    Assert.equal(normalized, 'https://example.com/path');
});

testFramework.test('should add https protocol if missing', () => {
    const url = 'example.com/path';
    const normalized = BucketParser.normalizeUrl(url);
    
    Assert.equal(normalized, 'https://example.com/path');
});

testFramework.test('should preserve s3:// and gs:// protocols', () => {
    Assert.equal(BucketParser.normalizeUrl('s3://bucket'), 's3://bucket');
    Assert.equal(BucketParser.normalizeUrl('gs://bucket'), 'gs://bucket');
});

testFramework.test('should handle empty or null URLs', () => {
    Assert.equal(BucketParser.normalizeUrl(''), '');
    Assert.equal(BucketParser.normalizeUrl(null), '');
    Assert.equal(BucketParser.normalizeUrl(undefined), '');
});

// URL Validation Tests
testFramework.test('should validate AWS S3 URLs', () => {
    Assert.true(BucketParser.isValidCloudStorageUrl('s3://my-bucket'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://bucket.s3.amazonaws.com'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://s3.amazonaws.com/bucket'));
});

testFramework.test('should validate Google Cloud Storage URLs', () => {
    Assert.true(BucketParser.isValidCloudStorageUrl('gs://my-bucket'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://storage.googleapis.com/bucket'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://storage.cloud.google.com/bucket'));
});

testFramework.test('should validate Azure Blob Storage URLs', () => {
    Assert.true(BucketParser.isValidCloudStorageUrl('https://account.blob.core.windows.net/container'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://account.blob.core.chinacloudapi.cn/container'));
});

testFramework.test('should validate DigitalOcean Spaces URLs', () => {
    Assert.true(BucketParser.isValidCloudStorageUrl('https://bucket.nyc3.digitaloceanspaces.com'));
    Assert.true(BucketParser.isValidCloudStorageUrl('https://bucket.fra1.cdn.digitaloceanspaces.com'));
});

testFramework.test('should reject invalid URLs', () => {
    Assert.false(BucketParser.isValidCloudStorageUrl('https://example.com'));
    Assert.false(BucketParser.isValidCloudStorageUrl('ftp://bucket.s3.amazonaws.com'));
    Assert.false(BucketParser.isValidCloudStorageUrl(''));
    Assert.false(BucketParser.isValidCloudStorageUrl(null));
    Assert.false(BucketParser.isValidCloudStorageUrl(123));
});

// Error Handling Tests
testFramework.test('should throw error for missing URL', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('', 'aws');
    });
});

testFramework.test('should throw error for null URL', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl(null, 'aws');
    });
});

testFramework.test('should throw error for non-string URL', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl(123, 'aws');
    });
});

testFramework.test('should throw error for URL too long', () => {
    const longUrl = 'https://bucket.s3.amazonaws.com/' + 'x'.repeat(2050);
    Assert.throws(() => {
        BucketParser.parseBucketUrl(longUrl, 'aws');
    });
});

testFramework.test('should throw error for missing provider', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('s3://bucket', '');
    });
});

testFramework.test('should throw error for null provider', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('s3://bucket', null);
    });
});

testFramework.test('should throw error for non-string provider', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('s3://bucket', 123);
    });
});

testFramework.test('should throw error for unsupported provider', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('https://example.com', 'unsupported');
    });
});

testFramework.test('should throw error for invalid AWS URL format', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('https://invalid-aws-url.com', 'aws');
    });
});

testFramework.test('should throw error for invalid GCP URL format', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('https://invalid-gcp-url.com', 'gcp');
    });
});

testFramework.test('should throw error for invalid Azure URL format', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('https://invalid-azure-url.com', 'azure');
    });
});

testFramework.test('should throw error for bucket name too short', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('s3://ab', 'aws');
    });
});

testFramework.test('should throw error for bucket name too long', () => {
    const longBucketName = 'x'.repeat(64);
    Assert.throws(() => {
        BucketParser.parseBucketUrl(`s3://${longBucketName}`, 'aws');
    });
});

testFramework.test('should throw error for bucket name with invalid characters', () => {
    Assert.throws(() => {
        BucketParser.parseBucketUrl('s3://bucket_with_UPPERCASE', 'aws');
    });
});

// Enhanced URL Validation Tests
testFramework.test('should reject URLs with suspicious patterns', () => {
    Assert.false(BucketParser.isValidCloudStorageUrl('javascript:alert(1)'));
    Assert.false(BucketParser.isValidCloudStorageUrl('data:text/html,<script>'));
    Assert.false(BucketParser.isValidCloudStorageUrl('https://bucket.s3.amazonaws.com/<script>'));
    Assert.false(BucketParser.isValidCloudStorageUrl('https://localhost/bucket'));
    Assert.false(BucketParser.isValidCloudStorageUrl('https://127.0.0.1/bucket'));
    Assert.false(BucketParser.isValidCloudStorageUrl('https://192.168.1.1/bucket'));
});

testFramework.test('should reject URLs that are too long', () => {
    const longUrl = 'https://bucket.s3.amazonaws.com/' + 'x'.repeat(2050);
    Assert.false(BucketParser.isValidCloudStorageUrl(longUrl));
});

testFramework.test('should reject URLs with unencoded spaces', () => {
    Assert.false(BucketParser.isValidCloudStorageUrl('https://bucket name.s3.amazonaws.com/'));
});

testFramework.test('should accept URLs with encoded spaces in paths', () => {
    Assert.true(BucketParser.isValidCloudStorageUrl('https://bucket-name.s3.amazonaws.com/path%20with%20spaces/'));
});

// Input Validation Tests
testFramework.test('should validate input parameters comprehensively', () => {
    // Test all invalid input combinations
    const invalidInputs = [
        [null, 'aws'],
        [undefined, 'aws'],
        ['', 'aws'],
        ['   ', 'aws'],
        [123, 'aws'],
        ['s3://bucket', null],
        ['s3://bucket', undefined],
        ['s3://bucket', ''],
        ['s3://bucket', 123],
        ['s3://bucket', 'invalid-provider']
    ];

    invalidInputs.forEach(([url, provider]) => {
        Assert.throws(() => {
            BucketParser.parseBucketUrl(url, provider);
        });
    });
});

// Normalization Edge Cases
testFramework.test('should handle normalization edge cases', () => {
    Assert.equal(BucketParser.normalizeUrl(''), '');
    Assert.equal(BucketParser.normalizeUrl('   '), '');
    Assert.equal(BucketParser.normalizeUrl(null), '');
    Assert.equal(BucketParser.normalizeUrl(undefined), '');
});

testFramework.test('should preserve valid protocols during normalization', () => {
    Assert.equal(BucketParser.normalizeUrl('s3://bucket/path/'), 's3://bucket/path');
    Assert.equal(BucketParser.normalizeUrl('gs://bucket/path/'), 'gs://bucket/path');
    Assert.equal(BucketParser.normalizeUrl('https://bucket.com/path/'), 'https://bucket.com/path');
});

// Edge Cases Tests
testFramework.test('should handle URLs with no path', () => {
    const url = 's3://my-bucket';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.path, '');
});

testFramework.test('should handle URLs with empty path', () => {
    const url = 'https://my-bucket.s3.amazonaws.com/';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.bucketName, 'my-bucket');
    Assert.equal(result.path, '');
});

testFramework.test('should handle complex paths with special characters', () => {
    const url = 's3://my-bucket/path/with%20spaces/and-special_chars.file.ext';
    const result = BucketParser.parseBucketUrl(url, 'aws');
    
    Assert.equal(result.path, 'path/with%20spaces/and-special_chars.file.ext');
});

testFramework.test('should preserve case sensitivity in bucket names', () => {
    const url = 'gs://My-Bucket-With-Mixed-Case';
    const result = BucketParser.parseBucketUrl(url, 'gcp');
    
    Assert.equal(result.bucketName, 'My-Bucket-With-Mixed-Case');
});

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.bucketParserTests = testFramework;
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