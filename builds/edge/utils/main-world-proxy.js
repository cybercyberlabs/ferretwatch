/**
 * FerretWatch Main World Proxy
 *
 * This script runs in the main world (page context) to execute
 * fetch requests with the page's cookies and authentication.
 *
 * It avoids CSP violations by being loaded as an external script
 * rather than inline code.
 */

(function() {
    'use strict';

    // Prevent double injection
    if (window.__ferretWatchProxyLoaded) {
        // Already loaded, skipping
        return;
    }
    window.__ferretWatchProxyLoaded = true;

    // Main world proxy initialized in page context

    /**
     * Execute a proxied fetch request
     * @param {string} requestId - Unique request identifier
     * @param {string} url - Target URL (may be relative or absolute)
     * @param {object} options - Fetch options (method, headers, body, etc)
     */
    async function executeProxyRequest(requestId, url, options) {
        // Resolve relative URLs to absolute URLs using current page's origin
        let absoluteUrl = url;
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                // Use document.location instead of window.location for more reliable base URL
                const baseUrl = document.location.href;
                absoluteUrl = new URL(url, baseUrl).href;
                // Resolved relative URL to absolute
            }
        } catch (e) {
            console.error(`[FW Proxy] Failed to parse URL: ${url}`, e);
            // Fallback: try with origin + pathname
            try {
                const origin = document.location.origin;
                absoluteUrl = origin + url;
                // Fallback resolution used
            } catch (e2) {
                console.error(`[FW Proxy] Fallback also failed:`, e2);
            }
        }

        // Executing proxied request

        const dispatch = (data) => {
            window.dispatchEvent(new CustomEvent(requestId, { detail: data }));
        };

        /**
         * Make a fetch request with given credentials mode
         * @param {string} credMode - 'include', 'omit', or 'same-origin'
         */
        const makeRequest = async (credMode) => {
            const fetchOpts = {
                ...options,
                credentials: credMode
            };

            // Ensure body is properly formatted
            if (fetchOpts.body && typeof fetchOpts.body === 'object' && !(fetchOpts.body instanceof FormData)) {
                fetchOpts.body = JSON.stringify(fetchOpts.body);
            }

            return await fetch(absoluteUrl, fetchOpts);
        };

        try {
            let response;

            // Try with credentials first
            try {
                response = await makeRequest('include');
                // Request succeeded with credentials
            } catch (credError) {
                console.warn(`[FW Proxy] Request with credentials failed, retrying without:`, credError.message);
                // Fallback: try without credentials
                response = await makeRequest('omit');
                // Request succeeded without credentials
            }

            // Read response body
            let bodyText = '';
            try {
                bodyText = await response.text();
            } catch (bodyError) {
                console.error('[FW Proxy] Failed to read response body:', bodyError);
                bodyText = '[Body Read Error: ' + bodyError.message + ']';
            }

            // Extract response headers as object
            const responseHeaders = {};
            try {
                for (const [key, value] of response.headers.entries()) {
                    responseHeaders[key] = value;
                }
            } catch (headerError) {
                console.error('[FW Proxy] Failed to read response headers:', headerError);
            }

            // Send success response
            dispatch({
                success: true,
                response: {
                    success: true,
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    body: bodyText,
                    url: response.url || absoluteUrl
                }
            });

        } catch (error) {
            console.error(`[FW Proxy] Request failed:`, error);

            // Send error response
            dispatch({
                success: false,
                error: `Main World Fetch Error: ${error.message} (${error.name})`
            });
        }
    }

    /**
     * Listen for proxy request commands
     *
     * The content script will dispatch 'ferretwatch-proxy-request' events
     * with the request details.
     */
    window.addEventListener('ferretwatch-proxy-request', async (event) => {
        const { requestId, url, options } = event.detail;

        if (!requestId || !url) {
            console.error('[FW Proxy] Invalid proxy request:', event.detail);
            return;
        }

        await executeProxyRequest(requestId, url, options);
    });

    // Event listener registered for proxy requests

})();
