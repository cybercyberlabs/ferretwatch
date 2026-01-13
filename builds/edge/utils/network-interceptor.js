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
        try {
            const [resource, config] = args;
            let url = resource;
            let method = 'GET';
            let body = null;
            let headers = null;

            if (resource instanceof Request) {
                url = resource.url;
                method = resource.method;
                // Extract headers from Request object
                try {
                    headers = resource.headers;
                } catch (e) {
                    console.debug('[FW Interceptor] Could not extract headers from Request:', e);
                }
                // Don't try to read body from Request - it would consume the stream
            }

            if (config) {
                if (config.method) method = config.method;
                if (config.body) body = config.body;
                if (config.headers) headers = config.headers;
            }

            // Notify FerretWatch (wrapped in try-catch to never break the fetch)
            try {
                notify('fetch', typeof url === 'string' ? url : url.toString(), method, body, headers);
            } catch (notifyError) {
                // Silently fail - don't break the fetch call
                console.debug('[FW Interceptor] Notify error:', notifyError);
            }
        } catch (e) {
            // If anything goes wrong in our interception, just pass through to original fetch
            console.debug('[FW Interceptor] Fetch interception error:', e);
        }

        return originalFetch.apply(this, args);
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
        try {
            if (this._fw_url) {
                notify('xhr', this._fw_url, this._fw_method, body, this._fw_headers);
            }
        } catch (e) {
            // Silently fail - don't break the XHR call
            console.debug('[FW Interceptor] XHR send notification error:', e);
        }
        return send.apply(this, arguments);
    };

        console.log('[FerretWatch] API Interceptor Active');
    })();

} catch (err) {
    console.error('[FW Interceptor] Fatal error during setup:', err);
    console.error('[FW Interceptor] Error stack:', err.stack);
}
