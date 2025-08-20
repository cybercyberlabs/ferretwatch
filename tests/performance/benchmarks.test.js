/**
 * Performance benchmarking tests for the credential scanner
 */

// Load testing framework
if (typeof require !== 'undefined') {
    const { TestFramework, Assert, MockHelpers } = require('../framework.js');
}

const testFramework = new TestFramework();

// Performance test utilities
class PerformanceBenchmark {
    constructor() {
        this.results = [];
        this.thresholds = {
            scanTime: 500,      // Maximum scan time in ms
            memoryUsage: 50,    // Maximum memory usage in MB
            patternMatches: 100 // Maximum time per pattern match in ms
        };
    }

    async benchmark(name, testFn) {
        const startTime = performance.now ? performance.now() : Date.now();
        const startMemory = this.getMemoryUsage();
        
        try {
            const result = await testFn();
            
            const endTime = performance.now ? performance.now() : Date.now();
            const endMemory = this.getMemoryUsage();
            
            const executionTime = endTime - startTime;
            const memoryDelta = endMemory - startMemory;
            
            const benchmarkResult = {
                name,
                executionTime,
                memoryDelta,
                memoryStart: startMemory,
                memoryEnd: endMemory,
                result,
                timestamp: Date.now()
            };
            
            this.results.push(benchmarkResult);
            
            // Log performance metrics
            console.log(`📊 ${name}:`);
            console.log(`   Time: ${executionTime.toFixed(2)}ms`);
            console.log(`   Memory: ${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(2)}MB`);
            
            return benchmarkResult;
        } catch (error) {
            console.error(`❌ Benchmark failed: ${name}`, error);
            throw error;
        }
    }

    getMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed / 1024 / 1024; // MB
        } else if (typeof performance !== 'undefined' && performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return 0;
    }

    generateReport() {
        return {
            summary: {
                totalTests: this.results.length,
                avgExecutionTime: this.results.reduce((sum, r) => sum + r.executionTime, 0) / this.results.length,
                totalMemoryDelta: this.results.reduce((sum, r) => sum + r.memoryDelta, 0),
                slowestTest: this.results.reduce((prev, curr) => prev.executionTime > curr.executionTime ? prev : curr, this.results[0])
            },
            details: this.results,
            thresholds: this.thresholds
        };
    }

    checkThresholds() {
        const failures = [];
        
        this.results.forEach(result => {
            if (result.executionTime > this.thresholds.scanTime) {
                failures.push(`${result.name} exceeded execution time threshold: ${result.executionTime}ms > ${this.thresholds.scanTime}ms`);
            }
            if (result.memoryDelta > this.thresholds.memoryUsage) {
                failures.push(`${result.name} exceeded memory threshold: ${result.memoryDelta}MB > ${this.thresholds.memoryUsage}MB`);
            }
        });
        
        return failures;
    }
}

// Mock scanner with instrumentation
class InstrumentedScanner {
    constructor() {
        this.patternMatchTimes = new Map();
        this.scanMetrics = {
            totalPatterns: 0,
            matchedPatterns: 0,
            avgPatternTime: 0
        };
    }

    async scanWithPatterns(content, patterns) {
        const findings = [];
        this.scanMetrics.totalPatterns = patterns.length || 10; // Mock pattern count
        this.scanMetrics.matchedPatterns = 0;
        
        // Simulate pattern matching with timing
        const patternTests = [
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, test: 'AKIAIOSFODNN7EXAMPLE' },
            { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/, test: 'ghp_1234567890abcdef1234567890abcdef12345678' },
            { name: 'Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, test: '-----BEGIN PRIVATE KEY-----' },
            { name: 'Slack Token', pattern: /xox[baprs]-([0-9a-zA-Z]{10,48})/, test: 'xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx' },
            { name: 'Discord Token', pattern: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/, test: 'MjAyMzQ1Njc4OTAxMjM0NTY3.G1234H.abcdefghijklmnopqrstuvwxyz1234567890123' },
            { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, test: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' },
            { name: 'Database Connection String', pattern: /(?:mysql|postgres|mongodb):\/\/[^\s<>"]{10,}/, test: 'mysql://user:pass@host:port/db' },
            { name: 'API Key Generic', pattern: /[aA][pP][iI][_-]?[kK][eE][yY].{0,20}[0-9a-zA-Z]{20,}/, test: 'API_KEY = "sk-1234567890abcdef1234567890abcdef"' }
        ];
        
        for (const patternTest of patternTests) {
            const startTime = performance.now ? performance.now() : Date.now();
            
            // Simulate pattern matching logic
            if (content.includes(patternTest.test.split(' ')[0])) {
                findings.push({
                    type: patternTest.name,
                    value: patternTest.test,
                    riskLevel: this.getRiskLevel(patternTest.name),
                    timestamp: Date.now()
                });
                this.scanMetrics.matchedPatterns++;
            }
            
            const endTime = performance.now ? performance.now() : Date.now();
            const patternTime = endTime - startTime;
            
            this.patternMatchTimes.set(patternTest.name, patternTime);
        }
        
        // Calculate average pattern time
        const totalPatternTime = Array.from(this.patternMatchTimes.values()).reduce((sum, time) => sum + time, 0);
        this.scanMetrics.avgPatternTime = totalPatternTime / this.patternMatchTimes.size;
        
        return findings;
    }

    getRiskLevel(patternName) {
        const criticalPatterns = ['AWS Access Key', 'Private Key', 'Database Connection String'];
        const highPatterns = ['GitHub Token', 'Slack Token', 'Discord Token'];
        
        if (criticalPatterns.includes(patternName)) return 'critical';
        if (highPatterns.includes(patternName)) return 'high';
        return 'medium';
    }

    getMetrics() {
        return {
            ...this.scanMetrics,
            patternTimes: Object.fromEntries(this.patternMatchTimes)
        };
    }
}

// Test data generators
class TestDataGenerator {
    static generateTestContent(size = 'small') {
        const sizes = {
            small: 1000,
            medium: 10000,
            large: 100000,
            xlarge: 1000000
        };
        
        const targetSize = sizes[size] || sizes.small;
        const secrets = [
            'AKIAIOSFODNN7EXAMPLE',
            'ghp_1234567890abcdef1234567890abcdef12345678',
            '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----',
            'xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx',
            'mysql://username:password@localhost:3306/database'
        ];
        
        let content = '';
        const baseText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
        
        // Fill with base text
        while (content.length < targetSize * 0.8) {
            content += baseText;
        }
        
        // Inject secrets randomly
        const secretsToInject = Math.min(5, Math.floor(targetSize / 10000) + 1);
        for (let i = 0; i < secretsToInject; i++) {
            const secret = secrets[i % secrets.length];
            const insertPosition = Math.floor(Math.random() * content.length);
            content = content.slice(0, insertPosition) + '\n' + secret + '\n' + content.slice(insertPosition);
        }
        
        return content;
    }

    static generateDOM(complexity = 'simple') {
        const complexities = {
            simple: { elements: 10, depth: 2 },
            medium: { elements: 100, depth: 4 },
            complex: { elements: 1000, depth: 6 }
        };
        
        const config = complexities[complexity] || complexities.simple;
        
        // Create mock DOM structure
        return {
            elements: config.elements,
            depth: config.depth,
            textContent: this.generateTestContent('medium')
        };
    }
}

// Performance tests
const benchmark = new PerformanceBenchmark();

testFramework.test('Pattern matching performance - small content', async () => {
    const scanner = new InstrumentedScanner();
    const content = TestDataGenerator.generateTestContent('small');
    
    const result = await benchmark.benchmark('Small Content Scan', async () => {
        return await scanner.scanWithPatterns(content, {});
    });
    
    Assert.ok(result.executionTime < 100, `Small content scan should be under 100ms (${result.executionTime}ms)`);
    
    const metrics = scanner.getMetrics();
    console.log(`   Patterns: ${metrics.totalPatterns}, Matches: ${metrics.matchedPatterns}`);
    console.log(`   Avg pattern time: ${metrics.avgPatternTime.toFixed(2)}ms`);
});

testFramework.test('Pattern matching performance - medium content', async () => {
    const scanner = new InstrumentedScanner();
    const content = TestDataGenerator.generateTestContent('medium');
    
    const result = await benchmark.benchmark('Medium Content Scan', async () => {
        return await scanner.scanWithPatterns(content, {});
    });
    
    Assert.ok(result.executionTime < 250, `Medium content scan should be under 250ms (${result.executionTime}ms)`);
    
    const metrics = scanner.getMetrics();
    Assert.ok(metrics.avgPatternTime < 50, `Average pattern time should be under 50ms (${metrics.avgPatternTime}ms)`);
});

testFramework.test('Pattern matching performance - large content', async () => {
    const scanner = new InstrumentedScanner();
    const content = TestDataGenerator.generateTestContent('large');
    
    const result = await benchmark.benchmark('Large Content Scan', async () => {
        return await scanner.scanWithPatterns(content, {});
    });
    
    Assert.ok(result.executionTime < 500, `Large content scan should be under 500ms (${result.executionTime}ms)`);
    
    const metrics = scanner.getMetrics();
    console.log(`   Content length: ${content.length} chars`);
    console.log(`   Scan rate: ${Math.floor(content.length / result.executionTime)} chars/ms`);
});

testFramework.test('Memory usage during scanning', async () => {
    const scanner = new InstrumentedScanner();
    const content = TestDataGenerator.generateTestContent('large');
    
    const result = await benchmark.benchmark('Memory Usage Test', async () => {
        const findings = [];
        
        // Perform multiple scans to test memory accumulation
        for (let i = 0; i < 5; i++) {
            const scanResults = await scanner.scanWithPatterns(content, {});
            findings.push(...scanResults);
        }
        
        return findings;
    });
    
    Assert.ok(result.memoryDelta < 25, `Memory usage should be reasonable (${result.memoryDelta}MB)`);
    console.log(`   Memory efficiency: ${(result.result.length / result.memoryDelta).toFixed(2)} findings/MB`);
});

testFramework.test('Concurrent scanning performance', async () => {
    const content = TestDataGenerator.generateTestContent('medium');
    
    const result = await benchmark.benchmark('Concurrent Scans', async () => {
        const promises = [];
        
        // Start 5 concurrent scans
        for (let i = 0; i < 5; i++) {
            const scanner = new InstrumentedScanner();
            promises.push(scanner.scanWithPatterns(content, {}));
        }
        
        return await Promise.all(promises);
    });
    
    Assert.ok(result.executionTime < 1000, `Concurrent scans should complete under 1000ms (${result.executionTime}ms)`);
    Assert.ok(result.result.length === 5, 'All concurrent scans should complete');
    
    const avgTimePerScan = result.executionTime / 5;
    console.log(`   Avg time per concurrent scan: ${avgTimePerScan.toFixed(2)}ms`);
});

testFramework.test('DOM manipulation performance', async () => {
    const domStructure = TestDataGenerator.generateDOM('complex');
    
    const result = await benchmark.benchmark('DOM Manipulation', async () => {
        // Mock DOM operations
        const operations = [];
        
        // Simulate finding and highlighting elements
        for (let i = 0; i < domStructure.elements; i++) {
            operations.push({
                type: 'highlight',
                elementId: `element_${i}`,
                timestamp: Date.now()
            });
        }
        
        // Simulate cleanup operations
        for (let i = 0; i < domStructure.elements / 2; i++) {
            operations.push({
                type: 'cleanup',
                elementId: `element_${i}`,
                timestamp: Date.now()
            });
        }
        
        return operations;
    });
    
    Assert.ok(result.executionTime < 300, `DOM operations should be under 300ms (${result.executionTime}ms)`);
    
    const opsPerMs = result.result.length / result.executionTime;
    console.log(`   DOM operations rate: ${opsPerMs.toFixed(2)} ops/ms`);
});

testFramework.test('Export performance with large datasets', async () => {
    const largeFindings = [];
    
    // Generate large dataset
    for (let i = 0; i < 1000; i++) {
        largeFindings.push({
            type: 'Test Secret',
            value: `secret_${i}_${'x'.repeat(100)}`,
            riskLevel: ['low', 'medium', 'high', 'critical'][i % 4],
            category: ['aws', 'github', 'slack', 'discord'][i % 4],
            timestamp: Date.now() + i
        });
    }
    
    const result = await benchmark.benchmark('Large Dataset Export', async () => {
        // Mock export operations
        const exports = [];
        
        // JSON export
        const jsonExport = {
            metadata: { format: 'json', count: largeFindings.length },
            data: JSON.stringify(largeFindings)
        };
        exports.push(jsonExport);
        
        // CSV export simulation
        const csvExport = {
            metadata: { format: 'csv', count: largeFindings.length },
            data: largeFindings.map(f => `${f.type},${f.riskLevel},${f.category}`).join('\n')
        };
        exports.push(csvExport);
        
        return exports;
    });
    
    Assert.ok(result.executionTime < 200, `Large export should be under 200ms (${result.executionTime}ms)`);
    
    const findingsPerMs = largeFindings.length / result.executionTime;
    console.log(`   Export rate: ${findingsPerMs.toFixed(2)} findings/ms`);
});

testFramework.test('Performance regression detection', async () => {
    const content = TestDataGenerator.generateTestContent('medium');
    const scanner = new InstrumentedScanner();
    
    // Baseline measurement
    const baseline = await benchmark.benchmark('Regression Baseline', async () => {
        return await scanner.scanWithPatterns(content, {});
    });
    
    // Second measurement (should be similar)
    const comparison = await benchmark.benchmark('Regression Comparison', async () => {
        return await scanner.scanWithPatterns(content, {});
    });
    
    // Check for significant regression (>50% slower)
    const regressionThreshold = baseline.executionTime * 1.5;
    Assert.ok(comparison.executionTime < regressionThreshold, 
        `No significant performance regression detected: ${comparison.executionTime}ms vs ${baseline.executionTime}ms`);
    
    const performanceRatio = comparison.executionTime / baseline.executionTime;
    console.log(`   Performance ratio: ${performanceRatio.toFixed(2)}x`);
});

// Benchmark summary test
testFramework.test('Performance benchmark summary', async () => {
    const report = benchmark.generateReport();
    const thresholdFailures = benchmark.checkThresholds();
    
    console.log('\n📊 Performance Benchmark Summary:');
    console.log(`   Total tests: ${report.summary.totalTests}`);
    console.log(`   Average execution time: ${report.summary.avgExecutionTime.toFixed(2)}ms`);
    console.log(`   Total memory delta: ${report.summary.totalMemoryDelta.toFixed(2)}MB`);
    console.log(`   Slowest test: ${report.summary.slowestTest?.name} (${report.summary.slowestTest?.executionTime.toFixed(2)}ms)`);
    
    if (thresholdFailures.length > 0) {
        console.log('\n⚠️  Performance Threshold Failures:');
        thresholdFailures.forEach(failure => console.log(`   - ${failure}`));
    } else {
        console.log('\n✅ All performance thresholds met');
    }
    
    Assert.equal(thresholdFailures.length, 0, 'All performance thresholds should be met');
    Assert.ok(report.summary.totalTests > 0, 'Should have run performance tests');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        testFramework, 
        PerformanceBenchmark, 
        InstrumentedScanner, 
        TestDataGenerator,
        benchmark 
    };
} else {
    if (typeof window !== 'undefined') {
        window.performanceTests = testFramework;
        window.PerformanceBenchmark = PerformanceBenchmark;
        window.InstrumentedScanner = InstrumentedScanner;
        window.TestDataGenerator = TestDataGenerator;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        const report = benchmark.generateReport();
        console.log('\n' + JSON.stringify(report, null, 2));
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
