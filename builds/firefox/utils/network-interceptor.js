/**
 * FerretWatch Network Interceptor
 * Injected into the main world to wrap fetch and XHR for API discovery.
 */

(function () {
    // Avoid double injection
    if (window.__ferretWatchInterceptorInjected) return;
    window.__ferretWatchInterceptorInjected = true;

    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    function notify(type, url, method, body = null, headers = {}) {
        // Resolve relative URLs to absolute
        try {
            url = new URL(url, window.location.href).href;
        } catch (e) {
            // If URL is invalid, ignore it
            return;
        }

        // Filter out data URLs and internal extension requests (if any leak through)
        if (url.startsWith('data:') || url.startsWith('chrome-extension:') || url.startsWith('moz-extension:')) return;

        window.postMessage({
            type: 'FERRETWATCH_API_CALL',
            data: {
                timestamp: Date.now(),
                type,
                url, // Now guaranteed absolute
                method: method || 'GET',
                body,
                headers
            }
        }, '*');
    }


    // 1. Monkey Patch fetch
    window.fetch = async function (...args) {
        const [resource, config] = args;
        let url = resource;
        let method = 'GET';
        let body = null;
        let headers = {};

        if (resource instanceof Request) {
            url = resource.url;
            method = resource.method;
            // Reading body from Request object is async and complex (detached streams), 
            // skipping body for Request objects for now to ensure stability.
            // headers = Object.fromEntries(resource.headers.entries()); 
        }

        if (config) {
            if (config.method) method = config.method;
            if (config.body) body = config.body;
            if (config.headers) headers = config.headers;
        }

        // Notify FerretWatch
        notify('fetch', url.toString(), method, body, headers);

        return originalFetch.apply(this, args);
    };

    // 2. Monkey Patch XHR
    const XHR = window.XMLHttpRequest;
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    const setRequestHeader = XHR.prototype.setRequestHeader;

    XHR.prototype.open = function (method, url) {
        this._fw_method = method;
        this._fw_url = url;
        this._fw_headers = {};
        return open.apply(this, arguments);
    };

    XHR.prototype.setRequestHeader = function (header, value) {
        this._fw_headers = this._fw_headers || {};
        this._fw_headers[header] = value;
        return setRequestHeader.apply(this, arguments);
    };

    XHR.prototype.send = function (body) {
        if (this._fw_url) {
            notify('xhr', this._fw_url, this._fw_method, body, this._fw_headers);
        }
        return send.apply(this, arguments);
    };

    console.log('[FerretWatch] API Interceptor Active');
})();
