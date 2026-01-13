/**
 * Network Interceptor Manager for FerretWatch
 * Handles injection of network interceptor into page context
 */

(function() {
    'use strict';

    // Browser API reference
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // State
    let interceptorInjected = false;

    /**
     * Log debug message (requires debugLog to be available globally)
     */
    function debugLog(message) {
        if (window.debugLog) {
            window.debugLog(message);
        }
    }

    /**
     * Inject network interceptor script into page context
     * @param {Function} whitelistChecker - Function to check if domain is whitelisted
     * @returns {boolean} True if injection was successful or already injected
     */
    function injectInterceptor(whitelistChecker) {
        console.log('[FW Content] injectInterceptor() called');

        // Check whitelist
        if (whitelistChecker && whitelistChecker()) {
            console.log('[FW Content] Skipping interceptor injection - domain is whitelisted');
            return false;
        }

        // Check if already injected
        if (interceptorInjected) {
            console.log('[FW Content] Interceptor already injected by this content script - skipping');
            return true;
        }

        try {
            console.log('[FW Content] Creating interceptor script element...');
            const script = document.createElement('script');
            script.src = api.runtime.getURL('utils/network-interceptor.js');

            script.onload = function() {
                console.log('[FW Content] Interceptor script loaded and executed');
                this.remove();
            };

            script.onerror = function(e) {
                console.error('[FW Content] Interceptor script failed to load:', e);
            };

            (document.head || document.documentElement).appendChild(script);
            interceptorInjected = true;
            console.log('[FW Content] Interceptor script element appended to DOM');
            debugLog('Network interceptor injected');
            return true;
        } catch (e) {
            console.error('[FW Content] Failed to inject interceptor:', e);
            return false;
        }
    }

    /**
     * Inject interceptor early (at document_start)
     * @param {Function} loadWhitelistFn - Function to load whitelist
     * @param {Function} whitelistChecker - Function to check if domain is whitelisted
     * @returns {Promise<boolean>} True if injection was successful
     */
    async function injectInterceptorEarly(loadWhitelistFn, whitelistChecker) {
        try {
            console.log('[FW Content] Early initialization at document_start');
            await loadWhitelistFn();

            if (whitelistChecker()) {
                console.log('[FW Content] Domain is whitelisted - skipping interceptor injection');
                return false;
            }

            // Inject interceptor before any page scripts can run
            const result = injectInterceptor(whitelistChecker);
            console.log('[FW Content] Interceptor injected at document_start');
            return result;
        } catch (error) {
            console.error('[FW Content] Early injection error:', error);
            return false;
        }
    }

    /**
     * Check if interceptor has been injected
     * @returns {boolean} True if already injected
     */
    function isInterceptorInjected() {
        return interceptorInjected;
    }

    // Expose public API
    window.FerretWatchInterceptor = {
        injectInterceptor,
        injectInterceptorEarly,
        isInterceptorInjected
    };

})();
