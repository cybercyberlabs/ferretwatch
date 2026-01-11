/**
 * FerretWatch Endpoint Scanner
 * Discovers potential API endpoints from JavaScript code
 */

class EndpointScanner {
    constructor() {
        // URL patterns to match
        this.patterns = [
            // Quoted strings starting with / or http
            {
                regex: /['"`]((?:https?:)?\/[a-zA-Z0-9\/_\-\.%\?=&:]+)['"`]/g,
                confidence: 0.6,
                name: 'quoted-string'
            },
            // Template literals
            {
                regex: /`((?:https?:)?\/[a-zA-Z0-9\/_\-\.%\?=&:\$\{\}]+)`/g,
                confidence: 0.5, // Lower confidence due to variables
                name: 'template-literal'
            },
            // fetch() calls with method detection
            {
                regex: /fetch\s*\(\s*['"`]([^'"` ]+)['"`]\s*(?:,\s*\{[^}]*method\s*:\s*['"`]([A-Z]+)['"`][^}]*\})?/gi,
                confidence: 0.9,
                name: 'fetch-call',
                captureMethod: true
            },
            // axios/http library calls with method in function name
            {
                regex: /(?:axios|http)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"` ]+)['"`]/gi,
                confidence: 0.9,
                name: 'http-library',
                methodInMatch: true
            },
            // jQuery ajax
            {
                regex: /\$\.(?:ajax|get|post)\s*\(\s*(?:\{[^}]*url\s*:\s*)?['"`]([^'"` ]+)['"`]/g,
                confidence: 0.8,
                name: 'jquery-ajax'
            },
            // URL constructor
            {
                regex: /new\s+URL\s*\(\s*['"`]([^'"` ]+)['"`]/g,
                confidence: 0.7,
                name: 'url-constructor'
            },
            // API path patterns
            {
                regex: /['"`](\/api\/[a-zA-Z0-9\/_\-\.%\?=&:]+)['"`]/g,
                confidence: 0.8,
                name: 'api-path'
            },
            // RESTful patterns
            {
                regex: /['"`](\/(?:v\d+\/)?(?:users?|accounts?|auth|admin|internal|debug|api)[a-zA-Z0-9\/_\-\.%\?=&:]*)['"`]/g,
                confidence: 0.7,
                name: 'restful-pattern'
            }
        ];

        // Patterns to exclude (false positives)
        this.excludePatterns = [
            /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$/i,  // Static assets
            /^\/$/,  // Root path only
            /^\/(favicon\.ico|robots\.txt|sitemap\.xml)$/i,  // Common files
            /^https?:\/\/(?!.*(?:localhost|127\.0\.0\.1|\[::1\]))/,  // External domains (keep local)
            /^\/\//,  // Protocol-relative URLs
            /^javascript:/i,  // JavaScript URLs
            /^mailto:/i,  // Email links
            /^tel:/i,  // Phone links
            /^#/,  // Hash anchors
        ];

        this.discovered = new Map();
    }

    /**
     * Scan page for potential endpoints
     * @returns {Promise<Object>} Discovered endpoints and metadata
     */
    async scanPage() {
        this.discovered.clear();

        // Scan inline scripts
        this.scanInlineScripts();

        // Scan external scripts (same-origin only)
        await this.scanExternalScripts();

        // Convert to array and sort by confidence
        const endpoints = Array.from(this.discovered.values())
            .sort((a, b) => b.confidence - a.confidence);

        return {
            total: endpoints.length,
            endpoints: endpoints,
            scannedAt: Date.now()
        };
    }

    /**
     * Scan inline script tags
     */
    scanInlineScripts() {
        const scripts = document.querySelectorAll('script:not([src])');

        scripts.forEach((script, index) => {
            if (!script.textContent || script.textContent.length === 0) return;

            this.extractURLs(script.textContent, {
                source: 'inline-script',
                sourceDetail: `inline-script-${index}`,
                scriptElement: script,
                scriptUrl: window.location.href // Inline scripts belong to current page
            });
        });
    }

    /**
     * Scan external script files
     */
    async scanExternalScripts() {
        const scripts = document.querySelectorAll('script[src]');
        const promises = [];

        scripts.forEach(script => {
            const src = script.src;

            // Only scan same-origin scripts
            if (!this.isSameOrigin(src)) {
                return;
            }

            // Skip if already in cache (from network interceptor)
            const promise = this.fetchScriptContent(src)
                .then(content => {
                    if (content) {
                        this.extractURLs(content, {
                            source: 'external-script',
                            sourceDetail: this.getFilename(src),
                            scriptUrl: src
                        });
                    }
                })
                .catch(err => {
                    console.debug('[Scanner] Could not fetch script:', src, err.message);
                });

            promises.push(promise);
        });

        await Promise.all(promises);
    }

    /**
     * Fetch script content
     * @param {string} url Script URL
     * @returns {Promise<string|null>} Script content or null
     */
    async fetchScriptContent(url) {
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                cache: 'force-cache'  // Use cached if available
            });

            if (!response.ok) return null;

            const content = await response.text();
            return content;
        } catch (err) {
            return null;
        }
    }

    /**
     * Extract URLs from code using all patterns
     * @param {string} code JavaScript code
     * @param {Object} metadata Source metadata
     */
    extractURLs(code, metadata) {
        if (!code || typeof code !== 'string') return;

        this.patterns.forEach(pattern => {
            const matches = code.matchAll(pattern.regex);

            for (const match of matches) {
                let url, method = null, payload = null;

                // Handle different pattern types
                if (pattern.methodInMatch) {
                    // Method is in capture group 1, URL in group 2 (axios.post, etc.)
                    method = match[1] ? match[1].toUpperCase() : null;
                    url = match[2];
                } else if (pattern.captureMethod) {
                    // URL in group 1, optional method in group 2 (fetch)
                    url = match[1];
                    method = match[2] ? match[2].toUpperCase() : null;
                } else {
                    // URL only in group 1
                    url = match[1];
                }

                if (!url) continue;

                // Validate and filter
                if (!this.isValidEndpoint(url)) continue;

                // Try to extract payload information from surrounding context
                const contextStart = Math.max(0, match.index - 200);
                const contextEnd = Math.min(code.length, match.index + match[0].length + 200);
                const context = code.substring(contextStart, contextEnd);

                payload = this.extractPayload(context, match[0]);

                // Calculate confidence
                const confidence = this.calculateConfidence(url, code, pattern);

                // Get line number if possible
                const lineNumber = this.getLineNumber(code, match.index);

                // Create or update endpoint entry
                const key = this.normalizeURL(url);
                const existing = this.discovered.get(key);

                if (!existing || existing.confidence < confidence) {
                    // Determine the base URL for resolving relative paths
                    let baseUrl = window.location.origin;
                    let scriptOrigin = null;

                    if (metadata.scriptUrl) {
                        try {
                            const scriptUrlObj = new URL(metadata.scriptUrl);
                            scriptOrigin = scriptUrlObj.origin;
                            baseUrl = scriptOrigin;
                        } catch (e) {
                            // Invalid script URL, use current origin
                        }
                    }

                    // Resolve the endpoint URL against the appropriate base
                    let resolvedUrl = url;
                    if (url.startsWith('/') && !url.startsWith('//')) {
                        // Relative path - resolve against script origin or current origin
                        resolvedUrl = baseUrl + url;
                    }

                    this.discovered.set(key, {
                        url: url, // Original URL as found
                        resolvedUrl: resolvedUrl, // Fully resolved URL
                        normalizedUrl: key,
                        confidence: confidence,
                        method: method || (existing?.method) || 'GET',
                        payload: payload || (existing?.payload),
                        source: metadata.source,
                        sourceDetail: metadata.sourceDetail,
                        scriptOrigin: scriptOrigin, // Origin of the script that defined this endpoint
                        lineNumber: lineNumber,
                        pattern: pattern.name,
                        context: context.substring(Math.max(0, match.index - contextStart - 50), match.index - contextStart + match[0].length + 50),
                        matchedAt: Date.now()
                    });
                }
            }
        });
    }

    /**
     * Extract payload information from code context
     * @param {string} context Code context around the match
     * @param {string} matchText The matched text
     * @returns {Object|null} Payload structure or null
     */
    extractPayload(context, matchText) {
        try {
            // Look for body: {...} or data: {...} patterns
            const bodyMatch = context.match(/(?:body|data)\s*:\s*(?:JSON\.stringify\s*\()?\s*(\{[^}]+\})/);
            if (bodyMatch) {
                try {
                    // Try to parse it as JSON
                    const bodyStr = bodyMatch[1];
                    // Clean up the body string (remove trailing commas, fix quotes, etc.)
                    const cleanBody = bodyStr.replace(/,\s*}/g, '}').replace(/'/g, '"');
                    return JSON.parse(cleanBody);
                } catch (e) {
                    // Return the raw body string if we can't parse it
                    return { raw: bodyMatch[1] };
                }
            }

            // Look for FormData patterns
            if (context.includes('FormData')) {
                return { type: 'FormData', note: 'Uses FormData (multipart/form-data)' };
            }

            // Look for URLSearchParams
            if (context.includes('URLSearchParams')) {
                return { type: 'URLSearchParams', note: 'Uses URLSearchParams (application/x-www-form-urlencoded)' };
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Validate if URL is a potential endpoint
     * @param {string} url URL to validate
     * @returns {boolean} Is valid
     */
    isValidEndpoint(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.length < 2) return false;

        // Check exclude patterns
        for (const pattern of this.excludePatterns) {
            if (pattern.test(url)) return false;
        }

        // Must start with / or http
        if (!url.startsWith('/') && !url.startsWith('http')) return false;

        // Exclude if too many template variables
        const templateVarCount = (url.match(/\$\{/g) || []).length;
        if (templateVarCount > 2) return false;

        return true;
    }

    /**
     * Calculate confidence score for a URL
     * @param {string} url URL
     * @param {string} context Surrounding code
     * @param {Object} pattern Pattern that matched
     * @returns {number} Confidence score (0-1)
     */
    calculateConfidence(url, context, pattern) {
        let score = pattern.confidence;

        // Increase confidence for API indicators
        if (url.includes('/api/')) score += 0.15;
        if (url.match(/^\/(?:v\d+\/)?(?:users?|auth|admin)/)) score += 0.1;

        // Decrease confidence for template variables
        const templateVars = (url.match(/\$\{/g) || []).length;
        score -= templateVars * 0.15;

        // Decrease if in comment
        const matchPos = context.indexOf(url);
        if (matchPos > 0) {
            const before = context.substring(Math.max(0, matchPos - 50), matchPos);
            if (before.includes('//') || before.includes('/*')) {
                score -= 0.3;
            }
        }

        // Increase for fetch/axios context
        if (context.includes('fetch(') || context.includes('axios.')) {
            score += 0.1;
        }

        // Ensure between 0 and 1
        return Math.max(0.1, Math.min(1.0, score));
    }

    /**
     * Normalize URL for comparison
     * @param {string} url URL to normalize
     * @returns {string} Normalized URL
     */
    normalizeURL(url) {
        try {
            // Remove template variables
            let normalized = url.replace(/\$\{[^}]*\}/g, ':param');

            // Remove query params for comparison
            normalized = normalized.split('?')[0];

            // Convert to absolute if relative
            if (normalized.startsWith('/')) {
                normalized = window.location.origin + normalized;
            }

            return normalized;
        } catch (e) {
            return url;
        }
    }

    /**
     * Check if URL is same-origin
     * @param {string} url URL to check
     * @returns {boolean} Is same origin
     */
    isSameOrigin(url) {
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.origin === window.location.origin;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get filename from URL
     * @param {string} url URL
     * @returns {string} Filename
     */
    getFilename(url) {
        try {
            const urlObj = new URL(url);
            const parts = urlObj.pathname.split('/');
            return parts[parts.length - 1] || 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Get line number from match index
     * @param {string} code Full code
     * @param {number} index Match index
     * @returns {number} Line number
     */
    getLineNumber(code, index) {
        if (!code || index === undefined) return 0;
        return code.substring(0, index).split('\n').length;
    }

    /**
     * Compare discovered endpoints with actually called endpoints
     * @param {Array} calledEndpoints Array of called endpoint objects
     * @returns {Object} Comparison result
     */
    compareWithCalled(calledEndpoints) {
        const calledURLs = new Set(
            calledEndpoints.map(ep => this.normalizeURL(ep.url))
        );

        const discovered = Array.from(this.discovered.values());
        const unused = discovered.filter(ep => !calledURLs.has(ep.normalizedUrl));
        const used = discovered.filter(ep => calledURLs.has(ep.normalizedUrl));

        return {
            discovered: discovered,
            unused: unused,
            used: used,
            stats: {
                totalDiscovered: discovered.length,
                totalUnused: unused.length,
                totalUsed: used.length,
                unusedPercentage: discovered.length > 0
                    ? Math.round((unused.length / discovered.length) * 100)
                    : 0
            }
        };
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.EndpointScanner = EndpointScanner;
}
