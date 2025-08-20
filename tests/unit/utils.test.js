/**
 * Unit tests for utility functions
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

// Mock utilities for testing
const mockEntropy = {
    calculateEntropy: (str) => {
        if (!str) return 0;
        const chars = {};
        for (let char of str) {
            chars[char] = (chars[char] || 0) + 1;
        }
        let entropy = 0;
        const length = str.length;
        for (let char in chars) {
            const freq = chars[char] / length;
            entropy -= freq * Math.log2(freq);
        }
        return entropy;
    },
    isHighEntropy: (str, threshold = 4.5) => {
        return mockEntropy.calculateEntropy(str) > threshold;
    }
};

const mockMasking = {
    maskSecret: (secret, showLength = 4) => {
        if (!secret || secret.length <= showLength * 2) {
            return '*'.repeat(secret?.length || 3);
        }
        return secret.slice(0, showLength) + '***' + secret.slice(-showLength);
    },
    hashForLogging: (secret) => {
        // Simple hash for testing
        let hash = 0;
        for (let i = 0; i < secret.length; i++) {
            const char = secret.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
};

const mockContext = {
    isValidContext: (element) => {
        if (!element) return false;
        const tagName = element.tagName?.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tagName)) return false;
        if (element.textContent?.length > 10000) return false; // Likely minified
        return true;
    },
    shouldSkipElement: (element) => {
        return !mockContext.isValidContext(element);
    }
};

// Entropy calculation tests
testFramework.test('Entropy calculation should work correctly', () => {
    // Test known entropy values
    Assert.equal(mockEntropy.calculateEntropy('aaaa'), 0, 'Same character string should have 0 entropy');
    Assert.ok(mockEntropy.calculateEntropy('abcd') > 0, 'Different characters should have > 0 entropy');
    Assert.ok(mockEntropy.calculateEntropy('AKIAIOSFODNN7EXAMPLE') > 4, 'AWS key should have high entropy');
    Assert.ok(mockEntropy.calculateEntropy('test123') < 4, 'Simple string should have low entropy');
});

testFramework.test('High entropy detection should work', () => {
    const highEntropyStrings = [
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'ghp_1234567890abcdef1234567890abcdef12345678',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ'
    ];
    
    const lowEntropyStrings = [
        'password123',
        'test',
        'YOUR_API_KEY',
        'example'
    ];
    
    highEntropyStrings.forEach(str => {
        Assert.true(mockEntropy.isHighEntropy(str), `Should detect high entropy: ${str}`);
    });
    
    lowEntropyStrings.forEach(str => {
        Assert.false(mockEntropy.isHighEntropy(str), `Should detect low entropy: ${str}`);
    });
});

// Secret masking tests
testFramework.test('Secret masking should work correctly', () => {
    Assert.equal(mockMasking.maskSecret(''), '***', 'Empty string should be masked');
    Assert.equal(mockMasking.maskSecret('test'), '****', 'Short string should be fully masked');
    Assert.equal(mockMasking.maskSecret('AKIAIOSFODNN7EXAMPLE'), 'AKIA***MPLE', 'Long string should show beginning and end');
    Assert.equal(mockMasking.maskSecret('ghp_1234567890abcdef1234567890abcdef12345678'), 'ghp_***5678', 'Token should be properly masked');
});

testFramework.test('Hash generation should be consistent', () => {
    const secret = 'test_secret_123';
    const hash1 = mockMasking.hashForLogging(secret);
    const hash2 = mockMasking.hashForLogging(secret);
    
    Assert.equal(hash1, hash2, 'Hash should be consistent');
    Assert.notEqual(mockMasking.hashForLogging(secret), mockMasking.hashForLogging('different_secret'), 'Different strings should have different hashes');
});

// Context filtering tests  
testFramework.test('Context filtering should identify invalid contexts', () => {
    const validElement = MockHelpers.createMockElement('div');
    validElement.textContent = 'Some normal text content';
    Assert.true(mockContext.isValidContext(validElement), 'Normal div should be valid context');
    
    const scriptElement = MockHelpers.createMockElement('script');
    scriptElement.tagName = 'SCRIPT';
    Assert.false(mockContext.isValidContext(scriptElement), 'Script element should be invalid context');
    
    const styleElement = MockHelpers.createMockElement('style');
    styleElement.tagName = 'STYLE';
    Assert.false(mockContext.isValidContext(styleElement), 'Style element should be invalid context');
    
    const minifiedElement = MockHelpers.createMockElement('div');
    minifiedElement.textContent = 'x'.repeat(15000); // Very long content, likely minified
    Assert.false(mockContext.isValidContext(minifiedElement), 'Minified content should be invalid context');
});

// Storage utilities tests (mock)
testFramework.test('Storage utilities should handle settings', async () => {
    MockHelpers.mockBrowserAPI();
    
    const mockStorage = {
        data: {},
        set: function(items) {
            Object.assign(this.data, items);
            return Promise.resolve();
        },
        get: function(keys) {
            if (Array.isArray(keys)) {
                const result = {};
                keys.forEach(key => {
                    if (this.data.hasOwnProperty(key)) {
                        result[key] = this.data[key];
                    }
                });
                return Promise.resolve(result);
            } else if (typeof keys === 'string') {
                return Promise.resolve({ [keys]: this.data[keys] });
            }
            return Promise.resolve(this.data);
        }
    };
    
    // Test setting values
    await mockStorage.set({ testSetting: true, threshold: 4.5 });
    Assert.equal(mockStorage.data.testSetting, true, 'Setting should be stored');
    Assert.equal(mockStorage.data.threshold, 4.5, 'Numeric setting should be stored');
    
    // Test getting values
    const retrieved = await mockStorage.get(['testSetting', 'threshold']);
    Assert.equal(retrieved.testSetting, true, 'Should retrieve boolean setting');
    Assert.equal(retrieved.threshold, 4.5, 'Should retrieve numeric setting');
});

// Performance tests for utility functions
testFramework.test('Utility functions should be performant', () => {
    const testString = 'AKIAIOSFODNN7EXAMPLE';
    const iterations = 1000;
    
    // Test entropy calculation performance
    const startTime = performance.now ? performance.now() : Date.now();
    for (let i = 0; i < iterations; i++) {
        mockEntropy.calculateEntropy(testString);
    }
    const entropyTime = (performance.now ? performance.now() : Date.now()) - startTime;
    
    Assert.ok(entropyTime < 100, `Entropy calculation should be fast (${entropyTime}ms for ${iterations} iterations)`);
    
    // Test masking performance
    const maskStartTime = performance.now ? performance.now() : Date.now();
    for (let i = 0; i < iterations; i++) {
        mockMasking.maskSecret(testString);
    }
    const maskTime = (performance.now ? performance.now() : Date.now()) - maskStartTime;
    
    Assert.ok(maskTime < 50, `Secret masking should be fast (${maskTime}ms for ${iterations} iterations)`);
    
    console.log(`Performance: Entropy ${entropyTime.toFixed(2)}ms, Masking ${maskTime.toFixed(2)}ms`);
});

// Edge cases and error handling
testFramework.test('Utility functions should handle edge cases', () => {
    // Null/undefined inputs
    Assert.equal(mockEntropy.calculateEntropy(null), 0, 'Should handle null input');
    Assert.equal(mockEntropy.calculateEntropy(undefined), 0, 'Should handle undefined input');
    Assert.equal(mockEntropy.calculateEntropy(''), 0, 'Should handle empty string');
    
    // Very long strings
    const longString = 'x'.repeat(10000);
    Assert.ok(mockEntropy.calculateEntropy(longString) >= 0, 'Should handle very long strings');
    
    // Special characters
    const specialString = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    Assert.ok(mockEntropy.calculateEntropy(specialString) > 0, 'Should handle special characters');
    
    // Unicode characters
    const unicodeString = '🔐🗝️🔑🛡️🔒';
    Assert.ok(mockEntropy.calculateEntropy(unicodeString) >= 0, 'Should handle unicode characters');
});

testFramework.test('Masking should handle various input types', () => {
    Assert.equal(mockMasking.maskSecret(null), '***', 'Should handle null');
    Assert.equal(mockMasking.maskSecret(undefined), '***', 'Should handle undefined');
    Assert.equal(mockMasking.maskSecret(123), '***', 'Should handle numbers');
    
    // Very long secrets
    const longSecret = 'x'.repeat(1000);
    const masked = mockMasking.maskSecret(longSecret);
    Assert.true(masked.includes('***'), 'Long secret should be masked');
    Assert.true(masked.length < longSecret.length, 'Masked version should be shorter');
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment
    if (typeof window !== 'undefined') {
        window.utilityTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
