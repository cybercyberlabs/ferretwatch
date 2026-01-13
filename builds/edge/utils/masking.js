/**
 * Security utilities for handling sensitive data
 */

/**
 * Masks a secret value for safe display/logging
 * @param {string} secret - The secret to mask
 * @param {number} visibleChars - Number of characters to show at start/end
 * @returns {string} Masked secret
 */
function maskSecret(secret, visibleChars = 4) {
    if (!secret || typeof secret !== 'string') {
        return '***';
    }
    
    if (secret.length <= 8) {
        return '*'.repeat(secret.length);
    }
    
    const start = secret.slice(0, visibleChars);
    const end = secret.slice(-visibleChars);
    const middle = '*'.repeat(Math.max(3, secret.length - (visibleChars * 2)));
    
    return `${start}${middle}${end}`;
}

/**
 * Calculates Shannon entropy of a string (measure of randomness)
 * @param {string} str - String to analyze
 * @returns {number} Entropy value
 */
function calculateShannonEntropy(str) {
    if (!str) return 0;
    
    const freq = {};
    for (let char of str) {
        freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = str.length;
    
    for (let char in freq) {
        const p = freq[char] / length;
        entropy -= p * Math.log2(p);
    }
    
    return entropy;
}

/**
 * Checks if a string has minimum entropy (randomness)
 * @param {string} str - String to check
 * @param {number} minEntropy - Minimum entropy threshold
 * @returns {boolean} True if string has sufficient entropy
 */
function hasMinimumEntropy(str, minEntropy = 3.5) {
    // Use EntropyUtils if available, otherwise fallback
    if (typeof window !== 'undefined' && window.EntropyUtils) {
        return window.EntropyUtils.hasMinimumEntropy(str, minEntropy);
    }
    
    // Simple fallback entropy check
    return calculateShannonEntropy(str) >= minEntropy;
}

/**
 * Checks if a value appears to be a placeholder/fake value
 * @param {string} value - Value to check
 * @returns {boolean} True if appears to be placeholder
 */
function isPlaceholderValue(value) {
    if (!value || typeof value !== 'string') return true;
    
    // Enhanced placeholder detection
    const placeholderPatterns = [
        // Common prefixes
        /^(your_?|example_?|test_?|dummy_?|placeholder_?|sample_?|demo_?|fake_?)/i,
        // Short meaningless values
        /^[a-z]{1,5}$/i,
        // Null/empty indicators
        /^(null|undefined|none|empty|nil)$/i,
        // Domain placeholders
        /(example\.com|test\.com|dummy|localhost)/i,
        // Character patterns
        /^[x]+$/i,      // All x's
        /^[*]+$/i,      // All asterisks
        /^[.]+$/i,      // All dots
        /^[0]+$/i,      // All zeros
        // Common fake values
        /^(secret|password|key|token)$/i,
        // Sequential patterns
        /^(123|abc|aaa|111)/i,
        // Template variables
        /\$\{|\{\{|<%|%>/,
        // Environment variable placeholders
        /^[A-Z_]+$/,
        // URL-like but obviously fake
        /^https?:\/\/(localhost|127\.0\.0\.1|example)/i
    ];
    
    return placeholderPatterns.some(pattern => pattern.test(value));
}

/**
 * Generates a non-reversible hash of a secret for debugging
 * @param {string} secret - Secret to hash
 * @returns {string} Hash representation
 */
function hashSecret(secret) {
    if (!secret) return 'empty';
    
    // Simple hash for debugging - not cryptographically secure
    let hash = 0;
    for (let i = 0; i < secret.length; i++) {
        const char = secret.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `hash_${Math.abs(hash).toString(16)}_len${secret.length}`;
}

/**
 * Safely logs finding without exposing the actual secret
 * @param {string} type - Type of secret found
 * @param {string} secret - The actual secret
 * @param {string} context - Where it was found
 */
function safeLog(type, secret, context = '') {
    const maskedSecret = maskSecret(secret);
    const secretHash = hashSecret(secret);
    
    // Secret found and masked for display
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        maskSecret,
        calculateShannonEntropy,
        hasMinimumEntropy,
        isPlaceholderValue,
        hashSecret,
        safeLog
    };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.SecurityUtils = {
        maskSecret,
        calculateShannonEntropy,
        hasMinimumEntropy,
        isPlaceholderValue,
        hashSecret,
        safeLog
    };
}
