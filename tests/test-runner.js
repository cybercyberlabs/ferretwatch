/**
 * Master test runner for the Firefox Credential Scanner Extension
 * Orchestrates unit tests, integration tests, and performance benchmarks
 */

const { TestFramework, Assert, MockHelpers } = require('./framework.js');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.suites = new Map();
        this.results = {
            unit: null,
            integration: null,
            performance: null,
            overall: null
        };
        this.startTime = null;
        this.endTime = null;
        this.config = {
            runUnit: true,
            runIntegration: true,
            runPerformance: true,
            verbose: true,
            generateReport: true,
            exitOnFailure: true
        };
    }

    registerSuite(name, testFramework) {
        this.suites.set(name, testFramework);
        console.log(`📋 Registered test suite: ${name}`);
    }

    async loadTestSuites() {
        try {
            // Register unit tests
            if (this.config.runUnit) {
                if (typeof require !== 'undefined') {
                    const patternsTest = require('./unit/patterns.test.js');
                    // const utilsTest = require('./unit/utils.test.js');
                    this.registerSuite('patterns', patternsTest.testFramework);
                    // this.registerSuite('utils', utilsTest.testFramework);
                } else {
                    // Browser environment - tests should be loaded via script tags
                    if (typeof window !== 'undefined') {
                        if (window.patternsTests) this.registerSuite('patterns', window.patternsTests);
                        if (window.utilsTests) this.registerSuite('utils', window.utilsTests);
                    }
                }
            }

            // Register integration tests
            if (this.config.runIntegration) {
                if (typeof require !== 'undefined') {
                    const integrationTest = require('./integration/scanning.test.js');
                    this.registerSuite('integration', integrationTest.testFramework);
                } else {
                    if (typeof window !== 'undefined' && window.integrationTests) {
                        this.registerSuite('integration', window.integrationTests);
                    }
                }
            }

            // Register performance tests
            if (this.config.runPerformance) {
                if (typeof require !== 'undefined') {
                    const performanceTest = require('./performance/benchmarks.test.js');
                    this.registerSuite('performance', performanceTest.testFramework);
                } else {
                    if (typeof window !== 'undefined' && window.performanceTests) {
                        this.registerSuite('performance', window.performanceTests);
                    }
                }
            }

            console.log(`🔧 Loaded ${this.suites.size} test suites`);
            return true;
        } catch (error) {
            console.error('❌ Failed to load test suites:', error);
            return false;
        }
    }

    async runSuite(name, testFramework) {
        console.log(`\n🚀 Running ${name} tests...`);
        console.log('='.repeat(50));
        
        try {
            const results = await testFramework.runAll();
            
            console.log(`\n📊 ${name.toUpperCase()} TEST RESULTS:`);
            console.log(`   Passed: ${results.passed} ✅`);
            console.log(`   Failed: ${results.failed} ❌`);
            console.log(`   Total:  ${results.total}`);
            console.log(`   Time:   ${results.executionTime}ms`);
            
            if (results.failed > 0) {
                console.log(`\n❌ Failed tests in ${name}:`);
                results.failures.forEach(failure => {
                    console.log(`   - ${failure.testName}: ${failure.error}`);
                });
            }
            
            return results;
        } catch (error) {
            console.error(`❌ Error running ${name} tests:`, error);
            return {
                passed: 0,
                failed: 1,
                total: 1,
                executionTime: 0,
                failures: [{ testName: 'Suite Error', error: error.message }]
            };
        }
    }

    async runAll() {
        this.startTime = Date.now();
        console.log('🧪 Starting Firefox Credential Scanner Extension Tests');
        console.log('=' .repeat(60));
        
        // Load all test suites
        const loaded = await this.loadTestSuites();
        if (!loaded) {
            console.error('❌ Failed to load test suites');
            return false;
        }

        const overallResults = {
            passed: 0,
            failed: 0,
            total: 0,
            executionTime: 0,
            suiteResults: {}
        };

        // Run each test suite
        for (const [name, testFramework] of this.suites) {
            const suiteResults = await this.runSuite(name, testFramework);
            
            this.results[name] = suiteResults;
            overallResults.suiteResults[name] = suiteResults;
            overallResults.passed += suiteResults.passed;
            overallResults.failed += suiteResults.failed;
            overallResults.total += suiteResults.total;
            overallResults.executionTime += suiteResults.executionTime;
            
            // Exit early on failure if configured
            if (this.config.exitOnFailure && suiteResults.failed > 0) {
                console.log(`\n🛑 Stopping tests due to failures in ${name} suite`);
                break;
            }
        }

        this.endTime = Date.now();
        this.results.overall = overallResults;
        
        // Display final results
        this.displayFinalResults();
        
        // Generate report if requested
        if (this.config.generateReport) {
            await this.generateReport();
        }
        
        return overallResults.failed === 0;
    }

    displayFinalResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🏁 FINAL TEST RESULTS');
        console.log('=' .repeat(60));
        
        const overall = this.results.overall;
        const totalTime = this.endTime - this.startTime;
        
        console.log(`📊 Overall Results:`);
        console.log(`   ✅ Passed: ${overall.passed}`);
        console.log(`   ❌ Failed: ${overall.failed}`);
        console.log(`   📋 Total:  ${overall.total}`);
        console.log(`   ⏱️  Time:   ${totalTime}ms`);
        
        const successRate = (overall.passed / overall.total * 100).toFixed(1);
        console.log(`   📈 Success Rate: ${successRate}%`);
        
        // Suite breakdown
        console.log(`\n📋 Suite Breakdown:`);
        Object.entries(overall.suiteResults).forEach(([name, results]) => {
            const status = results.failed === 0 ? '✅' : '❌';
            console.log(`   ${status} ${name.padEnd(12)} ${results.passed}/${results.total} (${results.executionTime}ms)`);
        });
        
        // Overall status
        if (overall.failed === 0) {
            console.log(`\n🎉 ALL TESTS PASSED! Extension is ready for deployment.`);
        } else {
            console.log(`\n💥 ${overall.failed} TEST(S) FAILED! Review failures before deployment.`);
        }
        
        console.log('=' .repeat(60));
    }

    async generateReport() {
        const report = {
            metadata: {
                extensionName: 'Firefox Credential Scanner',
                version: '1.5.0',
                testRunDate: new Date().toISOString(),
                testDuration: this.endTime - this.startTime,
                nodeVersion: typeof process !== 'undefined' ? process.version : 'browser',
                testFramework: 'Custom TestFramework v1.0'
            },
            summary: this.results.overall,
            suiteDetails: this.results,
            performance: {
                averageTestTime: this.results.overall.executionTime / this.results.overall.total,
                slowestSuite: this.findSlowestSuite(),
                memoryUsage: this.getMemoryUsage()
            },
            coverage: {
                unit: this.results.patterns ? 'patterns, entropy, masking' : 'not run',
                integration: this.results.integration ? 'scanning pipeline, export functionality' : 'not run',
                performance: this.results.performance ? 'benchmarks, memory, concurrency' : 'not run'
            },
            recommendations: this.generateRecommendations()
        };

        const reportJson = JSON.stringify(report, null, 2);
        
        if (typeof require !== 'undefined') {
            // Node.js environment - save to file
            const fs = require('fs');
            const reportPath = path.join(__dirname, 'test-report.json');
            
            try {
                fs.writeFileSync(reportPath, reportJson);
                console.log(`\n📄 Test report saved to: ${reportPath}`);
            } catch (error) {
                console.error('❌ Failed to save test report:', error);
            }
        } else {
            // Browser environment - log report
            console.log('\n📄 TEST REPORT:');
            console.log(reportJson);
        }
        
        return report;
    }

    findSlowestSuite() {
        let slowest = { name: 'none', time: 0 };
        
        Object.entries(this.results.overall.suiteResults).forEach(([name, results]) => {
            if (results.executionTime > slowest.time) {
                slowest = { name, time: results.executionTime };
            }
        });
        
        return slowest;
    }

    getMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const usage = process.memoryUsage();
            return {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                external: Math.round(usage.external / 1024 / 1024)
            };
        } else if (typeof performance !== 'undefined' && performance.memory) {
            return {
                heapUsed: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                heapTotal: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                heapLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return { heapUsed: 'unknown', heapTotal: 'unknown' };
    }

    generateRecommendations() {
        const recommendations = [];
        const overall = this.results.overall;
        
        // Performance recommendations
        if (overall.executionTime > 5000) {
            recommendations.push('Consider optimizing test performance - total execution time exceeds 5 seconds');
        }
        
        // Failure recommendations
        if (overall.failed > 0) {
            recommendations.push(`Address ${overall.failed} failing test(s) before deployment`);
        }
        
        // Coverage recommendations
        if (!this.results.patterns && !this.results.utils) {
            recommendations.push('Add unit tests for core functionality');
        }
        
        if (!this.results.integration) {
            recommendations.push('Add integration tests for end-to-end workflows');
        }
        
        if (!this.results.performance) {
            recommendations.push('Add performance benchmarks for production readiness');
        }
        
        // Success recommendations
        if (overall.failed === 0 && overall.total > 10) {
            recommendations.push('All tests passing - extension ready for deployment');
            recommendations.push('Consider adding more edge case tests for robustness');
        }
        
        return recommendations.length > 0 ? recommendations : ['No specific recommendations - test suite looks good!'];
    }

    // Configuration methods
    setConfig(config) {
        Object.assign(this.config, config);
    }

    skipSuite(suiteName) {
        this.config[`run${suiteName.charAt(0).toUpperCase() + suiteName.slice(1)}`] = false;
    }

    // Utility method for CI/CD integration
    getExitCode() {
        return this.results.overall && this.results.overall.failed === 0 ? 0 : 1;
    }
}

// Test the test runner itself
const testRunnerTests = new TestFramework();

testRunnerTests.test('TestRunner should initialize correctly', () => {
    const runner = new TestRunner();
    
    Assert.ok(runner.suites instanceof Map, 'Should have suites map');
    Assert.objectHasProperty(runner.config, 'runUnit', 'Should have runUnit config');
    Assert.objectHasProperty(runner.config, 'runIntegration', 'Should have runIntegration config');
    Assert.objectHasProperty(runner.config, 'runPerformance', 'Should have runPerformance config');
});

testRunnerTests.test('TestRunner should register suites correctly', () => {
    const runner = new TestRunner();
    const mockFramework = { runAll: () => Promise.resolve({ passed: 1, failed: 0, total: 1 }) };
    
    runner.registerSuite('test-suite', mockFramework);
    
    Assert.equal(runner.suites.size, 1, 'Should register suite');
    Assert.true(runner.suites.has('test-suite'), 'Should contain registered suite');
});

testRunnerTests.test('TestRunner should handle configuration changes', () => {
    const runner = new TestRunner();
    
    runner.setConfig({ runUnit: false, verbose: false });
    
    Assert.false(runner.config.runUnit, 'Should update runUnit config');
    Assert.false(runner.config.verbose, 'Should update verbose config');
    Assert.true(runner.config.runIntegration, 'Should preserve other configs');
});

testRunnerTests.test('TestRunner should skip suites when configured', () => {
    const runner = new TestRunner();
    
    runner.skipSuite('performance');
    
    Assert.false(runner.config.runPerformance, 'Should disable performance tests');
});

// Export for use in other environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestRunner, testRunnerTests };
} else {
    if (typeof window !== 'undefined') {
        window.TestRunner = TestRunner;
        window.testRunnerTests = testRunnerTests;
    }
}

// Auto-run as main module
if (typeof require !== 'undefined' && require.main === module) {
    const runner = new TestRunner();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--unit-only')) {
        runner.setConfig({ runIntegration: false, runPerformance: false });
    }
    if (args.includes('--no-performance')) {
        runner.skipSuite('performance');
    }
    if (args.includes('--continue-on-failure')) {
        runner.setConfig({ exitOnFailure: false });
    }
    if (args.includes('--quiet')) {
        runner.setConfig({ verbose: false });
    }
    
    runner.skipSuite('utils');
    runner.runAll().then(success => {
        process.exit(runner.getExitCode());
    }).catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}
