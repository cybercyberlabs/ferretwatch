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
        console.log(`[FW Content] API call received from interceptor: ${apiCall.method} ${apiCall.url}`);
        debugLog(`[Content] API call captured: ${apiCall.method} ${apiCall.url}`);

        const message = {
            type: 'API_CALL_CAPTURED',
            data: apiCall
        };

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(message)
                .then(() => {
                    console.log('[FW Content] Message sent to background successfully');
                })
                .catch(err => {
                    console.error('[FW Content] Error sending to background:', err);
                });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
            browser.runtime.sendMessage(message)
                .then(() => {
                    console.log('[FW Content] Message sent to background successfully');
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
        console.log(`[FW Content] API response received from interceptor: ${apiResponse.status} ${apiResponse.method} ${apiResponse.url}`);
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
                    console.log('[FW Content] Response sent to background successfully');
                }
            });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
            browser.runtime.sendMessage(message)
                .then(() => {
                    console.log('[FW Content] Response sent to background successfully');
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
        console.log('[FW Content] Message listener registered for window.postMessage');
    }

    /**
     * Remove message listener
     */
    function removeMessageListener() {
        window.removeEventListener('message', handleWindowMessage);
        console.log('[FW Content] Message listener removed');
    }

    // Expose public API
    window.FerretWatchMessages = {
        initializeMessageListener,
        removeMessageListener,
        sendApiCallToBackground,
        sendApiResponseToBackground
    };

})();
