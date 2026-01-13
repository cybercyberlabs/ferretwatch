/**
 * Message Handler for FerretWatch
 * Handles communication between interceptor, content script, and background script
 */

(function() {
    'use strict';

    // Browser API reference
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // Message types
    const MESSAGE_TYPES = {
        API_CALL: 'FERRETWATCH_API_CALL',
        API_RESPONSE: 'FERRETWATCH_API_RESPONSE'
    };

    /**
     * Log debug message
     */
    function debugLog(message) {
        if (window.debugLog) {
            window.debugLog(message);
        }
    }

    /**
     * Send API call data to background script
     * @param {Object} apiCall - API call data from interceptor
     */
    function sendApiCallToBackground(apiCall) {
        // Removed verbose logging - use debugLog for detailed API tracking
        debugLog(`[Content] API call captured: ${apiCall.method} ${apiCall.url}`);

        const message = {
            type: 'API_CALL_CAPTURED',
            data: apiCall
        };

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(message)
                .then(() => {
                    // Success - no logging needed at info level
                })
                .catch(err => {
                    console.error('[FW Content] Error sending to background:', err);
                });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
            browser.runtime.sendMessage(message)
                .then(() => {
                    // Success - no logging needed at info level
                })
                .catch(err => {
                    console.error('[FW Content] Error sending to background:', err);
                });
        }
    }

    /**
     * Send API response data to background script
     * @param {Object} apiResponse - API response data from interceptor
     */
    function sendApiResponseToBackground(apiResponse) {
        // Removed verbose logging - use debugLog for detailed API tracking
        debugLog(`[Content] API response captured: ${apiResponse.status} ${apiResponse.method} ${apiResponse.url}`);

        const message = {
            type: 'API_RESPONSE_CAPTURED',
            data: apiResponse
        };

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    console.error('[FW Content] Error sending response to background:', chrome.runtime.lastError);
                } else {
                    // Success - no logging needed at info level
                }
            });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
            browser.runtime.sendMessage(message)
                .then(() => {
                    // Success - no logging needed at info level
                })
                .catch(err => {
                    console.error('[FW Content] Error sending response to background:', err);
                });
        }
    }

    /**
     * Handle window.postMessage events from interceptor
     * @param {MessageEvent} event - The message event
     */
    function handleWindowMessage(event) {
        // Only accept messages from same window
        if (event.source !== window) return;

        // Handle API call (request)
        if (event.data && event.data.type === MESSAGE_TYPES.API_CALL) {
            sendApiCallToBackground(event.data.data);
        }

        // Handle API response
        if (event.data && event.data.type === MESSAGE_TYPES.API_RESPONSE) {
            sendApiResponseToBackground(event.data.data);
        }
    }

    /**
     * Initialize message listener for interceptor events
     */
    function initializeMessageListener() {
        window.addEventListener('message', handleWindowMessage);
        debugLog('[FW Content] Message listener registered for window.postMessage');
    }

    /**
     * Remove message listener
     */
    function removeMessageListener() {
        window.removeEventListener('message', handleWindowMessage);
        debugLog('[FW Content] Message listener removed');
    }

    // Expose public API
    window.FerretWatchMessages = {
        initializeMessageListener,
        removeMessageListener,
        sendApiCallToBackground,
        sendApiResponseToBackground
    };

})();
