/**
 * Simple testing framework for browser extension testing
 * Designed to work in both Node.js and browser environments
 */

class TestFramework {
    constructor() {
        this.tests = [];
        this.beforeHooks = [];
        this.afterHooks = [];
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.currentTest = null;
    }

    /**
     * Define a test
     * @param {string} description - Test description
     * @param {Function} testFn - Test function
     */
    test(description, testFn) {
        this.tests.push({
            description,
            testFn,
            skip: false
        });
    }

    /**
     * Define a test to be skipped
     * @param {string} description - Test description
     * @param {Function} testFn - Test function
     */
    skip(description, testFn) {
        this.tests.push({
            description,
            testFn,
            skip: true
        });
    }

    /**
     * Add before hook
     * @param {Function} hookFn - Hook function
     */
    beforeEach(hookFn) {
        this.beforeHooks.push(hookFn);
    }

    /**
     * Add after hook
     * @param {Function} hookFn - Hook function
     */
    afterEach(hookFn) {
        this.afterHooks.push(hookFn);
    }

    /**
     * Run all tests
     * @returns {Promise<object>} Test results
     */
    async runAll() {
        console.log('🧪 Starting test suite...\n');
        
        this.results = { passed: 0, failed: 0, skipped: 0, total: 0 };
        
        for (const test of this.tests) {
            this.results.total++;
            
            if (test.skip) {
                console.log(`⏭️  SKIP: ${test.description}`);
                this.results.skipped++;
                continue;
            }

            this.currentTest = test;
            
            try {
                // Run before hooks
                for (const hook of this.beforeHooks) {
                    await hook();
                }

                // Run the actual test
                await test.testFn();
                
                // Run after hooks
                for (const hook of this.afterHooks) {
                    await hook();
                }

                console.log(`✅ PASS: ${test.description}`);
                this.results.passed++;
                
            } catch (error) {
                console.log(`❌ FAIL: ${test.description}`);
                console.log(`   Error: ${error.message}`);
                if (error.stack) {
                    console.log(`   Stack: ${error.stack.split('\n')[1]?.trim()}`);
                }
                this.results.failed++;
            }
        }

        this.printSummary();
        return this.results;
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log(`   Total: ${this.results.total}`);
        console.log(`   ✅ Passed: ${this.results.passed}`);
        console.log(`   ❌ Failed: ${this.results.failed}`);
        console.log(`   ⏭️  Skipped: ${this.results.skipped}`);
        
        const passRate = ((this.results.passed / (this.results.total - this.results.skipped)) * 100).toFixed(1);
        console.log(`   📈 Pass Rate: ${passRate}%`);
        
        if (this.results.failed === 0) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log(`\n⚠️  ${this.results.failed} test(s) failed`);
        }
    }
}

/**
 * Assertion helpers
 */
class Assert {
    static equal(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    }

    static notEqual(actual, expected, message = '') {
        if (actual === expected) {
            throw new Error(`${message}\n  Expected not to equal: ${expected}\n  Actual: ${actual}`);
        }
    }

    static true(value, message = '') {
        if (value !== true) {
            throw new Error(`${message}\n  Expected: true\n  Actual: ${value}`);
        }
    }

    static false(value, message = '') {
        if (value !== false) {
            throw new Error(`${message}\n  Expected: false\n  Actual: ${value}`);
        }
    }

    static ok(value, message = '') {
        if (!value) {
            throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
        }
    }

    static notOk(value, message = '') {
        if (value) {
            throw new Error(`${message}\n  Expected falsy value, got: ${value}`);
        }
    }

    static throws(fn, message = '') {
        try {
            fn();
            throw new Error(`${message}\n  Expected function to throw, but it didn't`);
        } catch (error) {
            // Expected to throw
        }
    }

    static async throwsAsync(fn, message = '') {
        try {
            await fn();
            throw new Error(`${message}\n  Expected async function to throw, but it didn't`);
        } catch (error) {
            // Expected to throw
        }
    }

    static match(actual, regex, message = '') {
        if (!regex.test(actual)) {
            throw new Error(`${message}\n  Expected "${actual}" to match ${regex}`);
        }
    }

    static notMatch(actual, regex, message = '') {
        if (regex.test(actual)) {
            throw new Error(`${message}\n  Expected "${actual}" not to match ${regex}`);
        }
    }

    static arrayIncludes(array, value, message = '') {
        if (!Array.isArray(array) || !array.includes(value)) {
            throw new Error(`${message}\n  Expected array to include: ${value}\n  Array: ${JSON.stringify(array)}`);
        }
    }

    static arrayLength(array, length, message = '') {
        if (!Array.isArray(array) || array.length !== length) {
            throw new Error(`${message}\n  Expected array length: ${length}\n  Actual length: ${array?.length}\n  Array: ${JSON.stringify(array)}`);
        }
    }

    static objectHasProperty(obj, prop, message = '') {
        if (!obj || !obj.hasOwnProperty(prop)) {
            throw new Error(`${message}\n  Expected object to have property: ${prop}\n  Object: ${JSON.stringify(obj)}`);
        }
    }

    static async resolves(promise, message = '') {
        try {
            await promise;
        } catch (error) {
            throw new Error(`${message}\n  Expected promise to resolve, but it rejected with: ${error.message}`);
        }
    }

    static async rejects(promise, message = '') {
        try {
            await promise;
            throw new Error(`${message}\n  Expected promise to reject, but it resolved`);
        } catch (error) {
            // Expected to reject
        }
    }
}

/**
 * Mock helpers for browser extension testing
 */
class MockHelpers {
    static mockBrowserAPI() {
        if (typeof global !== 'undefined') {
            global.browser = {
                storage: {
                    local: {
                        get: () => Promise.resolve({}),
                        set: () => Promise.resolve(),
                        remove: () => Promise.resolve()
                    }
                },
                tabs: {
                    query: () => Promise.resolve([{ id: 1, url: 'https://example.com' }]),
                    sendMessage: () => Promise.resolve({ success: true })
                }
            };
        }
        if (typeof window !== 'undefined') {
            window.browser = {
                storage: {
                    local: {
                        get: () => Promise.resolve({}),
                        set: () => Promise.resolve(),
                        remove: () => Promise.resolve()
                    }
                },
                tabs: {
                    query: () => Promise.resolve([{ id: 1, url: 'https://example.com' }]),
                    sendMessage: () => Promise.resolve({ success: true })
                }
            };
        }
    }

    static mockDOM() {
        if (typeof global !== 'undefined') {
            global.document = {
                createElement: (tag) => ({
                    tagName: tag.toUpperCase(),
                    style: {},
                    classList: {
                        add: () => {},
                        remove: () => {},
                        contains: () => false
                    },
                    addEventListener: () => {},
                    setAttribute: () => {},
                    appendChild: () => {}
                }),
                head: {
                    appendChild: () => {}
                },
                body: {
                    appendChild: () => {}
                },
                getElementById: () => null,
                querySelector: () => null
            };
        }
    }

    static createMockElement(tag = 'div') {
        return {
            tagName: tag.toUpperCase(),
            textContent: '',
            innerHTML: '',
            style: {},
            classList: {
                add: function(className) { this._classes = this._classes || []; this._classes.push(className); },
                remove: function(className) { this._classes = this._classes || []; const index = this._classes.indexOf(className); if (index > -1) this._classes.splice(index, 1); },
                contains: function(className) { this._classes = this._classes || []; return this._classes.includes(className); }
            },
            addEventListener: () => {},
            setAttribute: () => {},
            getAttribute: () => null,
            appendChild: () => {},
            parentNode: null,
            children: []
        };
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestFramework, Assert, MockHelpers };
}

if (typeof window !== 'undefined') {
    window.TestFramework = TestFramework;
    window.Assert = Assert;
    window.MockHelpers = MockHelpers;
}
