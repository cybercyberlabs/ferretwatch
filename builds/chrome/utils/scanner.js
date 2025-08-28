/**
 * Performance-optimized scanning engine with progressive scanning
 */

class ProgressiveScanner {
    constructor() {
        this.scanInProgress = false;
        this.scanResults = [];
        this.scanStartTime = 0;
        this.debounceTimer = null;
        this.abortController = null;
        
        // Performance tracking
        this.stats = {
            totalScans: 0,
            averageScanTime: 0,
            lastScanTime: 0,
            patternsProcessed: 0,
            bucketsScanned: 0,
            bucketsAccessible: 0
        };
        
        // Initialize bucket testing utilities
        this.bucketTester = null;
        this.initializeBucketTester();
    }
    
    /**
     * Debug logging utility - only logs when debug mode is enabled
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments to log
     */
    debugLog(message, ...args) {
        if (window.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`[Scanner Debug] ${message}`, ...args);
        }
    }
    
    /**
     * Info logging for important discoveries - always shown
     * @param {string} message - Info message
     * @param {...any} args - Additional arguments to log
     */
    infoLog(message, ...args) {
        console.log(`[Scanner] ${message}`, ...args);
    }
    
    /**
     * Initialize bucket testing utilities with performance optimizations
     * @private
     */
    async initializeBucketTester() {
        try {
            if (typeof window !== 'undefined' && window.BucketTester && window.BucketScanningSettings) {
                const settingsManager = new window.BucketScanningSettings();
                const bucketSettings = await settingsManager.getBucketScanningSettings();
                
                this.bucketTester = new window.BucketTester({
                    bucketTestTimeout: bucketSettings.testTimeout || 5000,
                    maxConcurrentTests: bucketSettings.maxConcurrentTests || 3,
                    cacheTimeout: bucketSettings.cacheTimeout || 300000,
                    throttleDelay: bucketSettings.throttleDelay || 100,
                    enableCaching: bucketSettings.enableCaching !== false,
                    enableThrottling: bucketSettings.enableThrottling !== false,
                    adaptiveConcurrency: bucketSettings.adaptiveConcurrency !== false,
                    maxCacheSize: bucketSettings.maxCacheSize || 1000
                });
            }
        } catch (error) {
            console.warn('Failed to initialize bucket tester:', error);
            // Fallback to basic initialization
            if (typeof window !== 'undefined' && window.BucketTester) {
                this.bucketTester = new window.BucketTester({
                    bucketTestTimeout: 5000,
                    maxConcurrentTests: 3
                });
            }
        }
    }
    
    /**
     * Main progressive scanning function
     * @param {string} content - Content to scan
     * @param {Array} patterns - Patterns to use for scanning
     * @param {object} options - Scanning options
     * @returns {Promise<Array>} Scan results
     */
    async progressiveScan(content, patterns, options = {}) {
        const startTime = performance.now();
        this.scanStartTime = startTime;
        this.scanInProgress = true;
        
        // Create abort controller for cancellation
        this.abortController = new AbortController();
        
        try {
            // Phase 1: Quick scan of visible content
            const visibleFindings = await this.scanVisibleContent(content, patterns, options);
            
            // Yield results immediately if found
            if (visibleFindings.length > 0) {
                this.reportIntermediateResults(visibleFindings, 'visible');
            }
            
            // Phase 2: Background scan of full content (if enabled)
            const scanningMode = window.StorageUtils?.getSetting('scanningMode', 'progressive');
            
            if (scanningMode === 'progressive' || scanningMode === 'full') {
                const fullFindings = await this.scanFullContent(content, patterns, options);
                
                // Combine and deduplicate results
                let allFindings = this.combineResults(visibleFindings, fullFindings);
                
                // Phase 3: Cloud bucket scanning (if enabled)
                this.debugLog('Checking if bucket scanning is enabled:', this.isBucketScanningEnabled());
                if (this.isBucketScanningEnabled()) {
                    this.debugLog('Bucket scanning is enabled, starting scan...');
                    const bucketFindings = await this.scanCloudBuckets(allFindings, options);
                    
                    this.debugLog(`Bucket scan returned ${bucketFindings.length} enhanced findings`);
                    
                    // Replace original bucket findings with enhanced ones
                    const originalBucketCount = allFindings.filter(f => f.category === 'cloudStorage').length;
                    const nonBucketFindings = allFindings.filter(f => f.category !== 'cloudStorage');
                    allFindings = [...nonBucketFindings, ...bucketFindings];
                    
                    this.debugLog(`Replaced ${originalBucketCount} original bucket findings with ${bucketFindings.length} enhanced findings`);
                    this.debugLog('Enhanced bucket findings risk levels:', bucketFindings.map(f => `${f.value}: ${f.riskLevel}`));
                    this.debugLog('Total findings after bucket enhancement:', allFindings.length);
                } else {
                    this.debugLog('Bucket scanning is disabled');
                }
                
                this.scanResults = allFindings;
                
                // Update statistics
                this.updateStats(performance.now() - startTime, patterns.length);
                
                return allFindings;
            }
            
            return visibleFindings;
            
        } catch (error) {
            console.error('Progressive scan error:', error);
            return [];
        } finally {
            this.scanInProgress = false;
        }
    }
    
    /**
     * Scans only visible content for quick results
     * @param {string} content - Full content
     * @param {Array} patterns - Patterns to scan
     * @param {object} options - Options
     * @returns {Promise<Array>} Findings
     */
    async scanVisibleContent(content, patterns, options) {
        const visibleContent = this.extractVisibleContent(content);
        
        // Prioritize high-risk patterns for visible content
        const highPriorityPatterns = patterns.filter(p => 
            ['critical', 'high'].includes(p.riskLevel)
        );
        
        return await this.scanWithPatterns(visibleContent, highPriorityPatterns, options);
    }
    
    /**
     * Scans full content in background
     * @param {string} content - Full content
     * @param {Array} patterns - All patterns
     * @param {object} options - Options
     * @returns {Promise<Array>} Findings
     */
    async scanFullContent(content, patterns, options) {
        // Filter and process content
        const filteredContent = this.filterContent(content);
        
        // Use all patterns for full scan
        const mediumLowPatterns = patterns.filter(p => 
            !['critical', 'high'].includes(p.riskLevel)
        );
        
        return await this.scanWithPatterns(filteredContent, mediumLowPatterns, options);
    }
    
    /**
     * Core pattern scanning with performance optimization
     * @param {string} content - Content to scan
     * @param {Array} patterns - Patterns to use
     * @param {object} options - Options
     * @returns {Promise<Array>} Findings
     */
    async scanWithPatterns(content, patterns, options) {
        const findings = [];
        const maxFindings = window.StorageUtils?.getSetting('maxFindings', 10);
        
        for (const patternConfig of patterns) {
            // Check if scan should be aborted
            if (this.abortController?.signal.aborted) {
                break;
            }
            
            // Check if category is enabled
            if (!window.StorageUtils?.isCategoryEnabled(patternConfig.category)) {
                continue;
            }
            
            try {
                // Batch process matches to avoid blocking
                const matches = await this.batchProcessMatches(content, patternConfig);
                
                for (const matchObj of matches) {
                    if (findings.length >= maxFindings) {
                        break;
                    }
                    
                    // Validate the match
                    if (this.isValidSecret(matchObj.value, patternConfig)) {
                        // Extract context around the match (50 chars before and after)
                        const contextStart = Math.max(0, matchObj.index - 50);
                        const contextEnd = Math.min(content.length, matchObj.index + matchObj.value.length + 50);
                        let context = content.slice(contextStart, contextEnd);
                        
                        // Check for exclude pattern (false positive filter)
                        if (patternConfig.excludePattern && patternConfig.excludePattern.test(context)) {
                            continue;
                        }
                        
                        // Clean up context for better readability
                        context = context
                            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                            .replace(/\s+/g, ' ')       // Collapse whitespace
                            .trim();
                        
                        const finding = {
                            value: matchObj.value,
                            type: patternConfig.type || patternConfig.description,
                            riskLevel: patternConfig.risk || patternConfig.riskLevel,
                            category: patternConfig.category || 'unknown',
                            context: context,
                            position: matchObj.index,
                            timestamp: Date.now()
                        };
                        
                        // Add provider information for cloud storage findings
                        if (patternConfig.category === 'cloudStorage' && patternConfig.provider) {
                            finding.provider = patternConfig.provider;
                            
                            // Extract bucket name for better display
                            try {
                                if (window.BucketParser) {
                                    const bucketInfo = window.BucketParser.parseBucketUrl(matchObj.value, patternConfig.provider);
                                    
                                    finding.bucketName = bucketInfo.bucketName;
                                    finding.value = bucketInfo.bucketName; // Use bucket name as the primary value
                                    finding.fullUrl = matchObj.value; // Keep full URL for reference
                                    
                                    // Improve context to show the bucket URL in a cleaner way
                                    const bucketUrlInContext = context.indexOf(matchObj.value);
                                    if (bucketUrlInContext !== -1) {
                                        // Replace the full URL in context with a cleaner representation
                                        const cleanContext = context.replace(matchObj.value, `[Bucket: ${bucketInfo.bucketName}]`);
                                        finding.context = cleanContext;
                                    }
                                }
                            } catch (error) {
                                // If parsing fails, skip this finding as it's likely a false positive
                                this.debugLog('Skipping invalid cloud storage URL:', matchObj.value, error.message);
                                continue; // Skip adding this finding
                            }
                        }
                        
                        findings.push(finding);
                    }
                }
                
                // Yield control periodically to prevent blocking
                if (patterns.indexOf(patternConfig) % 3 === 0) {
                    await this.yieldControl();
                }
                
            } catch (error) {
                console.error('Pattern scan error:', patternConfig.description, error);
            }
        }
        
        return findings;
    }
    
    /**
     * Process regex matches in batches to avoid blocking
     * @param {string} content - Content to scan
     * @param {object} patternConfig - Pattern configuration
     * @returns {Promise<Array>} Matches with position info
     */
    async batchProcessMatches(content, patternConfig) {
        const matches = [];
        const regex = patternConfig.regex;
        
        try {
            // Use matchAll to get match objects with position information
            const matchIterator = content.matchAll(regex);
            for (const match of matchIterator) {
                matches.push({
                    value: match[0],
                    index: match.index,
                    fullMatch: match
                });
                
                // Yield control periodically for large numbers of matches
                if (matches.length % 100 === 0) {
                    await this.yieldControl();
                }
            }
        } catch (error) {
            console.warn('Regex matching error:', error);
            // Fallback to simpler matching without position
            const simpleMatches = content.match(regex) || [];
            simpleMatches.forEach(match => {
                matches.push({
                    value: match,
                    index: content.indexOf(match),
                    fullMatch: match
                });
            });
        }
        
        return matches;
    }
    
    /**
     * Debounced scanning for dynamic pages
     * @param {string} content - Content to scan
     * @param {Array} patterns - Patterns
     * @param {object} options - Options
     * @returns {Promise<void>}
     */
    debouncedScan(content, patterns, options = {}) {
        const delay = window.StorageUtils?.getSetting('scanDelay', 500);
        const enableDebounce = window.StorageUtils?.getSetting('enableDebounce', true);
        
        if (!enableDebounce) {
            return this.progressiveScan(content, patterns, options);
        }
        
        // Cancel previous scan
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        return new Promise((resolve) => {
            this.debounceTimer = setTimeout(async () => {
                const results = await this.progressiveScan(content, patterns, options);
                resolve(results);
            }, delay);
        });
    }
    
    /**
     * Scan cloud buckets for public accessibility
     * @param {Array} findings - Existing findings from pattern scanning
     * @param {object} options - Scanning options
     * @returns {Promise<Array>} Enhanced findings with bucket test results
     */
    async scanCloudBuckets(findings, options = {}) {
        this.debugLog('scanCloudBuckets called with', findings.length, 'findings');
        this.debugLog('bucketTester available:', !!this.bucketTester);
        
        if (!this.bucketTester || !findings.length) {
            this.debugLog('Bucket scanning skipped - no tester or no findings');
            return [];
        }
        
        try {
            // Filter cloud storage findings by enabled providers
            const bucketFindings = findings.filter(finding => 
                finding.category === 'cloudStorage' && 
                finding.provider &&
                this.isProviderEnabled(finding.provider)
            );
            
            this.debugLog('Found', bucketFindings.length, 'bucket findings to test');
            bucketFindings.forEach(f => this.debugLog('Bucket finding:', f.value, 'category:', f.category, 'provider:', f.provider));
            
            if (bucketFindings.length === 0) {
                this.debugLog('No bucket findings to test');
                return [];
            }
            
            // Parse bucket URLs and prepare for testing
            const bucketInfoList = [];
            for (const finding of bucketFindings) {
                try {
                    if (window.BucketParser) {
                        // Try to parse using the full URL first, then fall back to the value
                        const urlToParse = finding.fullUrl || finding.value;
                        const bucketInfo = window.BucketParser.parseBucketUrl(urlToParse, finding.provider);
                        bucketInfo.originalFinding = finding;
                        bucketInfoList.push(bucketInfo);
                    }
                } catch (error) {
                    this.debugLog('Skipping invalid bucket URL during scanning:', finding.value, 'Full URL:', finding.fullUrl, 'Error:', error.message);
                    // Skip this finding - it's likely a false positive from pattern matching
                }
            }
            
            if (bucketInfoList.length === 0) {
                return [];
            }
            
            // Test bucket accessibility with concurrency control
            const testResults = await this.testBucketAccessibility(bucketInfoList);
            
            // Process results and generate enhanced findings
            const enhancedFindings = this.processBucketTestResults(testResults);
            
            // Update statistics
            this.stats.bucketsScanned += bucketInfoList.length;
            this.stats.bucketsAccessible += enhancedFindings.filter(f => f.bucketInfo?.accessible).length;
            
            return enhancedFindings;
            
        } catch (error) {
            console.error('Cloud bucket scanning error:', error);
            return [];
        }
    }
    
    /**
     * Test bucket accessibility with proper throttling
     * @param {Array} bucketInfoList - List of parsed bucket information
     * @returns {Promise<Array>} Test results
     * @private
     */
    async testBucketAccessibility(bucketInfoList) {
        const results = [];
        const bucketSettings = window.StorageUtils?.getBucketScanningSettings() || {};
        const maxConcurrent = bucketSettings.maxConcurrentTests || 3;
        const testTimeout = bucketSettings.testTimeout || 5000;
        
        // Process buckets in chunks to respect concurrency limits
        for (let i = 0; i < bucketInfoList.length; i += maxConcurrent) {
            // Check if scan should be aborted
            if (this.abortController?.signal.aborted) {
                break;
            }
            
            const chunk = bucketInfoList.slice(i, i + maxConcurrent);
            const chunkPromises = chunk.map(async (bucketInfo) => {
                try {
                    // Test each URL in the bucket's test URLs
                    for (const testUrl of bucketInfo.testUrls) {
                        const testBucketInfo = { ...bucketInfo, testUrl };
                        const result = await this.bucketTester.testBucketAccess(testBucketInfo);
                        
                        if (result.accessible === true) {
                            // Found accessible bucket, no need to test other URLs
                            return { bucketInfo, testResult: result, testUrl };
                        }
                    }
                    
                    // No accessible URLs found, return the last result
                    if (bucketInfo.testUrls.length > 0) {
                        const testBucketInfo = { ...bucketInfo, testUrl: bucketInfo.testUrls[0] };
                        const result = await this.bucketTester.testBucketAccess(testBucketInfo);
                        return { bucketInfo, testResult: result, testUrl: bucketInfo.testUrls[0] };
                    }
                    
                    return { 
                        bucketInfo, 
                        testResult: { accessible: false, error: 'No test URLs available' },
                        testUrl: null 
                    };
                    
                } catch (error) {
                    return { 
                        bucketInfo, 
                        testResult: { accessible: false, error: error.message },
                        testUrl: null 
                    };
                }
            });
            
            const chunkResults = await Promise.allSettled(chunkPromises);
            results.push(...chunkResults.map(result => 
                result.status === 'fulfilled' ? result.value : {
                    bucketInfo: null,
                    testResult: { accessible: false, error: 'Test failed' },
                    testUrl: null
                }
            ));
            
            // Yield control between chunks to prevent blocking
            await this.yieldControl();
        }
        
        return results;
    }
    
    /**
     * Process bucket test results and generate enhanced findings
     * @param {Array} testResults - Results from bucket accessibility tests
     * @returns {Array} Enhanced findings with bucket metadata
     * @private
     */
    processBucketTestResults(testResults) {
        const enhancedFindings = [];
        
        for (const { bucketInfo, testResult, testUrl } of testResults) {
            if (!bucketInfo || !bucketInfo.originalFinding) {
                continue;
            }
            
            const originalFinding = bucketInfo.originalFinding;
            
            // Create enhanced finding with bucket test results
            const enhancedFinding = {
                ...originalFinding,
                bucketInfo: {
                    bucketName: bucketInfo.bucketName,
                    provider: bucketInfo.provider,
                    region: bucketInfo.region,
                    accessible: testResult.accessible,
                    testUrl: testUrl,
                    testResults: {
                        statusCode: testResult.statusCode,
                        responseType: testResult.responseType,
                        listingEnabled: testResult.listingEnabled,
                        error: testResult.error
                    }
                }
            };
            
            // Ensure the value is the bucket name, not the full URL
            if (bucketInfo.bucketName) {
                enhancedFinding.value = bucketInfo.bucketName;
                enhancedFinding.fullUrl = bucketInfo.originalUrl || originalFinding.fullUrl;
            }
            
            // Update context to be more informative about listing capability
            if (testResult.listingEnabled === true) {
                enhancedFinding.context = `⚠️ MISCONFIGURATION: Bucket allows public listing: ${bucketInfo.bucketName} (${bucketInfo.provider.toUpperCase()})`;
            } else if (testResult.accessible === true && testResult.listingEnabled === false) {
                enhancedFinding.context = `ℹ️ Bucket exists but listing disabled: ${bucketInfo.bucketName} (${bucketInfo.provider.toUpperCase()})`;
            } else if (testResult.accessible === false) {
                enhancedFinding.context = `ℹ️ Secured bucket: ${bucketInfo.bucketName} (${bucketInfo.provider.toUpperCase()}) - Access denied`;
            } else {
                enhancedFinding.context = `ℹ️ Bucket: ${bucketInfo.bucketName} (${bucketInfo.provider.toUpperCase()}) - Access status unknown (CORS)`;
            }
            
            // Debug: Log test results to understand what's happening
            this.debugLog('Bucket test result for', bucketInfo.bucketName, ':', {
                accessible: testResult.accessible,
                listingEnabled: testResult.listingEnabled,
                statusCode: testResult.statusCode,
                responseType: testResult.responseType,
                error: testResult.error
            });
            
            // Update risk level and type based on LISTING capability
            if (testResult.listingEnabled === true) {
                // Bucket allows public listing - security misconfiguration
                enhancedFinding.riskLevel = 'medium';
                enhancedFinding.type = `${originalFinding.type} (Listing Enabled)`;
                this.debugLog(`Setting bucket ${bucketInfo.bucketName} to MEDIUM risk - listing enabled`);
            } else if (testResult.accessible === true && testResult.listingEnabled === false) {
                // Bucket exists but doesn't allow listing - informational only
                enhancedFinding.riskLevel = 'low';
                enhancedFinding.type = `${originalFinding.type} (No Listing)`;
                this.debugLog(`ℹ️ Setting bucket ${bucketInfo.bucketName} to LOW risk - no listing`);
            } else if (testResult.accessible === false) {
                // Bucket is secured/access denied - informational only
                enhancedFinding.riskLevel = 'low';
                enhancedFinding.type = `${originalFinding.type} (Secured)`;
                this.debugLog(`🔒 Setting bucket ${bucketInfo.bucketName} to LOW risk - secured`);
            } else {
                // Unknown accessibility (CORS or other issues) - informational only
                enhancedFinding.riskLevel = 'low';
                enhancedFinding.type = `${originalFinding.type} (Unknown)`;
                this.debugLog(`❓ Setting bucket ${bucketInfo.bucketName} to LOW risk - unknown status`);
            }
            
            this.debugLog(`Final risk level for ${bucketInfo.bucketName}: ${enhancedFinding.riskLevel}`);
            
            enhancedFindings.push(enhancedFinding);
        }
        
        return enhancedFindings;
    }
    
    /**
     * Check if bucket scanning is enabled
     * @returns {boolean} True if bucket scanning is enabled
     * @private
     */
    isBucketScanningEnabled() {
        if (!window.StorageUtils) {
            return false;
        }
        
        return window.StorageUtils.isBucketScanningEnabled();
    }

    /**
     * Check if a specific cloud provider is enabled for scanning
     * @param {string} provider - Provider name (aws, gcp, azure, digitalocean, alibaba)
     * @returns {boolean} True if provider is enabled
     */
    isProviderEnabled(provider) {
        if (!window.StorageUtils) {
            return true; // Default to enabled if no settings available
        }
        
        return window.StorageUtils.isProviderEnabled(provider);
    }
    
    /**
     * Cancels current scan
     */
    cancelScan() {
        if (this.abortController) {
            this.abortController.abort();
        }
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.scanInProgress = false;
    }
    
    // Helper methods
    extractVisibleContent(content) {
        if (window.ContextUtils) {
            return window.ContextUtils.extractVisibleText(content);
        }
        return content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    filterContent(content) {
        if (window.ContextUtils) {
            return window.ContextUtils.filterContent(content);
        }
        return content;
    }
    
    isValidSecret(match, patternConfig) {
        // Use existing validation logic
        if (typeof window.isValidSecret === 'function') {
            return window.isValidSecret(match, patternConfig);
        }
        return true; // Fallback
    }
    
    combineResults(visible, full) {
        const combined = [...visible, ...full];
        const unique = [];
        const seen = new Set();
        
        combined.forEach(finding => {
            if (!seen.has(finding.value)) {
                seen.add(finding.value);
                unique.push(finding);
            }
        });
        
        return unique.sort((a, b) => {
            const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return (riskOrder[b.riskLevel] || 0) - (riskOrder[a.riskLevel] || 0);
        });
    }
    
    reportIntermediateResults(findings, phase) {
        if (findings.length > 0 && typeof window.reportFindings === 'function') {
            console.log(`Found ${findings.length} credentials in ${phase} phase`);
            // Don't report immediately to avoid duplicate notifications
        }
    }
    
    isDomainWhitelisted() {
        if (window.StorageUtils) {
            return window.StorageUtils.isDomainWhitelisted(window.location.hostname);
        }
        return false;
    }
    
    splitIntoChunks(text, chunkSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    async yieldControl() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }
    
    updateStats(scanTime, patternCount) {
        this.stats.totalScans++;
        this.stats.lastScanTime = scanTime;
        this.stats.patternsProcessed += patternCount;
        this.stats.averageScanTime = (this.stats.averageScanTime * (this.stats.totalScans - 1) + scanTime) / this.stats.totalScans;
    }

    /**
     * Get comprehensive performance statistics
     * @returns {Object} Performance statistics including bucket testing metrics
     */
    getPerformanceStats() {
        const scannerStats = { ...this.stats };
        
        if (this.bucketTester) {
            const bucketStats = this.bucketTester.getPerformanceStats();
            return {
                scanner: scannerStats,
                bucketTesting: bucketStats,
                combined: {
                    totalOperations: scannerStats.totalScans + bucketStats.totalRequests,
                    averageOperationTime: (scannerStats.averageScanTime + bucketStats.averageResponseTime) / 2,
                    cacheEfficiency: bucketStats.cacheHitRate || 0
                }
            };
        }
        
        return { scanner: scannerStats };
    }

    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.stats = {
            totalScans: 0,
            averageScanTime: 0,
            lastScanTime: 0,
            patternsProcessed: 0,
            bucketsScanned: 0,
            bucketsAccessible: 0
        };
        
        if (this.bucketTester) {
            this.bucketTester.resetPerformanceStats();
        }
    }

    /**
     * Clear bucket testing cache for memory management
     */
    clearBucketCache() {
        if (this.bucketTester) {
            this.bucketTester.clearCache();
        }
    }

    /**
     * Reinitialize bucket tester with new settings
     * @param {Object} newSettings - New bucket testing settings
     */
    async reinitializeBucketTester(newSettings) {
        if (this.bucketTester) {
            // Clear existing cache
            this.bucketTester.clearCache();
        }
        
        // Reinitialize with new settings
        await this.initializeBucketTester();
    }
    
    getStats() {
        return { ...this.stats };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProgressiveScanner };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.ProgressiveScanner = ProgressiveScanner;
}
