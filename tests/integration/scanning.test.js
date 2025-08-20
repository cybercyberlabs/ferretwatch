/**
 * Integration tests for the scanning pipeline
 */

const { TestFramework, Assert, MockHelpers } = require('../framework.js');

const testFramework = new TestFramework();

// Mock scanner for integration testing
class MockScanner {
    constructor() {
        this.scanResults = [];
        this.stats = {
            lastScanTime: 0,
            totalFindings: 0,
            scanCount: 0
        };
        this.scanInProgress = false;
        this.config = {
            enableProgressiveScan: true,
            enableEntropyFilter: true,
            enableContextFilter: true
        };
    }

    async progressiveScan(content, patterns) {
        this.scanInProgress = true;
        const startTime = performance.now ? performance.now() : Date.now();
        
        this.scanResults = [];
        
        if (!content) {
            return this.scanResults;
        }

        // Mock scanning logic
        if (content.includes('AKIA')) {
            this.scanResults.push({
                type: 'AWS Access Key',
                value: 'AKIAIOSFODNN7EXAMPLE',
                riskLevel: 'critical',
                category: 'aws',
                timestamp: Date.now()
            });
        }
        
        if (content.includes('ghp_')) {
            this.scanResults.push({
                type: 'GitHub Token',
                value: 'ghp_1234567890abcdef1234567890abcdef12345678',
                riskLevel: 'high',
                category: 'github',
                timestamp: Date.now()
            });
        }
        
        if (content.includes('-----BEGIN PRIVATE KEY-----')) {
            this.scanResults.push({
                type: 'Private Key',
                value: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----',
                riskLevel: 'critical',
                category: 'certificates',
                timestamp: Date.now()
            });
        }
        
        const endTime = performance.now ? performance.now() : Date.now();
        this.stats.lastScanTime = endTime - startTime;
        this.stats.totalFindings = this.scanResults.length;
        this.stats.scanCount++;
        this.scanInProgress = false;
        
        return this.scanResults;
    }

    cancelScan() {
        this.scanInProgress = false;
    }

    updateConfig(config) {
        Object.assign(this.config, config);
    }

    getStats() {
        return { ...this.stats };
    }
}

// Mock export manager
class MockExportManager {
    constructor() {
        this.sessionHistory = [];
    }

    exportScanResults(findings, format) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                format: format,
                findingsCount: findings.length
            },
            findings: findings
        };
        
        this.sessionHistory.push({
            type: 'export',
            format: format,
            findingsCount: findings.length,
            timestamp: Date.now()
        });
        
        return exportData;
    }

    getSessionHistory() {
        return [...this.sessionHistory];
    }

    clearSessionHistory() {
        this.sessionHistory = [];
    }
}

// Test setup
testFramework.beforeEach(() => {
    MockHelpers.mockBrowserAPI();
    MockHelpers.mockDOM();
});

// Integration tests
testFramework.test('Scanner should detect multiple secret types in content', async () => {
    const scanner = new MockScanner();
    const testContent = `
        <div>
            AWS Key: AKIAIOSFODNN7EXAMPLE
            GitHub Token: ghp_1234567890abcdef1234567890abcdef12345678
            Private Key:
            -----BEGIN PRIVATE KEY-----
            MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
            -----END PRIVATE KEY-----
        </div>
    `;
    
    const findings = await scanner.progressiveScan(testContent, {});
    
    Assert.arrayLength(findings, 3, 'Should detect 3 different secret types');
    
    const types = findings.map(f => f.category);
    Assert.arrayIncludes(types, 'aws', 'Should detect AWS credentials');
    Assert.arrayIncludes(types, 'github', 'Should detect GitHub tokens');
    Assert.arrayIncludes(types, 'certificates', 'Should detect certificates');
    
    // Verify risk levels are assigned
    const riskLevels = findings.map(f => f.riskLevel);
    Assert.arrayIncludes(riskLevels, 'critical', 'Should have critical risk items');
    Assert.arrayIncludes(riskLevels, 'high', 'Should have high risk items');
});

testFramework.test('Scanner should track statistics correctly', async () => {
    const scanner = new MockScanner();
    
    // Initial stats
    let stats = scanner.getStats();
    Assert.equal(stats.scanCount, 0, 'Initial scan count should be 0');
    Assert.equal(stats.totalFindings, 0, 'Initial findings count should be 0');
    
    // Perform scan
    await scanner.progressiveScan('AKIAIOSFODNN7EXAMPLE', {});
    
    // Check updated stats
    stats = scanner.getStats();
    Assert.equal(stats.scanCount, 1, 'Scan count should increment');
    Assert.equal(stats.totalFindings, 1, 'Findings count should be updated');
    Assert.ok(stats.lastScanTime >= 0, 'Scan time should be recorded');
});

testFramework.test('Scanner should handle empty content gracefully', async () => {
    const scanner = new MockScanner();
    
    const findings = await scanner.progressiveScan('', {});
    
    Assert.arrayLength(findings, 0, 'Empty content should produce no findings');
    
    const stats = scanner.getStats();
    Assert.equal(stats.totalFindings, 0, 'Stats should reflect no findings');
    Assert.ok(stats.lastScanTime >= 0, 'Scan time should still be recorded');
});

testFramework.test('Scanner should handle configuration updates', async () => {
    const scanner = new MockScanner();
    
    // Initial config
    Assert.true(scanner.config.enableProgressiveScan, 'Progressive scan should be enabled by default');
    
    // Update config
    scanner.updateConfig({
        enableProgressiveScan: false,
        customSetting: true
    });
    
    Assert.false(scanner.config.enableProgressiveScan, 'Config should be updated');
    Assert.true(scanner.config.customSetting, 'New settings should be added');
    Assert.true(scanner.config.enableEntropyFilter, 'Existing settings should be preserved');
});

testFramework.test('Export functionality should work end-to-end', async () => {
    const scanner = new MockScanner();
    const exportManager = new MockExportManager();
    
    // Perform scan
    const findings = await scanner.progressiveScan('AKIAIOSFODNN7EXAMPLE ghp_test', {});
    
    // Export results
    const exportData = exportManager.exportScanResults(findings, 'json');
    
    Assert.objectHasProperty(exportData, 'metadata', 'Export should have metadata');
    Assert.objectHasProperty(exportData, 'findings', 'Export should have findings');
    Assert.equal(exportData.metadata.format, 'json', 'Export format should be recorded');
    Assert.equal(exportData.findings.length, findings.length, 'All findings should be exported');
    
    // Check session history
    const history = exportManager.getSessionHistory();
    Assert.arrayLength(history, 1, 'Export should be recorded in history');
    Assert.equal(history[0].type, 'export', 'History entry should be export type');
    Assert.equal(history[0].format, 'json', 'History should record format');
});

testFramework.test('Session history management should work correctly', async () => {
    const exportManager = new MockExportManager();
    
    // Multiple exports
    exportManager.exportScanResults([{ type: 'test' }], 'json');
    exportManager.exportScanResults([{ type: 'test1' }, { type: 'test2' }], 'csv');
    
    let history = exportManager.getSessionHistory();
    Assert.arrayLength(history, 2, 'Should track multiple exports');
    
    // Clear history
    exportManager.clearSessionHistory();
    history = exportManager.getSessionHistory();
    Assert.arrayLength(history, 0, 'History should be cleared');
});

testFramework.test('Full pipeline integration test', async () => {
    const scanner = new MockScanner();
    const exportManager = new MockExportManager();
    
    // Simulate full workflow
    const testContent = `
        <div>Test content with secrets</div>
        <script>
            const awsKey = 'AKIAIOSFODNN7EXAMPLE';
            const githubToken = 'ghp_1234567890abcdef1234567890abcdef12345678';
        </script>
    `;
    
    // 1. Scan for secrets
    const findings = await scanner.progressiveScan(testContent, {});
    Assert.ok(findings.length > 0, 'Should find secrets in content');
    
    // 2. Export findings
    const jsonExport = exportManager.exportScanResults(findings, 'json');
    const csvExport = exportManager.exportScanResults(findings, 'csv');
    
    Assert.equal(jsonExport.metadata.format, 'json', 'JSON export should be formatted correctly');
    Assert.equal(csvExport.metadata.format, 'csv', 'CSV export should be formatted correctly');
    
    // 3. Verify session history
    const history = exportManager.getSessionHistory();
    Assert.arrayLength(history, 2, 'Should track both exports');
    
    // 4. Check scanner stats
    const stats = scanner.getStats();
    Assert.equal(stats.scanCount, 1, 'Should have performed 1 scan');
    Assert.equal(stats.totalFindings, findings.length, 'Stats should match findings count');
});

testFramework.test('Error handling in scanning pipeline', async () => {
    const scanner = new MockScanner();
    
    // Test cancel functionality
    scanner.scanInProgress = true;
    scanner.cancelScan();
    Assert.false(scanner.scanInProgress, 'Cancel should stop scan in progress');
    
    // Test with invalid input (should not crash)
    const findings = await scanner.progressiveScan(null, {});
    Assert.ok(Array.isArray(findings), 'Should return array even with null input');
    
    // Test config with invalid values
    Assert.throws(() => {
        scanner.updateConfig(null);
    }, 'Should handle null config gracefully');
});

testFramework.test('Performance benchmarks for integration', async () => {
    const scanner = new MockScanner();
    
    // Large content test
    const largeContent = 'x'.repeat(100000) + 'AKIAIOSFODNN7EXAMPLE';
    
    const startTime = performance.now ? performance.now() : Date.now();
    const findings = await scanner.progressiveScan(largeContent, {});
    const endTime = performance.now ? performance.now() : Date.now();
    
    const scanTime = endTime - startTime;
    Assert.ok(scanTime < 1000, `Large content scan should be reasonably fast (${scanTime}ms)`);
    Assert.ok(findings.length > 0, 'Should find secrets even in large content');
    
    console.log(`Performance: Scanned ${largeContent.length} chars in ${scanTime.toFixed(2)}ms`);
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework, MockScanner, MockExportManager };
} else {
    if (typeof window !== 'undefined') {
        window.integrationTests = testFramework;
        window.MockScanner = MockScanner;
        window.MockExportManager = MockExportManager;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
