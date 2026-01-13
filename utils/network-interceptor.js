/**
 * FerretWatch Network Interceptor
 * Injected into the main world to wrap fetch and XHR for API discovery.
 */

try {
    console.log('[FW Interceptor] Script execution started');

    (function () {
        // Avoid double injection
        if (window.__ferretWatchInterceptorInjected) {
            console.log('[FW Interceptor] Already injected - skipping');
            return;
        }
        window.__ferretWatchInterceptorInjected = true;
        console.log('[FW Interceptor] Injection guard set');

        const originalFetch = window.fetch;
        const originalXHR = window.XMLHttpRequest;

    function notify(type, url, method, body = null, headers = {}) {
        // Resolve relative URLs to absolute
        try {
            url = new URL(url, window.location.href).href;
        } catch (e) {
            // If URL is invalid, ignore it
            console.warn('[FW Interceptor] Invalid URL:', url, e);
            return;
        }

        // Filter out data URLs and internal extension requests (if any leak through)
        if (url.startsWith('data:') || url.startsWith('chrome-extension:') || url.startsWith('moz-extension:')) {
            console.debug('[FW Interceptor] Skipping internal URL:', url);
            return;
        }

        console.log(`[FW Interceptor] Captured ${type}: ${method} ${url}`);

        // Serialize body safely - don't send non-cloneable objects
        let serializedBody = null;
        try {
            if (body) {
                if (typeof body === 'string') {
                    serializedBody = body;
                } else if (body instanceof FormData) {
                    serializedBody = '[FormData]';
                } else if (body instanceof Blob) {
                    serializedBody = `[Blob: ${body.type || 'unknown'}, ${body.size} bytes]`;
                } else if (body instanceof ArrayBuffer) {
                    serializedBody = `[ArrayBuffer: ${body.byteLength} bytes]`;
                } else if (body instanceof ReadableStream) {
                    serializedBody = '[ReadableStream]';
                } else if (typeof body === 'object') {
                    // Try to stringify, but don't fail if it's circular
                    try {
                        serializedBody = JSON.stringify(body);
                    } catch {
                        serializedBody = '[Object]';
                    }
                }
            }
        } catch (e) {
            serializedBody = '[Serialization Error]';
        }

        // Serialize headers safely - convert Headers object to plain object
        let serializedHeaders = {};
        try {
            if (headers) {
                if (headers instanceof Headers) {
                    // Headers object from fetch API
                    for (const [key, value] of headers.entries()) {
                        serializedHeaders[key] = value;
                    }
                } else if (typeof headers === 'object') {
                    serializedHeaders = { ...headers };
                }
            }
        } catch (e) {
            console.debug('[FW Interceptor] Headers serialization error:', e);
            serializedHeaders = {};
        }

        // Use try-catch around postMessage to never break the page
        try {
            window.postMessage({
                type: 'FERRETWATCH_API_CALL',
                data: {
                    timestamp: Date.now(),
                    type,
                    url,
                    method: method || 'GET',
                    body: serializedBody,
                    headers: serializedHeaders
                }
            }, '*');
        } catch (e) {
            // Silent fail - postMessage can fail if objects aren't cloneable
            console.debug('[FW Interceptor] postMessage failed:', e);
        }
    }


    // 1. Monkey Patch fetch
    window.fetch = async function (...args) {
        const requestStartTime = Date.now();
        let requestUrl, requestMethod, requestBody, requestHeaders;

        try {
            const [resource, config] = args;
            requestUrl = resource;
            requestMethod = 'GET';
            requestBody = null;
            requestHeaders = null;

            if (resource instanceof Request) {
                requestUrl = resource.url;
                requestMethod = resource.method;
                // Extract headers from Request object
                try {
                    requestHeaders = resource.headers;
                } catch (e) {
                    console.debug('[FW Interceptor] Could not extract headers from Request:', e);
                }
                // Don't try to read body from Request - it would consume the stream
            }

            if (config) {
                if (config.method) requestMethod = config.method;
                if (config.body) requestBody = config.body;
                if (config.headers) requestHeaders = config.headers;
            }

            // Notify FerretWatch of request (wrapped in try-catch to never break the fetch)
            try {
                notify('fetch', typeof requestUrl === 'string' ? requestUrl : requestUrl.toString(), requestMethod, requestBody, requestHeaders);
            } catch (notifyError) {
                // Silently fail - don't break the fetch call
                console.debug('[FW Interceptor] Notify error:', notifyError);
            }
        } catch (e) {
            // If anything goes wrong in our interception, just pass through to original fetch
            console.debug('[FW Interceptor] Fetch interception error:', e);
        }

        // Execute the original fetch and intercept response
        const responsePromise = originalFetch.apply(this, args);

        // Intercept response asynchronously without blocking
        responsePromise.then(response => {
            try {
                const requestDuration = Date.now() - requestStartTime;
                const urlString = typeof requestUrl === 'string' ? requestUrl : requestUrl.toString();

                // Clone response to read body without consuming it
                const responseClone = response.clone();

                // Extract response headers
                const responseHeaders = {};
                try {
                    for (const [key, value] of response.headers.entries()) {
                        responseHeaders[key] = value;
                    }
                } catch (e) {
                    console.debug('[FW Interceptor] Error extracting response headers:', e);
                }

                // Read response body asynchronously
                responseClone.text().then(responseBody => {
                    try {
                        window.postMessage({
                            type: 'FERRETWATCH_API_RESPONSE',
                            data: {
                                timestamp: Date.now(),
                                requestStartTime: requestStartTime,
                                duration: requestDuration,
                                type: 'fetch',
                                url: urlString,
                                method: requestMethod || 'GET',
                                status: response.status,
                                statusText: response.statusText,
                                responseHeaders: responseHeaders,
                                responseBody: responseBody,
                                responseSize: responseBody.length
                            }
                        }, '*');
                    } catch (e) {
                        console.debug('[FW Interceptor] Error sending response data:', e);
                    }
                }).catch(e => {
                    console.debug('[FW Interceptor] Error reading response body:', e);
                });
            } catch (e) {
                console.debug('[FW Interceptor] Response interception error:', e);
            }
        }).catch(e => {
            // Fetch failed - still notify with error info
            try {
                const requestDuration = Date.now() - requestStartTime;
                const urlString = typeof requestUrl === 'string' ? requestUrl : requestUrl.toString();

                window.postMessage({
                    type: 'FERRETWATCH_API_RESPONSE',
                    data: {
                        timestamp: Date.now(),
                        requestStartTime: requestStartTime,
                        duration: requestDuration,
                        type: 'fetch',
                        url: urlString,
                        method: requestMethod || 'GET',
                        status: 0,
                        statusText: 'Network Error',
                        error: e.message,
                        responseHeaders: {},
                        responseBody: '',
                        responseSize: 0
                    }
                }, '*');
            } catch (notifyError) {
                console.debug('[FW Interceptor] Error notifying fetch failure:', notifyError);
            }
        });

        return responsePromise;
    };

    // 2. Monkey Patch XHR
    const XHR = window.XMLHttpRequest;
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    const setRequestHeader = XHR.prototype.setRequestHeader;

    XHR.prototype.open = function (method, url, async, user, password) {
        this._fw_method = method;
        this._fw_url = url;
        this._fw_headers = {};
        // CRITICAL: Forward ALL parameters to maintain compatibility
        // Signature: open(method, url, async=true, user=null, password=null)
        return open.call(this, method, url, async, user, password);
    };

    XHR.prototype.setRequestHeader = function (header, value) {
        this._fw_headers = this._fw_headers || {};
        this._fw_headers[header] = value;
        return setRequestHeader.apply(this, arguments);
    };

    XHR.prototype.send = function (body) {
        const requestStartTime = Date.now();
        const requestUrl = this._fw_url;
        const requestMethod = this._fw_method;
        const requestHeaders = this._fw_headers;

        // Notify about the request
        try {
            if (requestUrl) {
                notify('xhr', requestUrl, requestMethod, body, requestHeaders);
            }
        } catch (e) {
            // Silently fail - don't break the XHR call
            console.debug('[FW Interceptor] XHR send notification error:', e);
        }

        // Set up response interception
        const xhr = this;
        const originalOnReadyStateChange = xhr.onreadystatechange;
        const originalOnLoad = xhr.onload;

        // Intercept readystatechange
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && requestUrl) { // DONE
                try {
                    const requestDuration = Date.now() - requestStartTime;

                    // Extract response headers
                    const responseHeaders = {};
                    try {
                        const headersString = xhr.getAllResponseHeaders();
                        if (headersString) {
                            const headerLines = headersString.trim().split(/[\r\n]+/);
                            headerLines.forEach(line => {
                                const parts = line.split(': ');
                                const key = parts.shift();
                                const value = parts.join(': ');
                                if (key) responseHeaders[key] = value;
                            });
                        }
                    } catch (e) {
                        console.debug('[FW Interceptor] Error extracting XHR response headers:', e);
                    }

                    // Send response notification
                    window.postMessage({
                        type: 'FERRETWATCH_API_RESPONSE',
                        data: {
                            timestamp: Date.now(),
                            requestStartTime: requestStartTime,
                            duration: requestDuration,
                            type: 'xhr',
                            url: requestUrl,
                            method: requestMethod || 'GET',
                            status: xhr.status,
                            statusText: xhr.statusText,
                            responseHeaders: responseHeaders,
                            responseBody: xhr.responseText || '',
                            responseSize: (xhr.responseText || '').length
                        }
                    }, '*');
                } catch (e) {
                    console.debug('[FW Interceptor] XHR response interception error:', e);
                }
            }

            // Call original handler if exists
            if (originalOnReadyStateChange) {
                try {
                    originalOnReadyStateChange.apply(xhr, arguments);
                } catch (e) {
                    console.debug('[FW Interceptor] Error in original onreadystatechange:', e);
                }
            }
        };

        // Also intercept onload as a fallback
        xhr.onload = function() {
            // onreadystatechange should have already handled this, but just in case
            if (originalOnLoad) {
                try {
                    originalOnLoad.apply(xhr, arguments);
                } catch (e) {
                    console.debug('[FW Interceptor] Error in original onload:', e);
                }
            }
        };

        return send.apply(this, arguments);
    };

        console.log('[FerretWatch] API Interceptor Active');
    })();

} catch (err) {
    console.error('[FW Interceptor] Fatal error during setup:', err);
    console.error('[FW Interceptor] Error stack:', err.stack);
}
