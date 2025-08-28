/**
 * Cloud Bucket Accessibility Tester
 * Tests cloud storage buckets for public accessibility
 */

class BucketTester {
    constructor(settings = {}) {
        this.timeout = settings.bucketTestTimeout || 5000;
        this.maxConcurrent = settings.maxConcurrentTests || 3;
        this.userAgent = 'Mozilla/5.0 (compatible; SecurityScanner/1.0)';
        
        // Performance optimizations
        this.requestQueue = [];
        this.activeRequests = new Set();
        this.cache = new Map();
        this.cacheTimeout = settings.cacheTimeout || 300000; // 5 minutes
        this.throttleDelay = settings.throttleDelay || 100; // 100ms between requests
        this.lastRequestTime = 0;
        
        // Request statistics for performance monitoring
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            throttledRequests: 0,
            queuedRequests: 0,
            averageResponseTime: 0,
            responseTimeSum: 0
        };
    }
    
    /**
     * Debug logging utility - only logs when debug mode is enabled
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments to log
     */
    debugLog(message, ...args) {
        if (window.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`[BucketTester Debug] ${message}`, ...args);
        }
    }

    /**
     * Test a single bucket for public accessibility with caching
     * @param {Object} bucketInfo - Bucket information from parser
     * @returns {Promise<Object>} Test results
     */
    async testBucketAccess(bucketInfo) {
        // Enhanced input validation
        const validationResult = this._validateBucketInfo(bucketInfo);
        if (!validationResult.isValid) {
            return {
                accessible: false,
                error: validationResult.error,
                statusCode: null,
                responseType: null,
                validationFailed: true
            };
        }

        // Check cache first
        const cacheKey = this._generateCacheKey(bucketInfo);
        const cachedResult = this._getCachedResult(cacheKey);
        if (cachedResult) {
            this.stats.cacheHits++;
            return { ...cachedResult, fromCache: true };
        }

        this.stats.cacheMisses++;

        try {
            const result = await this._performAccessibilityTestWithQueue(bucketInfo);
            
            // Cache successful results
            if (result && !result.error) {
                this._setCachedResult(cacheKey, result);
            }
            
            return result;
        } catch (error) {
            return this._handleTestError(error, bucketInfo);
        }
    }

    /**
     * Test multiple buckets with enhanced concurrency control and performance optimization
     * @param {Array} bucketList - Array of bucket info objects
     * @returns {Promise<Array>} Array of test results
     */
    async testMultipleBuckets(bucketList) {
        if (!Array.isArray(bucketList) || bucketList.length === 0) {
            return [];
        }

        const startTime = performance.now();
        const results = [];
        let successfulTests = 0;
        let failedTests = 0;

        // Pre-filter buckets that are already cached
        const { cachedResults, uncachedBuckets } = this._separateCachedBuckets(bucketList);
        results.push(...cachedResults);
        successfulTests += cachedResults.filter(r => r.accessible).length;

        if (uncachedBuckets.length === 0) {
            return results;
        }

        // Use adaptive concurrency based on system performance
        const adaptiveConcurrency = this._calculateAdaptiveConcurrency(uncachedBuckets.length);
        const chunks = this._chunkArray(uncachedBuckets, adaptiveConcurrency);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            try {
                // Add progressive delay between chunks to prevent overwhelming
                if (i > 0) {
                    await this._progressiveDelay(i);
                }

                const chunkPromises = chunk.map(bucket => this.testBucketAccess(bucket));
                const chunkResults = await Promise.allSettled(chunkPromises);
                
                const processedResults = chunkResults.map((result, index) => {
                    if (result.status === 'fulfilled') {
                        successfulTests++;
                        return result.value;
                    } else {
                        failedTests++;
                        return this._createFailureResult(
                            `Batch test failed for bucket ${chunk[index]?.bucketName || 'unknown'}`,
                            result.reason
                        );
                    }
                });
                
                results.push(...processedResults);
                
                // Update statistics
                this.stats.queuedRequests += chunk.length;
                
            } catch (error) {
                // Handle chunk-level failures with fallback mechanism
                const fallbackResults = chunk.map(bucket => 
                    this._createFailureResult(
                        `Chunk processing failed for bucket ${bucket?.bucketName || 'unknown'}`,
                        error
                    )
                );
                results.push(...fallbackResults);
                failedTests += chunk.length;
            }
        }

        // Update performance statistics
        const totalTime = performance.now() - startTime;
        this._updatePerformanceStats(totalTime, bucketList.length);

        // Log batch testing summary for debugging
        this.debugLog(`Bucket batch testing completed: ${successfulTests} successful, ${failedTests} failed, ${totalTime.toFixed(2)}ms total`);

        return results;
    }

    /**
     * Validate bucket information before testing
     * @private
     */
    _validateBucketInfo(bucketInfo) {
        if (!bucketInfo) {
            return { isValid: false, error: 'Bucket information is required' };
        }

        if (typeof bucketInfo !== 'object') {
            return { isValid: false, error: 'Bucket information must be an object' };
        }

        if (!bucketInfo.testUrls || !Array.isArray(bucketInfo.testUrls) || bucketInfo.testUrls.length === 0) {
            return { isValid: false, error: 'No test URLs available for bucket' };
        }

        if (!bucketInfo.provider || typeof bucketInfo.provider !== 'string') {
            return { isValid: false, error: 'Valid provider is required' };
        }

        if (!bucketInfo.bucketName || typeof bucketInfo.bucketName !== 'string') {
            return { isValid: false, error: 'Valid bucket name is required' };
        }

        // Validate test URLs
        for (const testUrl of bucketInfo.testUrls) {
            if (!this._isValidUrl(testUrl)) {
                return { isValid: false, error: `Invalid test URL: ${testUrl}` };
            }
        }

        return { isValid: true };
    }

    /**
     * Validate if a string is a valid URL
     * @private
     */
    _isValidUrl(urlString) {
        if (!urlString || typeof urlString !== 'string') {
            return false;
        }

        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    /**
     * Handle test errors with appropriate categorization
     * @private
     */
    _handleTestError(error, bucketInfo) {
        const errorResult = {
            accessible: false,
            statusCode: null,
            responseType: null,
            bucketName: bucketInfo?.bucketName || 'unknown',
            provider: bucketInfo?.provider || 'unknown'
        };

        if (error.name === 'AbortError') {
            return {
                ...errorResult,
                error: 'Request timeout',
                errorType: 'timeout'
            };
        }

        if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
            return {
                ...errorResult,
                accessible: null, // Unknown due to CORS
                error: 'CORS restriction - cannot determine accessibility',
                errorType: 'cors'
            };
        }

        if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
            return {
                ...errorResult,
                error: 'Network connection failed',
                errorType: 'network'
            };
        }

        if (error.message.includes('DNS') || error.message.includes('ENOTFOUND')) {
            return {
                ...errorResult,
                error: 'DNS resolution failed',
                errorType: 'dns'
            };
        }

        if (error.message.includes('Chunk processing') || error.message.includes('batch')) {
            return {
                ...errorResult,
                error: `Batch processing failed: ${error.message}`,
                errorType: 'batch_failure'
            };
        }

        // Generic error handling
        return {
            ...errorResult,
            error: `Test failed: ${error.message}`,
            errorType: 'unknown'
        };
    }

    /**
     * Create a standardized failure result
     * @private
     */
    _createFailureResult(message, originalError) {
        return {
            accessible: false,
            error: message,
            statusCode: null,
            responseType: null,
            originalError: originalError?.message || String(originalError),
            errorType: 'batch_failure'
        };
    }

    /**
     * Perform the actual HTTP test based on provider
     * @private
     */
    async _performAccessibilityTest(bucketInfo) {
        // Try multiple test URLs if available
        const testUrls = Array.isArray(bucketInfo.testUrls) ? bucketInfo.testUrls : [bucketInfo.testUrl];
        let lastError = null;

        for (const testUrl of testUrls) {
            try {
                const result = await this._testSingleUrl(testUrl, bucketInfo.provider);
                if (result.accessible !== null) {
                    // Return first successful or definitive result
                    return result;
                }
                // If result is null (CORS), try next URL
                lastError = result;
            } catch (error) {
                lastError = error;
                // Continue to next URL on error
            }
        }

        // If all URLs failed, return the last error or throw
        if (lastError instanceof Error) {
            throw lastError;
        }
        
        return lastError || {
            accessible: false,
            error: 'All test URLs failed',
            statusCode: null,
            responseType: null
        };
    }

    /**
     * Test a single URL with comprehensive error handling
     * @private
     */
    async _testSingleUrl(testUrl, provider) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/xml, application/json, text/html, */*'
                },
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
                redirect: 'follow',
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);

            // Validate response before analysis
            if (!this._isValidResponse(response)) {
                throw new Error(`Invalid response received from ${testUrl}`);
            }

            const result = await this._analyzeResponse(response, provider);
            return result;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                return {
                    accessible: false,
                    error: 'Request timeout',
                    statusCode: null,
                    responseType: null,
                    errorType: 'timeout'
                };
            }

            // CORS errors are expected for cross-origin requests
            if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
                return {
                    accessible: null, // Unknown due to CORS
                    error: 'CORS restriction - cannot determine accessibility',
                    statusCode: null,
                    responseType: null,
                    errorType: 'cors'
                };
            }

            throw error;
        }
    }

    /**
     * Validate HTTP response object
     * @private
     */
    _isValidResponse(response) {
        if (!response) {
            return false;
        }

        if (typeof response.status !== 'number') {
            return false;
        }

        if (response.status < 100 || response.status > 599) {
            return false;
        }

        return true;
    }

    /**
     * Analyze HTTP response based on provider-specific patterns
     * @private
     */
    async _analyzeResponse(response, provider) {
        const statusCode = response.status;
        let responseText = '';
        let responseType = null;
        let responseSize = 0;

        try {
            responseText = await response.text();
            responseSize = responseText.length;
            
            // Validate response size to prevent memory issues
            if (responseSize > 1024 * 1024) { // 1MB limit
                responseText = responseText.substring(0, 1024 * 100) + '... [truncated]';
                responseSize = 1024 * 100;
            }
        } catch (error) {
            // If we can't read the response, use status code only
            responseText = '';
        }

        // Determine and validate response type
        const contentType = response.headers.get('content-type') || '';
        responseType = this._determineResponseType(contentType, responseText);

        // Validate response content
        const validationResult = this._validateResponseContent(responseText, responseType, statusCode);
        if (!validationResult.isValid) {
            return {
                accessible: false,
                error: validationResult.error,
                statusCode: statusCode,
                responseType: responseType,
                validationFailed: true
            };
        }

        // Provider-specific analysis
        try {
            switch (provider.toLowerCase()) {
                case 'aws':
                    return this._analyzeS3Response(statusCode, responseText, responseType);
                case 'gcp':
                    return this._analyzeGCSResponse(statusCode, responseText, responseType);
                case 'azure':
                    return this._analyzeAzureResponse(statusCode, responseText, responseType);
                case 'digitalocean':
                    return this._analyzeDigitalOceanResponse(statusCode, responseText, responseType);
                case 'alibaba':
                    return this._analyzeAlibabaResponse(statusCode, responseText, responseType);
                default:
                    return this._analyzeGenericResponse(statusCode, responseText, responseType);
            }
        } catch (error) {
            return {
                accessible: false,
                error: `Response analysis failed: ${error.message}`,
                statusCode: statusCode,
                responseType: responseType,
                analysisFailed: true
            };
        }
    }

    /**
     * Determine response type from content-type and content
     * @private
     */
    _determineResponseType(contentType, responseText) {
        const lowerContentType = contentType.toLowerCase();
        
        if (lowerContentType.includes('xml') || lowerContentType.includes('application/xml') || lowerContentType.includes('text/xml')) {
            return 'xml';
        }
        
        if (lowerContentType.includes('json') || lowerContentType.includes('application/json')) {
            return 'json';
        }
        
        if (lowerContentType.includes('html') || lowerContentType.includes('text/html')) {
            return 'html';
        }

        // Fallback: analyze content if content-type is unclear
        if (responseText) {
            const trimmedText = responseText.trim();
            if (trimmedText.startsWith('<?xml') || trimmedText.startsWith('<')) {
                return 'xml';
            }
            if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
                return 'json';
            }
            if (trimmedText.toLowerCase().includes('<!doctype html') || trimmedText.toLowerCase().includes('<html')) {
                return 'html';
            }
        }

        return 'unknown';
    }

    /**
     * Validate response content for security and correctness
     * @private
     */
    _validateResponseContent(responseText, responseType, statusCode) {
        // Check for suspicious content that might indicate an attack
        if (responseText.includes('<script>') || responseText.includes('javascript:')) {
            return { isValid: false, error: 'Response contains potentially malicious content' };
        }

        // Validate XML structure for XML responses
        if (responseType === 'xml' && responseText) {
            if (!responseText.includes('<') || !responseText.includes('>')) {
                return { isValid: false, error: 'Invalid XML structure in response' };
            }
        }

        // Validate JSON structure for JSON responses
        if (responseType === 'json' && responseText && statusCode === 200) {
            try {
                JSON.parse(responseText);
            } catch (error) {
                return { isValid: false, error: 'Invalid JSON structure in response' };
            }
        }

        return { isValid: true };
    }

    /**
     * Analyze AWS S3 response
     * @private
     */
    _analyzeS3Response(statusCode, responseText, responseType) {
        if (statusCode === 200 && responseType === 'xml') {
            // Check for S3 bucket listing XML - be more specific about what constitutes listing
            if ((responseText.includes('<ListBucketResult') && responseText.includes('</ListBucketResult>')) || 
                (responseText.includes('<Contents>') && responseText.includes('</Contents>')) ||
                (responseText.includes('<?xml') && responseText.includes('<Name>') && responseText.includes('<Key>'))) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: true
                };
            }
            
            // If it's XML but doesn't contain listing elements, it's accessible but no listing
            if (responseText.includes('<?xml')) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: false
                };
            }
        }

        // Handle HTML responses (might be S3 website or error pages)
        if (statusCode === 200 && responseType === 'html') {
            return {
                accessible: true,
                error: null,
                statusCode: statusCode,
                responseType: responseType,
                listingEnabled: false  // HTML response means no listing capability
            };
        }

        if (statusCode === 403) {
            return {
                accessible: false,
                error: 'Access denied',
                statusCode: statusCode,
                responseType: responseType,
                listingEnabled: false
            };
        }

        if (statusCode === 404) {
            return {
                accessible: false,
                error: 'Bucket not found',
                statusCode: statusCode,
                responseType: responseType,
                listingEnabled: false
            };
        }

        return {
            accessible: statusCode >= 200 && statusCode < 300,
            error: statusCode >= 400 ? `HTTP ${statusCode}` : null,
            statusCode: statusCode,
            responseType: responseType,
            listingEnabled: false  // Default to false unless we explicitly detect listing XML
        };
    }

    /**
     * Analyze Google Cloud Storage response
     * @private
     */
    _analyzeGCSResponse(statusCode, responseText, responseType) {
        if (statusCode === 200) {
            // GCS can return JSON or XML
            if (responseType === 'json' && responseText.includes('"items"')) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: true
                };
            }
            
            if (responseType === 'xml' && responseText.includes('<Contents>')) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: true
                };
            }
        }

        return this._analyzeGenericResponse(statusCode, responseText, responseType);
    }

    /**
     * Analyze Azure Blob Storage response
     * @private
     */
    _analyzeAzureResponse(statusCode, responseText, responseType) {
        if (statusCode === 200 && responseType === 'xml') {
            // Azure returns XML for container listings
            if (responseText.includes('<EnumerationResults') || 
                responseText.includes('<Blobs>')) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: true
                };
            }
        }

        return this._analyzeGenericResponse(statusCode, responseText, responseType);
    }

    /**
     * Analyze DigitalOcean Spaces response (S3-compatible)
     * @private
     */
    _analyzeDigitalOceanResponse(statusCode, responseText, responseType) {
        // DigitalOcean Spaces uses S3-compatible API
        return this._analyzeS3Response(statusCode, responseText, responseType);
    }

    /**
     * Analyze Alibaba Cloud OSS response
     * @private
     */
    _analyzeAlibabaResponse(statusCode, responseText, responseType) {
        if (statusCode === 200 && responseType === 'xml') {
            // Alibaba OSS returns XML similar to S3
            if (responseText.includes('<ListBucketResult') || 
                responseText.includes('<Contents>')) {
                return {
                    accessible: true,
                    error: null,
                    statusCode: statusCode,
                    responseType: responseType,
                    listingEnabled: true
                };
            }
        }

        return this._analyzeGenericResponse(statusCode, responseText, responseType);
    }

    /**
     * Generic response analysis for unknown providers
     * @private
     */
    _analyzeGenericResponse(statusCode, responseText, responseType) {
        const accessible = statusCode >= 200 && statusCode < 300;
        
        return {
            accessible: accessible,
            error: accessible ? null : `HTTP ${statusCode}`,
            statusCode: statusCode,
            responseType: responseType,
            listingEnabled: false  // Be conservative - only set to true when we explicitly detect listing content
        };
    }

    /**
     * Split array into chunks for concurrent processing
     * @private
     */
    _chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Generate cache key for bucket test results
     * @private
     */
    _generateCacheKey(bucketInfo) {
        const key = `${bucketInfo.provider}:${bucketInfo.bucketName}:${bucketInfo.region || 'default'}`;
        return btoa(key).replace(/[^a-zA-Z0-9]/g, ''); // Base64 encode and sanitize
    }

    /**
     * Get cached result if available and not expired
     * @private
     */
    _getCachedResult(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.result;
    }

    /**
     * Cache test result with timestamp
     * @private
     */
    _setCachedResult(cacheKey, result) {
        // Limit cache size to prevent memory issues
        if (this.cache.size >= 1000) {
            // Remove oldest entries (simple LRU)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(cacheKey, {
            result: { ...result },
            timestamp: Date.now()
        });
    }

    /**
     * Separate cached and uncached buckets for optimization
     * @private
     */
    _separateCachedBuckets(bucketList) {
        const cachedResults = [];
        const uncachedBuckets = [];

        for (const bucket of bucketList) {
            const cacheKey = this._generateCacheKey(bucket);
            const cachedResult = this._getCachedResult(cacheKey);
            
            if (cachedResult) {
                cachedResults.push({ ...cachedResult, fromCache: true });
                this.stats.cacheHits++;
            } else {
                uncachedBuckets.push(bucket);
                this.stats.cacheMisses++;
            }
        }

        return { cachedResults, uncachedBuckets };
    }

    /**
     * Calculate adaptive concurrency based on system performance and bucket count
     * @private
     */
    _calculateAdaptiveConcurrency(bucketCount) {
        // Start with configured max concurrency
        let concurrency = this.maxConcurrent;

        // Reduce concurrency for large batches to prevent overwhelming
        if (bucketCount > 20) {
            concurrency = Math.max(2, Math.floor(this.maxConcurrent * 0.7));
        }

        // Adjust based on recent performance
        if (this.stats.averageResponseTime > 3000) {
            concurrency = Math.max(1, Math.floor(concurrency * 0.5));
        }

        return concurrency;
    }

    /**
     * Add progressive delay between chunks
     * @private
     */
    async _progressiveDelay(chunkIndex) {
        // Increase delay for later chunks to prevent rate limiting
        const baseDelay = this.throttleDelay;
        const progressiveDelay = baseDelay + (chunkIndex * 50);
        
        await new Promise(resolve => setTimeout(resolve, progressiveDelay));
        this.stats.throttledRequests++;
    }

    /**
     * Update performance statistics
     * @private
     */
    _updatePerformanceStats(totalTime, bucketCount) {
        this.stats.totalRequests += bucketCount;
        this.stats.responseTimeSum += totalTime;
        this.stats.averageResponseTime = this.stats.responseTimeSum / this.stats.totalRequests;
    }

    /**
     * Perform accessibility test with request queuing
     * @private
     */
    async _performAccessibilityTestWithQueue(bucketInfo) {
        // Implement throttling
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.throttleDelay) {
            const waitTime = this.throttleDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.stats.throttledRequests++;
        }

        this.lastRequestTime = Date.now();
        
        return this._performAccessibilityTest(bucketInfo);
    }

    /**
     * Clear cache (useful for testing or memory management)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            cacheHitRate: this.stats.totalRequests > 0 ? 
                (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 : 0
        };
    }

    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            throttledRequests: 0,
            queuedRequests: 0,
            averageResponseTime: 0,
            responseTimeSum: 0
        };
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BucketTester;
} else if (typeof window !== 'undefined') {
    window.BucketTester = BucketTester;
}