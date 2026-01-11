/**
 * FerretWatch Security Tester
 * Automated security testing for discovered endpoints
 */

class SecurityTester {
    constructor() {
        this.vulnerabilities = [];
        this.testResults = new Map();
    }

    /**
     * Run automated security tests on an endpoint
     * @param {Object} endpoint - Endpoint to test
     * @param {Function} proxyRequest - Function to make proxied requests
     * @returns {Promise<Array>} Array of vulnerabilities found
     */
    async testEndpoint(endpoint, proxyRequest) {
        const vulnerabilities = [];

        try {
            // Test 1: Unsecured Access (No Auth)
            const authVuln = await this.testUnsecuredAccess(endpoint, proxyRequest);
            if (authVuln) vulnerabilities.push(authVuln);

            // Test 2: IDOR - ID Manipulation
            const idorVuln = await this.testIDOR(endpoint, proxyRequest);
            if (idorVuln) vulnerabilities.push(...idorVuln);

            // Test 3: Method-based Access Control
            const methodVuln = await this.testMethodBypass(endpoint, proxyRequest);
            if (methodVuln) vulnerabilities.push(...methodVuln);

            // Store results
            this.testResults.set(endpoint.url, {
                tested: true,
                vulnerabilities: vulnerabilities,
                testedAt: Date.now()
            });

        } catch (error) {
            console.error('[SecurityTester] Error testing endpoint:', endpoint.url, error);
        }

        return vulnerabilities;
    }

    /**
     * Test if endpoint is accessible without authentication
     * @param {Object} endpoint - Endpoint to test
     * @param {Function} proxyRequest - Proxy request function
     * @returns {Promise<Object|null>} Vulnerability object or null
     */
    async testUnsecuredAccess(endpoint, proxyRequest) {
        try {
            // Remove authentication headers
            const cleanHeaders = this.removeAuthHeaders(endpoint.headers || {});

            const response = await proxyRequest(
                endpoint.url,
                endpoint.method,
                cleanHeaders,
                endpoint.body
            );

            // Check if request succeeded without auth
            if (response.status >= 200 && response.status < 300) {
                const contentType = response.headers?.['content-type']?.toLowerCase() || '';
                const isHTML = contentType.includes('text/html');
                const bodyLower = (response.body || '').toLowerCase();

                // Check if it's a login redirect (not a vulnerability)
                const loginIndicators = ['<form', 'login', 'signin', 'authenticate', 'unauthorized'];
                const hasLoginIndicators = loginIndicators.some(ind => bodyLower.includes(ind));

                if (isHTML && hasLoginIndicators) {
                    // Proper auth enforcement
                    return null;
                }

                // Check if response contains actual data (JSON or meaningful content)
                const isJSON = contentType.includes('application/json');
                const hasJSONContent = !isHTML && bodyLower.startsWith('{');

                if (isJSON || hasJSONContent) {
                    return {
                        type: 'BROKEN_AUTHENTICATION',
                        severity: 'HIGH',
                        endpoint: endpoint.url,
                        method: endpoint.method,
                        title: 'Endpoint Accessible Without Authentication',
                        description: `The endpoint returned API data (${response.status}) without requiring authentication headers.`,
                        evidence: {
                            status: response.status,
                            contentType: contentType,
                            bodyPreview: response.body ? response.body.substring(0, 200) : null
                        },
                        remediation: 'Implement proper authentication and authorization checks on this endpoint.',
                        discoveredAt: Date.now()
                    };
                }
            }

            return null;
        } catch (error) {
            console.debug('[SecurityTester] Unsecured access test failed:', error.message);
            return null;
        }
    }

    /**
     * Test for IDOR vulnerabilities (ID manipulation)
     * @param {Object} endpoint - Endpoint to test
     * @param {Function} proxyRequest - Proxy request function
     * @returns {Promise<Array>} Array of vulnerabilities
     */
    async testIDOR(endpoint, proxyRequest) {
        const vulnerabilities = [];

        try {
            // Extract IDs from URL
            const ids = this.extractIDs(endpoint.url);
            if (ids.length === 0) return vulnerabilities;

            // For each ID found, try incrementing and decrementing
            for (const idInfo of ids) {
                const testUrls = this.generateIDTestURLs(endpoint.url, idInfo);

                for (const testUrl of testUrls) {
                    try {
                        const response = await proxyRequest(
                            testUrl,
                            endpoint.method,
                            endpoint.headers,
                            endpoint.body
                        );

                        // Check if we got valid data for a different ID
                        if (response.status >= 200 && response.status < 300) {
                            const contentType = response.headers?.['content-type']?.toLowerCase() || '';
                            const isJSON = contentType.includes('application/json');

                            if (isJSON && response.body) {
                                // Potential IDOR - got data for manipulated ID
                                vulnerabilities.push({
                                    type: 'IDOR',
                                    severity: 'HIGH',
                                    endpoint: endpoint.url,
                                    method: endpoint.method,
                                    title: 'Insecure Direct Object Reference (IDOR)',
                                    description: `The endpoint allows access to resources by manipulating the ID parameter from ${idInfo.value} to ${idInfo.testValue}.`,
                                    evidence: {
                                        originalUrl: endpoint.url,
                                        testUrl: testUrl,
                                        originalId: idInfo.value,
                                        testId: idInfo.testValue,
                                        status: response.status,
                                        bodyPreview: response.body.substring(0, 200)
                                    },
                                    remediation: 'Implement proper authorization checks to ensure users can only access their own resources.',
                                    discoveredAt: Date.now()
                                });

                                // Only report one IDOR per ID to avoid spam
                                break;
                            }
                        }
                    } catch (error) {
                        // Test failed, continue to next
                        continue;
                    }
                }
            }
        } catch (error) {
            console.debug('[SecurityTester] IDOR test failed:', error.message);
        }

        return vulnerabilities;
    }

    /**
     * Test if endpoint is vulnerable to method-based access control bypass
     * @param {Object} endpoint - Endpoint to test
     * @param {Function} proxyRequest - Proxy request function
     * @returns {Promise<Array>} Array of vulnerabilities
     */
    async testMethodBypass(endpoint, proxyRequest) {
        const vulnerabilities = [];

        try {
            // Test different HTTP methods
            const methodsToTest = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
            const originalMethod = endpoint.method.toUpperCase();

            for (const method of methodsToTest) {
                if (method === originalMethod) continue;

                try {
                    // Remove auth headers for this test
                    const cleanHeaders = this.removeAuthHeaders(endpoint.headers || {});

                    const response = await proxyRequest(
                        endpoint.url,
                        method,
                        cleanHeaders,
                        method !== 'GET' ? endpoint.body : null
                    );

                    // Check if method bypass worked
                    if (response.status >= 200 && response.status < 300) {
                        const contentType = response.headers?.['content-type']?.toLowerCase() || '';
                        const isJSON = contentType.includes('application/json');

                        if (isJSON && response.body) {
                            vulnerabilities.push({
                                type: 'METHOD_BYPASS',
                                severity: 'MEDIUM',
                                endpoint: endpoint.url,
                                method: method,
                                title: 'HTTP Method-Based Access Control Bypass',
                                description: `The endpoint is accessible via ${method} method without authentication, even though the original request used ${originalMethod}.`,
                                evidence: {
                                    originalMethod: originalMethod,
                                    bypassMethod: method,
                                    status: response.status,
                                    bodyPreview: response.body.substring(0, 200)
                                },
                                remediation: 'Implement consistent authorization checks across all HTTP methods for this endpoint.',
                                discoveredAt: Date.now()
                            });
                        }
                    }
                } catch (error) {
                    // Test failed, continue
                    continue;
                }
            }
        } catch (error) {
            console.debug('[SecurityTester] Method bypass test failed:', error.message);
        }

        return vulnerabilities;
    }

    /**
     * Extract ID-like parameters from URL
     * @param {string} url - URL to analyze
     * @returns {Array} Array of ID objects
     */
    extractIDs(url) {
        const ids = [];

        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

            // Look for numeric IDs in path
            pathParts.forEach((part, index) => {
                // Numeric ID
                if (/^\d+$/.test(part)) {
                    ids.push({
                        type: 'numeric',
                        value: part,
                        position: index,
                        testValue: (parseInt(part) + 1).toString()
                    });
                }

                // UUID-like
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
                    // For UUIDs, we can try common test UUIDs
                    ids.push({
                        type: 'uuid',
                        value: part,
                        position: index,
                        testValue: '00000000-0000-0000-0000-000000000001'
                    });
                }
            });

            // Look for IDs in query parameters
            const params = urlObj.searchParams;
            for (const [key, value] of params.entries()) {
                if (/^\d+$/.test(value) && (key.toLowerCase().includes('id') || key.toLowerCase().includes('user'))) {
                    ids.push({
                        type: 'query-param',
                        key: key,
                        value: value,
                        testValue: (parseInt(value) + 1).toString()
                    });
                }
            }
        } catch (error) {
            console.debug('[SecurityTester] ID extraction failed:', error);
        }

        return ids;
    }

    /**
     * Generate test URLs with manipulated IDs
     * @param {string} originalUrl - Original URL
     * @param {Object} idInfo - ID information
     * @returns {Array} Array of test URLs
     */
    generateIDTestURLs(originalUrl, idInfo) {
        const testUrls = [];

        try {
            const urlObj = new URL(originalUrl);

            if (idInfo.type === 'query-param') {
                // Manipulate query parameter
                urlObj.searchParams.set(idInfo.key, idInfo.testValue);
                testUrls.push(urlObj.toString());
            } else {
                // Manipulate path segment
                const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
                pathParts[idInfo.position] = idInfo.testValue;
                urlObj.pathname = '/' + pathParts.join('/');
                testUrls.push(urlObj.toString());

                // Also try decrementing for numeric IDs
                if (idInfo.type === 'numeric' && parseInt(idInfo.value) > 1) {
                    const pathParts2 = urlObj.pathname.split('/').filter(p => p.length > 0);
                    pathParts2[idInfo.position] = (parseInt(idInfo.value) - 1).toString();
                    urlObj.pathname = '/' + pathParts2.join('/');
                    testUrls.push(urlObj.toString());
                }
            }
        } catch (error) {
            console.debug('[SecurityTester] Test URL generation failed:', error);
        }

        return testUrls;
    }

    /**
     * Remove authentication headers from request
     * @param {Object} headers - Original headers
     * @returns {Object} Clean headers
     */
    removeAuthHeaders(headers) {
        const authHeaders = ['authorization', 'x-api-key', 'token', 'access-token', 'cookie', 'session'];
        const cleanHeaders = {};

        for (const [key, value] of Object.entries(headers)) {
            if (!authHeaders.includes(key.toLowerCase())) {
                cleanHeaders[key] = value;
            }
        }

        return cleanHeaders;
    }

    /**
     * Get all vulnerabilities found
     * @returns {Array} All vulnerabilities
     */
    getVulnerabilities() {
        return this.vulnerabilities;
    }

    /**
     * Clear all vulnerabilities
     */
    clearVulnerabilities() {
        this.vulnerabilities = [];
        this.testResults.clear();
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.SecurityTester = SecurityTester;
}
