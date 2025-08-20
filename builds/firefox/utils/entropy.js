/**
 * Entropy calculation utilities for detecting randomness in strings
 */

/**
 * Calculates Shannon entropy of a string (measure of randomness)
 * @param {string} str - String to analyze
 * @returns {number} Entropy value (0 to ~8 bits)
 */
function calculateShannonEntropy(str) {
    if (!str || typeof str !== 'string') return 0;
    
    // Count frequency of each character
    const freq = {};
    for (let char of str) {
        freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = str.length;
    
    // Calculate entropy using Shannon formula: -Σ(p * log2(p))
    for (let char in freq) {
        const p = freq[char] / length;
        if (p > 0) {
            entropy -= p * Math.log2(p);
        }
    }
    
    return entropy;
}

/**
 * Checks if a string has minimum entropy (randomness)
 * @param {string} str - String to check
 * @param {number} minEntropy - Minimum entropy threshold (default: 3.5)
 * @returns {boolean} True if string has sufficient entropy
 */
function hasMinimumEntropy(str, minEntropy = 3.5) {
    return calculateShannonEntropy(str) >= minEntropy;
}

/**
 * Calculates character variety score (0-1)
 * @param {string} str - String to analyze
 * @returns {number} Variety score from 0 to 1
 */
function calculateCharacterVariety(str) {
    if (!str) return 0;
    
    const uniqueChars = new Set(str).size;
    const totalChars = str.length;
    
    return uniqueChars / totalChars;
}

/**
 * Detects if a string appears to be randomly generated
 * @param {string} str - String to analyze
 * @returns {object} Analysis results
 */
function analyzeRandomness(str) {
    if (!str || typeof str !== 'string') {
        return {
            entropy: 0,
            variety: 0,
            isRandom: false,
            reason: 'Empty or invalid string'
        };
    }
    
    const entropy = calculateShannonEntropy(str);
    const variety = calculateCharacterVariety(str);
    
    // Heuristics for randomness detection
    const hasGoodEntropy = entropy >= 3.5;
    const hasGoodVariety = variety >= 0.5;
    const hasMinLength = str.length >= 10;
    const hasNoObviousPatterns = !/^(.)\1+$|^(..)\1+$|^(123|abc|qwe)/i.test(str);
    
    const isRandom = hasGoodEntropy && hasGoodVariety && hasMinLength && hasNoObviousPatterns;
    
    let reason = '';
    if (!hasMinLength) reason += 'Too short. ';
    if (!hasGoodEntropy) reason += 'Low entropy. ';
    if (!hasGoodVariety) reason += 'Low character variety. ';
    if (!hasNoObviousPatterns) reason += 'Contains obvious patterns. ';
    
    return {
        entropy: parseFloat(entropy.toFixed(2)),
        variety: parseFloat(variety.toFixed(2)),
        isRandom,
        reason: reason.trim() || 'Appears random'
    };
}

/**
 * Filters out strings that don't appear to be real secrets based on entropy
 * @param {string[]} candidates - Array of potential secrets
 * @param {number} minEntropy - Minimum entropy threshold
 * @returns {string[]} Filtered array of likely real secrets
 */
function filterByEntropy(candidates, minEntropy = 3.5) {
    return candidates.filter(candidate => {
        const analysis = analyzeRandomness(candidate);
        return analysis.isRandom || analysis.entropy >= minEntropy;
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateShannonEntropy,
        hasMinimumEntropy,
        calculateCharacterVariety,
        analyzeRandomness,
        filterByEntropy
    };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.EntropyUtils = {
        calculateShannonEntropy,
        hasMinimumEntropy,
        calculateCharacterVariety,
        analyzeRandomness,
        filterByEntropy
    };
}
