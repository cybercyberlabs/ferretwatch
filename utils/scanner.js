/**
 * Performance-optimized scanning engine with progressive scanning
 */

function trimCapturedSecret(value) {
    if (value == null) return '';
    let text = String(value).trim();
    let previous;
    do {
        previous = text;
        text = text.replace(/(?:\\[nrt])+$/i, '').trim();
    } while (text !== previous);
    return text;
}

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
        
        // Initialize bucket testing utilities. Callers must await _bucketInit
        // before probing; the constructor itself stays synchronous.
        this.bucketTester = null;
        this._bucketInit = this.initializeBucketTester();
        this.lastScanState = 'pending';
        this.lastScanError = null;
        this.inspectionTruncated = false;
    }
    
    /**
     * Debug logging utility - only logs when debug mode is enabled
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments to log
     */
    debugLog(message, ...args) {
        if (globalThis.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`[Scanner Debug] ${message}`, ...args);
        }
    }
    
    /**
     * Info logging for important discoveries - shown when debug mode enabled
     * @param {string} message - Info message
     * @param {...any} args - Additional arguments to log
     */
    infoLog(message, ...args) {
        if (globalThis.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`[Scanner] ${message}`, ...args);
        }
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
            this.inspectionTruncated = false;
            const scanOptions = { ...options, deferLimit: true };
            const visibleFindings = await this.scanVisibleContent(content, patterns, scanOptions);

            if (visibleFindings.length > 0) {
                this.reportIntermediateResults(visibleFindings, 'visible');
            }

            const scanningMode = globalThis.StorageUtils?.getSetting('scanningMode', 'progressive');
            let allFindings = visibleFindings;

            if (scanningMode === 'progressive' || scanningMode === 'full') {
                const fullFindings = await this.scanFullContent(content, patterns, scanOptions);
                allFindings = this.combineResults(visibleFindings, fullFindings);
            }

            allFindings = this.applyFindingLimit(allFindings);

            if (this.isBucketScanningEnabled() && !options.skipBucketProbes) {
                allFindings = await this.enrichBucketFindings(allFindings, options);
            }

            this.scanResults = allFindings;
            this.lastScanState = this.inspectionTruncated ? 'truncated' : 'success';
            this.updateStats(performance.now() - startTime, patterns.length);
            return allFindings;

        } catch (error) {
            console.error('Progressive scan error:', error);
            this.lastScanState = 'failed';
            this.lastScanError = error.message;
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
        
        const sourceKind = options.sourceKind && options.sourceKind !== 'document'
            ? options.sourceKind
            : 'visible';
        return await this.scanWithPatterns(visibleContent, highPriorityPatterns, {
            ...options,
            sourceKind
        });
    }
    
    /**
     * Scans full content in background
     * @param {string} content - Full content
     * @param {Array} patterns - All patterns
     * @param {object} options - Options
     * @returns {Promise<Array>} Findings
     */
    async scanFullContent(content, patterns, options) {
        const sources = this.collectSources(content, options);
        const findings = [];
        for (const source of sources) {
            const part = await this.scanWithPatterns(source.text, patterns, {
                ...options,
                sourceKind: source.kind
            });
            findings.push(...part);
            if (this.pastScanDeadline(options)) {
                this.inspectionTruncated = true;
                break;
            }
        }
        return findings;
    }

    collectSources(content, options) {
        const text = content || '';
        if (options && options.sourceKind && options.sourceKind !== 'document') {
            return [{ kind: options.sourceKind, text }];
        }
        const utils = (typeof window !== 'undefined' && window.ContextUtils) ||
            (typeof ContextUtils !== 'undefined' ? ContextUtils : null);
        const sources = [{ kind: 'visible', text: this.extractVisibleContent(text) }];
        if (utils && utils.extractScriptBodies) {
            sources.push({ kind: 'script', text: utils.extractScriptBodies(text) });
        }
        if (utils && utils.extractAttributeValues) {
            sources.push({ kind: 'attribute', text: utils.extractAttributeValues(text) });
        }
        return sources.filter((source) => source.text);
    }

    pastScanDeadline(options) {
        const budget = (options && options.scanTimeMs) ||
            (typeof FerretWatchContracts !== 'undefined' ? FerretWatchContracts.CAPTURE_LIMITS.scanTimeMs : 250);
        return (performance.now() - this.scanStartTime) > budget;
    }

    applyFindingLimit(findings) {
        const maxFindings = globalThis.StorageUtils?.getSetting('maxFindings', 50);
        if (!maxFindings || findings.length <= maxFindings) {
            return findings;
        }
        this.inspectionTruncated = true;
        return findings.slice(0, maxFindings);
    }

    async enrichBucketFindings(findings, options) {
        const originals = findings.filter((finding) => finding.category === 'cloudStorage');
        if (!this.shouldProbeBuckets()) {
            return findings.map((finding) => finding.category === 'cloudStorage'
                ? { ...finding, accessStatus: 'untested' }
                : finding);
        }
        try {
            const enriched = await this.scanCloudBuckets(findings, options);
            if (!enriched || enriched.length === 0) {
                return findings.map((finding) => finding.category === 'cloudStorage'
                    ? { ...finding, accessStatus: finding.accessStatus || 'untested' }
                    : finding);
            }
            const nonBucket = findings.filter((finding) => finding.category !== 'cloudStorage');
            const covered = new Set(enriched.map((finding) => finding.value));
            const retained = originals.filter((finding) => !covered.has(finding.value))
                .map((finding) => ({ ...finding, accessStatus: 'untested' }));
            return [...nonBucket, ...enriched, ...retained];
        } catch (error) {
            this.debugLog('Bucket enrichment failed:', error.message);
            return findings.map((finding) => finding.category === 'cloudStorage'
                ? { ...finding, accessStatus: 'untested' }
                : finding);
        }
    }

    shouldProbeBuckets() {
        const settings = globalThis.StorageUtils?.getBucketScanningSettings?.() || {};
        return settings.testPublicAccess === true;
    }

    async ensureBucketTester() {
        if (this._bucketInit) {
            try {
                await this._bucketInit;
            } catch (error) {
                this.debugLog('Bucket tester init failed:', error.message);
            }
        }
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
        const maxFindings = options.deferLimit ? Infinity : globalThis.StorageUtils?.getSetting('maxFindings', 50);
        const matchCap = (typeof FerretWatchContracts !== 'undefined'
            ? FerretWatchContracts.CAPTURE_LIMITS.matchesPerPattern
            : 200);

        for (const patternConfig of patterns) {
            // Check between patterns as well as sources.
            if (this.pastScanDeadline(options)) {
                this.inspectionTruncated = true;
                break;
            }
            if (this.abortController?.signal.aborted) {
                break;
            }
            
            // Check if category is enabled
            if (!globalThis.StorageUtils?.isCategoryEnabled(patternConfig.category)) {
                continue;
            }
            
            try {
                // Batch process matches to avoid blocking
                const matches = await this.batchProcessMatches(content, patternConfig, matchCap);
                if (matches.truncated) {
                    this.inspectionTruncated = true;
                }
                
                for (const matchObj of matches.items) {
                    if (findings.length >= maxFindings) {
                        break;
                    }
                    const capturedValue = trimCapturedSecret(matchObj.value);
                    if (!capturedValue || !this.isValidSecret(capturedValue, patternConfig)) {
                        continue;
                    }
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
                            value: capturedValue,
                            type: patternConfig.type || patternConfig.description,
                            patternId: patternConfig.id || patternConfig.type || patternConfig.description,
                            riskLevel: patternConfig.risk || patternConfig.riskLevel,
                            category: patternConfig.category || 'unknown',
                            context: context,
                            position: matchObj.index,
                            timestamp: Date.now(),
                            sourceKind: options.sourceKind || 'document',
                            sourceUrl: options.sourceUrl || (typeof location !== 'undefined' ? location.href : '')
                        };
                        if (typeof FerretWatchContracts !== 'undefined') {
                            finding.id = FerretWatchContracts.findingId(finding);
                        }
                        
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
    async batchProcessMatches(content, patternConfig, matchCap) {
        const matches = [];
        const regex = patternConfig.regex;
        const cap = matchCap || 200;
        let truncated = false;

        try {
            if (regex && typeof regex.lastIndex === 'number') {
                regex.lastIndex = 0;
            }
            const matchIterator = content.matchAll(regex);
            for (const match of matchIterator) {
                if (matches.length >= cap) {
                    truncated = true;
                    break;
                }
                matches.push({
                    value: match[0],
                    index: match.index,
                    fullMatch: match
                });

                if (matches.length % 100 === 0) {
                    await this.yieldControl();
                }
            }
        } catch (error) {
            console.warn('Regex matching error:', error);
            const simpleMatches = content.match(regex) || [];
            simpleMatches.forEach(match => {
                if (matches.length >= cap) {
                    truncated = true;
                    return;
                }
                matches.push({
                    value: match,
                    index: content.indexOf(match),
                    fullMatch: match
                });
            });
        }

        return { items: matches, truncated };
    }
    
    /**
     * Debounced scanning for dynamic pages
     * @param {string} content - Content to scan
     * @param {Array} patterns - Patterns
     * @param {object} options - Options
     * @returns {Promise<void>}
     */
    debouncedScan(content, patterns, options = {}) {
        const delay = globalThis.StorageUtils?.getSetting('scanDelay', 500);
        const enableDebounce = globalThis.StorageUtils?.getSetting('enableDebounce', true);
        
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
        
        await this.ensureBucketTester();
        if (!this.shouldProbeBuckets()) {
            return findings
                .filter((finding) => finding.category === 'cloudStorage')
                .map((finding) => ({ ...finding, accessStatus: 'untested' }));
        }
        if (!this.bucketTester || !findings.length) {
            this.debugLog('Bucket scanning skipped - no tester or no findings');
            return findings
                .filter((finding) => finding.category === 'cloudStorage')
                .map((finding) => ({ ...finding, accessStatus: 'untested' }));
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
                return bucketFindings.map((finding) => ({ ...finding, accessStatus: 'parse_failure' }));
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
            return findings
                .filter((finding) => finding.category === 'cloudStorage')
                .map((finding) => ({ ...finding, accessStatus: 'network_failure' }));
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
        const bucketSettings = globalThis.StorageUtils?.getBucketScanningSettings() || {};
        const maxConcurrent = bucketSettings.maxConcurrentTests || 3;
        const testTimeout = bucketSettings.testTimeout || 5000;
        
        // Process buckets in chunks to respect concurrency limits
        for (let i = 0; i < bucketInfoList.length; i += maxConcurrent) {
            if (this.abortController?.signal.aborted) break;
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
                        testResult: { accessible: null, untested: true, error: 'No test URLs available' },
                        testUrl: null
                    };

                } catch (error) {
                    return {
                        bucketInfo,
                        testResult: { accessible: null, failed: true, error: error.message },
                        testUrl: null
                    };
                }
            });
            
            const chunkResults = await Promise.allSettled(chunkPromises);
            results.push(...chunkResults.map(result => 
                result.status === 'fulfilled' ? result.value : {
                    bucketInfo: null,
                    testResult: { accessible: null, failed: true, error: 'Test failed' },
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
            const accessStatus = this.classifyAccess(testResult);

            const enhancedFinding = {
                ...originalFinding,
                accessStatus,
                bucketInfo: {
                    bucketName: bucketInfo.bucketName,
                    provider: bucketInfo.provider,
                    region: bucketInfo.region,
                    accessible: testResult.accessible,
                    accessStatus,
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
            const labels = {
                public_listing: 'Public listing',
                accessible_object: 'Accessible object',
                access_denied: 'Access denied',
                untested: 'Not tested',
                timeout: 'Probe timed out',
                network_failure: 'Probe failed',
                parse_failure: 'Could not parse probe response'
            };
            enhancedFinding.context = `${labels[accessStatus] || accessStatus}: ${bucketInfo.bucketName} (${bucketInfo.provider.toUpperCase()})`;
            
            // Debug: Log test results to understand what's happening
            this.debugLog('Bucket test result for', bucketInfo.bucketName, ':', {
                accessible: testResult.accessible,
                listingEnabled: testResult.listingEnabled,
                statusCode: testResult.statusCode,
                responseType: testResult.responseType,
                error: testResult.error
            });
            
            // Update risk level and type based on LISTING capability
            if (accessStatus === 'public_listing') {
                enhancedFinding.riskLevel = 'medium';
                enhancedFinding.type = `${originalFinding.type} (Public listing)`;
            } else if (accessStatus === 'accessible_object') {
                enhancedFinding.riskLevel = 'low';
                enhancedFinding.type = `${originalFinding.type} (Accessible object)`;
            } else if (accessStatus === 'access_denied') {
                enhancedFinding.riskLevel = 'low';
                enhancedFinding.type = `${originalFinding.type} (Access denied)`;
            } else {
                enhancedFinding.riskLevel = originalFinding.riskLevel || 'low';
                enhancedFinding.type = `${originalFinding.type} (${accessStatus})`;
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
        if (!globalThis.StorageUtils) {
            return false;
        }
        
        return globalThis.StorageUtils.isBucketScanningEnabled();
    }

    /**
     * Check if a specific cloud provider is enabled for scanning
     * @param {string} provider - Provider name (aws, gcp, azure, digitalocean, alibaba)
     * @returns {boolean} True if provider is enabled
     */
    isProviderEnabled(provider) {
        if (!globalThis.StorageUtils) {
            return true; // Default to enabled if no settings available
        }
        
        return globalThis.StorageUtils.isProviderEnabled(provider);
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
    
    classifyAccess(testResult) {
        if (typeof FerretWatchContracts !== 'undefined') {
            return FerretWatchContracts.classifyBucketAccess(testResult);
        }
        if (typeof window !== 'undefined' && window.FerretWatchContracts) {
            return window.FerretWatchContracts.classifyBucketAccess(testResult);
        }
        return 'untested';
    }

    isValidSecret(match, patternConfig) {
        const validator = (typeof patternValidator !== 'undefined' && patternValidator) ||
            (typeof window !== 'undefined' && window.patternValidator);
        if (validator && typeof validator.isValidSecret === 'function') {
            return validator.isValidSecret(match, patternConfig || {});
        }
        return true;
    }
    
    combineResults(visible, full) {
        const combined = [...visible, ...full];
        const unique = [];
        const seen = new Set();
        
        combined.forEach(finding => {
            const key = (finding.patternId || finding.type || '') + '\n' + finding.value;
            if (!seen.has(key)) {
                seen.add(key);
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
            this.debugLog(`Found ${findings.length} credentials in ${phase} phase`);
            // Don't report immediately to avoid duplicate notifications
        }
    }
    
    isDomainWhitelisted() {
        if (globalThis.StorageUtils) {
            return globalThis.StorageUtils.isDomainWhitelisted(window.location.hostname);
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
