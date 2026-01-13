/**
 * Optimized Security Pattern Configurations
 * Performance-focused with compiled regex patterns and reduced false positives
 */

// Pre-compiled regex patterns for better performance
const COMPILED_PATTERNS = {
    // AWS Credentials - Optimized with word boundaries
    AWS_ACCESS_KEY: /\b(AKIA[0-9A-Z]{16})\b/g,
    AWS_SECRET_KEY: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9\/+=]{40})['"]?/g,
    
    // GitHub Tokens - Optimized patterns
    GITHUB_CLASSIC: /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    GITHUB_FINE_GRAINED: /\b(github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/g,
    GITHUB_APP: /\b(ghs_[a-zA-Z0-9]{36})\b/g,
    
    // Slack Tokens - More specific patterns
    SLACK_BOT: /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24})\b/g,
    SLACK_USER: /\b(xoxp-[0-9]{11,13}-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{32})\b/g,
    
    // Database connections - Optimized for common formats
    MONGODB_URI: /\b(mongodb(?:\+srv)?:\/\/[^\s"'<>]+)\b/g,
    MYSQL_URI: /\b(mysql:\/\/[^\s"'<>]+)\b/g,
    POSTGRES_URI: /\b(postgres(?:ql)?:\/\/[^\s"'<>]+)\b/g,
    
    // API Keys - Generic but optimized
    STRIPE_KEY: /\b((sk|pk)_(live|test)_[a-zA-Z0-9]{24,})\b/g,
    SENDGRID_KEY: /\b(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b/g,
    
    // Cloud Storage - Optimized bucket patterns
    S3_BUCKET: /https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.s3(?:[\w\-]*)?\.amazonaws\.com(?:\/[^\s"'<>]*)?/g,
    GCS_BUCKET: /https?:\/\/storage\.googleapis\.com\/([a-z0-9][a-z0-9\-_\.]{1,61}[a-z0-9])(?:\/[^\s"'<>]*)?/g,
    AZURE_BLOB: /https?:\/\/([a-z0-9]{3,24})\.blob\.core\.windows\.net\/([a-z0-9][a-z0-9\-]{1,61}[a-z0-9])(?:\/[^\s"'<>]*)?/g
};

// Optimized false positive patterns - compiled once
const FALSE_POSITIVE_PATTERNS = [
    /(?:YOUR_|your_|example|test|dummy|placeholder|sample|demo|fake|mock)/i,
    /^[a-z]{1,5}$/i,
    /(?:key|token):\s*(?:"|%27)(?:_|\w{1,15}(?:Cell|Column|Height|Width|Size|Position|Count|Cache|Data|Ref|Change|View|Scroll|Index|Range))(?:"|%27)/i,
    /(?:data-|class=|style=|href=|src=|aria-|role=|<\w+|hotkey=|button|svg|div|span)/i
];

// Performance-optimized pattern categories
const SECURITY_PATTERNS = {
    // High-priority patterns (scanned first)
    highPriority: {
        awsAccessKey: {
            pattern: COMPILED_PATTERNS.AWS_ACCESS_KEY,
            description: "AWS Access Key ID",
            riskLevel: "high",
            category: "aws"
        },
        awsSecretKey: {
            pattern: COMPILED_PATTERNS.AWS_SECRET_KEY,
            description: "AWS Secret Access Key",
            riskLevel: "critical",
            category: "aws"
        },
        githubToken: {
            pattern: COMPILED_PATTERNS.GITHUB_CLASSIC,
            description: "GitHub Personal Access Token",
            riskLevel: "high",
            category: "github"
        },
        mongodbUri: {
            pattern: COMPILED_PATTERNS.MONGODB_URI,
            description: "MongoDB Connection String",
            riskLevel: "critical",
            category: "database"
        },
        stripeKey: {
            pattern: COMPILED_PATTERNS.STRIPE_KEY,
            description: "Stripe API Key",
            riskLevel: "high",
            category: "payment"
        }
    },
    
    // Medium-priority patterns
    mediumPriority: {
        slackBot: {
            pattern: COMPILED_PATTERNS.SLACK_BOT,
            description: "Slack Bot Token",
            riskLevel: "high",
            category: "messaging"
        },
        sendgridKey: {
            pattern: COMPILED_PATTERNS.SENDGRID_KEY,
            description: "SendGrid API Key",
            riskLevel: "high",
            category: "email"
        },
        mysqlUri: {
            pattern: COMPILED_PATTERNS.MYSQL_URI,
            description: "MySQL Connection String",
            riskLevel: "critical",
            category: "database"
        },
        postgresUri: {
            pattern: COMPILED_PATTERNS.POSTGRES_URI,
            description: "PostgreSQL Connection String",
            riskLevel: "critical",
            category: "database"
        }
    },
    
    // Cloud storage patterns (processed separately for bucket testing)
    cloudStorage: {
        s3Bucket: {
            pattern: COMPILED_PATTERNS.S3_BUCKET,
            description: "AWS S3 Bucket",
            riskLevel: "low", // Will be updated after testing
            category: "cloudStorage",
            provider: "aws"
        },
        gcsBucket: {
            pattern: COMPILED_PATTERNS.GCS_BUCKET,
            description: "Google Cloud Storage Bucket",
            riskLevel: "low", // Will be updated after testing
            category: "cloudStorage",
            provider: "gcp"
        },
        azureBlob: {
            pattern: COMPILED_PATTERNS.AZURE_BLOB,
            description: "Azure Blob Storage Container",
            riskLevel: "low", // Will be updated after testing
            category: "cloudStorage",
            provider: "azure"
        }
    },
    
    // Low-priority patterns (informational)
    lowPriority: {
        githubFineGrained: {
            pattern: COMPILED_PATTERNS.GITHUB_FINE_GRAINED,
            description: "GitHub Fine-grained Token",
            riskLevel: "medium",
            category: "github"
        },
        githubApp: {
            pattern: COMPILED_PATTERNS.GITHUB_APP,
            description: "GitHub App Token",
            riskLevel: "medium",
            category: "github"
        },
        slackUser: {
            pattern: COMPILED_PATTERNS.SLACK_USER,
            description: "Slack User Token",
            riskLevel: "high",
            category: "messaging"
        }
    }
};

// Optimized pattern validation
class PatternValidator {
    constructor() {
        this.falsePositiveCache = new Map();
        this.validationCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
    }
    
    /**
     * Validate if a match is a real secret (optimized with caching)
     */
    isValidSecret(match, patternConfig) {
        if (!match || typeof match !== 'string') {
            return false;
        }
        
        // Check cache first
        const cacheKey = `${match}:${patternConfig.category}`;
        const cached = this.validationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.isValid;
        }
        
        // Validate against false positive patterns
        const isValid = this._validateAgainstFalsePositives(match, patternConfig);
        
        // Cache result
        this.validationCache.set(cacheKey, {
            isValid,
            timestamp: Date.now()
        });
        
        // Limit cache size
        if (this.validationCache.size > 1000) {
            const oldestKey = this.validationCache.keys().next().value;
            this.validationCache.delete(oldestKey);
        }
        
        return isValid;
    }
    
    /**
     * Validate against false positive patterns
     */
    _validateAgainstFalsePositives(match, patternConfig) {
        // Quick length check
        if (match.length < 8) {
            return false;
        }
        
        // Check against compiled false positive patterns
        for (const fpPattern of FALSE_POSITIVE_PATTERNS) {
            if (fpPattern.test(match)) {
                return false;
            }
        }
        
        // Pattern-specific validation
        if (patternConfig.excludePattern && patternConfig.excludePattern.test(match)) {
            return false;
        }
        
        // Category-specific validation
        switch (patternConfig.category) {
            case 'aws':
                return this._validateAwsCredential(match);
            case 'github':
                return this._validateGitHubToken(match);
            case 'database':
                return this._validateDatabaseUri(match);
            default:
                return true;
        }
    }
    
    /**
     * AWS-specific validation
     */
    _validateAwsCredential(match) {
        // AWS Access Keys should start with AKIA and be exactly 20 chars
        if (match.startsWith('AKIA')) {
            return match.length === 20 && /^AKIA[0-9A-Z]{16}$/.test(match);
        }
        
        // AWS Secret Keys should be 40 chars base64
        if (match.length === 40) {
            return /^[A-Za-z0-9\/+=]{40}$/.test(match);
        }
        
        return true;
    }
    
    /**
     * GitHub token validation
     */
    _validateGitHubToken(match) {
        // GitHub tokens have specific prefixes and lengths
        if (match.startsWith('ghp_')) {
            return match.length === 40;
        }
        if (match.startsWith('github_pat_')) {
            return match.length === 93; // 22 + 1 + 59 + prefix
        }
        if (match.startsWith('ghs_')) {
            return match.length === 40;
        }
        return true;
    }
    
    /**
     * Database URI validation
     */
    _validateDatabaseUri(match) {
        try {
            const url = new URL(match);
            // Must have username and password
            return url.username && url.password && url.hostname;
        } catch {
            return false;
        }
    }
    
    /**
     * Clear validation cache
     */
    clearCache() {
        this.validationCache.clear();
        this.falsePositiveCache.clear();
    }
}

// Create global validator instance
const patternValidator = new PatternValidator();

// Optimized pattern getter with priority support
class OptimizedPatternManager {
    constructor() {
        this.allPatterns = null;
        this.prioritizedPatterns = null;
    }
    
    /**
     * Get all patterns in optimized order
     */
    getAllPatterns() {
        if (this.allPatterns) {
            return this.allPatterns;
        }
        
        this.allPatterns = [];
        
        // Add patterns in priority order
        const priorities = ['highPriority', 'mediumPriority', 'cloudStorage', 'lowPriority'];
        
        for (const priority of priorities) {
            const categoryPatterns = SECURITY_PATTERNS[priority];
            if (categoryPatterns) {
                for (const [key, config] of Object.entries(categoryPatterns)) {
                    this.allPatterns.push({
                        id: key,
                        priority: priority,
                        regex: config.pattern,
                        type: config.description,
                        riskLevel: config.riskLevel,
                        category: config.category,
                        provider: config.provider,
                        excludePattern: config.excludePattern
                    });
                }
            }
        }
        
        return this.allPatterns;
    }
    
    /**
     * Get patterns by priority level
     */
    getPatternsByPriority(priority) {
        const categoryPatterns = SECURITY_PATTERNS[priority];
        if (!categoryPatterns) {
            return [];
        }
        
        return Object.entries(categoryPatterns).map(([key, config]) => ({
            id: key,
            priority: priority,
            regex: config.pattern,
            type: config.description,
            riskLevel: config.riskLevel,
            category: config.category,
            provider: config.provider,
            excludePattern: config.excludePattern
        }));
    }
    
    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return this.getAllPatterns().filter(pattern => pattern.category === category);
    }
    
    /**
     * Get cloud storage patterns only
     */
    getCloudStoragePatterns() {
        return this.getPatternsByPriority('cloudStorage');
    }
    
    /**
     * Reset pattern cache
     */
    resetCache() {
        this.allPatterns = null;
        this.prioritizedPatterns = null;
    }
}

// Create global pattern manager
const patternManager = new OptimizedPatternManager();

// Validation function for backward compatibility
function isValidSecret(match, patternConfig) {
    return patternValidator.isValidSecret(match, patternConfig);
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        SECURITY_PATTERNS, 
        FALSE_POSITIVE_PATTERNS, 
        PatternValidator,
        OptimizedPatternManager,
        isValidSecret,
        patternManager,
        patternValidator
    };
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.SECURITY_PATTERNS = SECURITY_PATTERNS;
    window.FALSE_POSITIVE_PATTERNS = FALSE_POSITIVE_PATTERNS;
    window.PatternValidator = PatternValidator;
    window.OptimizedPatternManager = OptimizedPatternManager;
    window.isValidSecret = isValidSecret;
    window.patternManager = patternManager;
    window.patternValidator = patternValidator;
}

// Performance monitoring for patterns
if (typeof window !== 'undefined') {
    window.getPatternPerformanceStats = function() {
        return {
            totalPatterns: patternManager.getAllPatterns().length,
            validationCacheSize: patternValidator.validationCache.size,
            highPriorityPatterns: patternManager.getPatternsByPriority('highPriority').length,
            cloudStoragePatterns: patternManager.getCloudStoragePatterns().length
        };
    };
}