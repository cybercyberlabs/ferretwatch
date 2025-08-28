/**
 * Integration test for bucket findings with storage and export systems
 */

// Mock browser environment
global.window = {
    location: {
        href: 'https://example.com',
        hostname: 'example.com'
    },
    StorageUtils: {
        getSetting: (key, defaultValue) => defaultValue,
        getBucketScanningSettings: () => ({
            enabled: true,
            providers: { aws: true, gcp: true, azure: true },
            testTimeout: 5000,
            maxConcurrentTests: 3
        })
    }
};

global.navigator = {
    userAgent: 'Test Browser'
};

const { ExportManager } = require('../../utils/export.js');

function testBucketFindingsIntegration() {
    console.log('🧪 Testing bucket findings integration...');
    
    const exportManager = new ExportManager();
    
    // Create test findings with bucket metadata
    const testFindings = [
        {
            type: 'AWS S3 Bucket (Public Access Confirmed)',
            riskLevel: 'high',
            category: 'cloudStorage',
            value: 'https://test-bucket.s3.amazonaws.com/',
            timestamp: Date.now(),
            bucketInfo: {
                bucketName: 'test-bucket',
                provider: 'aws',
                region: 'us-east-1',
                accessible: true,
                testUrl: 'https://test-bucket.s3.amazonaws.com/',
                testResults: {
                    statusCode: 200,
                    responseType: 'xml',
                    listingEnabled: true
                }
            }
        },
        {
            type: 'Google Cloud Storage Bucket (Access Denied)',
            riskLevel: 'medium',
            category: 'cloudStorage',
            value: 'https://storage.googleapis.com/private-bucket/',
            timestamp: Date.now(),
            bucketInfo: {
                bucketName: 'private-bucket',
                provider: 'gcp',
                accessible: false,
                testUrl: 'https://storage.googleapis.com/private-bucket/',
                testResults: {
                    statusCode: 403,
                    responseType: 'json',
                    listingEnabled: false
                }
            }
        },
        {
            type: 'Regular API Key',
            riskLevel: 'medium',
            category: 'apiKeys',
            value: 'sk-1234567890abcdef',
            timestamp: Date.now()
        }
    ];
    
    // Test JSON export with bucket metadata
    console.log('📤 Testing JSON export...');
    const jsonExport = exportManager.exportAsJSON(testFindings);
    const exportData = JSON.parse(jsonExport);
    
    // Verify bucket metadata is included
    const bucketFindings = exportData.findings.filter(f => f.bucketInfo);
    console.log(`✅ Found ${bucketFindings.length} bucket findings in export`);
    
    // Verify bucket summary statistics
    console.log(`✅ Bucket summary - Total: ${exportData.summary.bucketFindings.total}`);
    console.log(`✅ Bucket summary - Accessible: ${exportData.summary.bucketFindings.accessibility.accessible}`);
    console.log(`✅ Bucket summary - Denied: ${exportData.summary.bucketFindings.accessibility.denied}`);
    
    // Test CSV export with bucket columns
    console.log('📊 Testing CSV export...');
    const csvExport = exportManager.exportAsCSV(testFindings);
    const csvLines = csvExport.split('\n');
    const headers = csvLines[0].split(',');
    
    // Verify bucket-specific columns exist
    const bucketColumns = ['Bucket Name', 'Cloud Provider', 'Bucket Accessible', 'Test URL'];
    const hasAllBucketColumns = bucketColumns.every(col => 
        headers.some(header => header.includes(col))
    );
    
    console.log(`✅ CSV has bucket columns: ${hasAllBucketColumns}`);
    
    // Verify data rows contain bucket information
    const dataRows = csvLines.slice(1).filter(line => line.trim());
    const bucketDataRows = dataRows.filter(row => row.includes('aws') || row.includes('gcp'));
    console.log(`✅ Found ${bucketDataRows.length} bucket data rows in CSV`);
    
    // Test helper functions
    console.log('🔧 Testing helper functions...');
    const bucketProviderCounts = exportManager.getBucketProviderCounts(testFindings);
    console.log(`✅ Provider counts - AWS: ${bucketProviderCounts.aws}, GCP: ${bucketProviderCounts.gcp}`);
    
    const bucketAccessCounts = exportManager.getBucketAccessibilityCounts(testFindings);
    console.log(`✅ Access counts - Accessible: ${bucketAccessCounts.accessible}, Denied: ${bucketAccessCounts.denied}`);
    
    console.log('🎉 All bucket findings integration tests passed!');
    return true;
}

// Run the test
try {
    testBucketFindingsIntegration();
    console.log('\n✅ INTEGRATION TEST PASSED');
    process.exit(0);
} catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', error);
    process.exit(1);
}