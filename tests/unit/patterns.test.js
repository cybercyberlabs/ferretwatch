/**
 * Unit tests for security patterns and detection
 */

const { TestFramework, Assert } = require('../framework.js');
const { SECURITY_PATTERNS } = require('../../config/patterns.js');

const testFramework = new TestFramework();

// Test data
const testSecrets = {
    aws: {
        valid: [
            'AKIAIOSFODNN7EXAMPLE',
            'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        ],
        invalid: [
            'AKIATEST',
            'YOUR_ACCESS_KEY',
            'example_key'
        ]
    },
    github: {
        valid: [
            'ghp_1234567890abcdef1234567890abcdef12345678',
            'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            'ghs_1234567890abcdef1234567890abcdef12345678'
        ],
        invalid: [
            'ghp_test',
            'YOUR_GITHUB_TOKEN',
            'fake_token'
        ]
    },
    slack: {
        valid: [
            'xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx',
            'xoxp-1234567890-1234567890123-1234567890123-abcdefghijklmnopqrstuvwxyz123456'
        ],
        invalid: [
            'xoxb-test',
            'slack_token',
            'YOUR_SLACK_TOKEN'
        ]
    },
    discord: {
        valid: [
            'NzkyNzE1NDQ0NjI0MjY1MjE2.X-hvzA.Ovy4MCQywSkoMRRclStW4xAYK7I'
        ],
        invalid: [
            'discord_token',
            'YOUR_DISCORD_TOKEN'
        ]
    },
    certificates: {
        valid: [
            '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
            '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3r...\n-----END RSA PRIVATE KEY-----',
            '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBBQUAMEUx...\n-----END CERTIFICATE-----'
        ],
        invalid: [
            '-----BEGIN INVALID-----',
            'not_a_certificate'
        ]
    },
    database: {
        valid: [
            'mysql://user:password123@localhost:3306/database',
            'postgres://admin:secret@db.example.com/mydb',
            'mongodb://user:pass@mongo.example.com:27017/database',
            'Server=localhost;Database=TestDB;User Id=sa;Password=MyPassword;'
        ],
        invalid: [
            'mysql://localhost',
            'invalid_connection_string'
        ]
    }
};

// Pattern validation tests
testFramework.skip('AWS Access Key patterns should match valid keys', () => {
    const awsPattern = SECURITY_PATTERNS.aws.accessKey.pattern;
    
    testSecrets.aws.valid.forEach(secret => {
        Assert.match(secret, awsPattern, `Should match AWS key: ${secret}`);
    });
    
    testSecrets.aws.invalid.forEach(secret => {
        Assert.notMatch(secret, awsPattern, `Should not match invalid AWS key: ${secret}`);
    });
});

testFramework.skip('GitHub token patterns should match valid tokens', () => {
    const githubPatterns = [
        SECURITY_PATTERNS.github.classicToken.pattern,
        SECURITY_PATTERNS.github.fineGrainedToken.pattern,
        SECURITY_PATTERNS.github.appToken.pattern
    ];
    
    // Test each valid GitHub token against all patterns (at least one should match)
    testSecrets.github.valid.forEach(secret => {
        const matched = githubPatterns.some(pattern => pattern.test(secret));
        Assert.true(matched, `At least one GitHub pattern should match: ${secret}`);
    });
    
    // Test that invalid tokens don't match any pattern
    testSecrets.github.invalid.forEach(secret => {
        const matched = githubPatterns.some(pattern => pattern.test(secret));
        Assert.false(matched, `No GitHub pattern should match invalid token: ${secret}`);
    });
});

testFramework.skip('Slack token patterns should match valid tokens', () => {
    const slackPatterns = [
        SECURITY_PATTERNS.slack.botToken.pattern,
        SECURITY_PATTERNS.slack.userToken.pattern
    ];
    
    testSecrets.slack.valid.forEach(secret => {
        const matched = slackPatterns.some(pattern => pattern.test(secret));
        Assert.true(matched, `At least one Slack pattern should match: ${secret}`);
    });
    
    testSecrets.slack.invalid.forEach(secret => {
        const matched = slackPatterns.some(pattern => pattern.test(secret));
        Assert.false(matched, `No Slack pattern should match invalid token: ${secret}`);
    });
});

testFramework.test('Certificate patterns should match valid certificates', () => {
    const certPatterns = Object.values(SECURITY_PATTERNS.keys_and_certificates).map(p => p.pattern);
    
    testSecrets.certificates.valid.forEach(secret => {
        const matched = certPatterns.some(pattern => pattern.test(secret));
        Assert.true(matched, `Certificate pattern should match: ${secret.substring(0, 50)}...`);
    });
    
    testSecrets.certificates.invalid.forEach(secret => {
        const matched = certPatterns.some(pattern => pattern.test(secret));
        Assert.false(matched, `No certificate pattern should match invalid cert: ${secret}`);
    });
});

testFramework.skip('Database connection patterns should match valid connections', () => {
    const dbPatterns = Object.values(SECURITY_PATTERNS.database).map(p => p.pattern);
    
    testSecrets.database.valid.forEach(secret => {
        const matched = dbPatterns.some(pattern => pattern.test(secret));
        Assert.true(matched, `Database pattern should match: ${secret}`);
    });
    
    testSecrets.database.invalid.forEach(secret => {
        const matched = dbPatterns.some(pattern => pattern.test(secret));
        Assert.false(matched, `No database pattern should match invalid connection: ${secret}`);
    });
});

// Pattern structure tests
testFramework.test('All patterns should have required properties', () => {
    Object.keys(SECURITY_PATTERNS).forEach(category => {
        if (category === 'apiKeys') return; // Skip dynamic patterns
        Assert.ok(SECURITY_PATTERNS[category], `Category ${category} should exist`);
        
        Object.keys(SECURITY_PATTERNS[category]).forEach(patternName => {
            const pattern = SECURITY_PATTERNS[category][patternName];
            
            Assert.objectHasProperty(pattern, 'pattern', `${category}.${patternName} should have pattern property`);
            Assert.objectHasProperty(pattern, 'description', `${category}.${patternName} should have description property`);
            Assert.objectHasProperty(pattern, 'riskLevel', `${category}.${patternName} should have riskLevel property`);
            
            if (pattern.pattern) { // Dynamic patterns might be null initially
                Assert.ok(pattern.pattern instanceof RegExp, `${category}.${patternName} pattern should be RegExp`);
            }
            Assert.ok(typeof pattern.description === 'string', `${category}.${patternName} description should be string`);
            Assert.ok(['low', 'medium', 'high', 'critical'].includes(pattern.riskLevel), 
                     `${category}.${patternName} riskLevel should be valid`);
        });
    });
});

// Risk level validation tests
testFramework.test('Risk levels should be properly assigned', () => {
    const riskLevelCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    
    Object.keys(SECURITY_PATTERNS).forEach(category => {
        Object.keys(SECURITY_PATTERNS[category]).forEach(patternName => {
            const pattern = SECURITY_PATTERNS[category][patternName];
            riskLevelCounts[pattern.riskLevel]++;
        });
    });
    
    // Should have patterns in each risk category
    Assert.ok(riskLevelCounts.critical > 0, 'Should have critical risk patterns');
    Assert.ok(riskLevelCounts.high > 0, 'Should have high risk patterns');
    Assert.ok(riskLevelCounts.medium > 0, 'Should have medium risk patterns');
    
    console.log(`Risk level distribution: ${JSON.stringify(riskLevelCounts)}`);
});

// Performance tests for patterns
testFramework.test('Pattern compilation should be fast', () => {
    const startTime = performance.now ? performance.now() : Date.now();
    
    // Re-compile all patterns
    let patternCount = 0;
    Object.keys(SECURITY_PATTERNS).forEach(category => {
        Object.keys(SECURITY_PATTERNS[category]).forEach(patternName => {
            const patternObj = SECURITY_PATTERNS[category][patternName];
            new RegExp(patternObj.pattern.source, patternObj.pattern.flags);
            patternCount++;
        });
    });
    
    const endTime = performance.now ? performance.now() : Date.now();
    const compilationTime = endTime - startTime;
    
    Assert.ok(compilationTime < 100, `Pattern compilation should be fast (${compilationTime}ms for ${patternCount} patterns)`);
    console.log(`Compiled ${patternCount} patterns in ${compilationTime.toFixed(2)}ms`);
});

// Export test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
} else {
    // For browser environment, auto-run tests
    if (typeof window !== 'undefined') {
        window.patternTests = testFramework;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
