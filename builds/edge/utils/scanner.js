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
            patternsProcessed: 0
        };
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
                const allFindings = this.combineResults(visibleFindings, fullFindings);
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
                        
                        findings.push({
                            value: matchObj.value,
                            type: patternConfig.type || patternConfig.description,
                            riskLevel: patternConfig.risk || patternConfig.riskLevel,
                            category: patternConfig.category || 'unknown',
                            context: context,
                            position: matchObj.index,
                            timestamp: Date.now()
                        });
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
        this.stats.averageScanTime = 
            (this.stats.averageScanTime * (this.stats.totalScans - 1) + scanTime) / this.stats.totalScans;
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
