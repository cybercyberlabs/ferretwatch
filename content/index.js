/**
 * FerretWatch - Content Script Main Orchestrator
 *
 * This is the main entry point that coordinates all content script modules.
 * Requires all other modules to be loaded first.
 */

(function() {
    'use strict';

    // Browser API reference
    const api = (typeof browser !== 'undefined' ? browser : chrome);

    // Get constants
    const constants = window.FerretWatchConstants || {};
    const SCANNER_INIT_DELAY = constants.SCANNER_INIT_DELAY || 100;

    // Get module references
    const utils = window.FerretWatchUtils || {};
    const whitelist = window.FerretWatchWhitelist || {};
    const interceptor = window.FerretWatchInterceptor || {};
    const messages = window.FerretWatchMessages || {};
    const scanner = window.FerretWatchScanner || {};
    const notifications = window.FerretWatchNotifications || {};

    // Module functions - use utility logging functions that respect debug level
    const debugLog = utils.debugLog || (() => {});
    const infoLog = utils.infoLog || (() => {});
    const warnLog = utils.warnLog || console.warn;
    const errorLog = utils.errorLog || console.error;
    const criticalLog = utils.criticalLog || console.error;

    // Global state
    let scannerInstance = null;

    /**
     * False positive validation function
     * Exposed globally for the ProgressiveScanner
     */
    window.isValidSecret = function(match, patternConfig) {
        if (!match) return false;

        // Use the patterns from config/patterns.js
        if (window.FALSE_POSITIVE_PATTERNS) {
            for (const fpPattern of window.FALSE_POSITIVE_PATTERNS) {
                if (fpPattern.test(match)) {
                    return false; // It's a false positive
                }
            }
        }
        return true; // Likely a valid secret
    };

    /**
     * Initialize the scanner module
     */
    async function initScanner() {
        try {
            // Create scanner instance
            if (typeof ProgressiveScanner !== 'undefined') {
                scannerInstance = new ProgressiveScanner();
                scanner.setScanner(scannerInstance);

                // Initialize the scanner (load settings and run scan if not whitelisted)
                await scanner.initializeScanner();
            } else {
                console.error('[FW Content] ProgressiveScanner not available');
            }
        } catch (error) {
            console.error('[FW Content] Scanner initialization error:', error);
        }
    }

    /**
     * Early interceptor injection at document_start
     */
    async function injectInterceptorEarly() {
        try {
            debugLog('[FW Content] Early initialization at document_start');

            // Load whitelist first
            if (whitelist.loadWhitelist) {
                await whitelist.loadWhitelist();
            }

            // Check if domain is whitelisted
            if (whitelist.isDomainWhitelisted && whitelist.isDomainWhitelisted()) {
                debugLog('[FW Content] Domain is whitelisted - skipping interceptor injection');
                return;
            }

            // Inject interceptor before any page scripts can run
            if (interceptor.injectInterceptor) {
                const injected = interceptor.injectInterceptor(whitelist.isDomainWhitelisted);
                if (injected) {
                    debugLog('[FW Content] Interceptor injected at document_start');
                }
            }
        } catch (error) {
            console.error('[FW Content] Early injection error:', error);
        }
    }

    /**
     * Initialize message handlers
     */
    function initMessageHandlers() {
        // Initialize window message listener for interceptor messages
        if (messages.initializeMessageListener) {
            messages.initializeMessageListener();
        }

        // Initialize browser runtime message listener for background communication
        if (api.runtime) {
            api.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'SCAN_NOW') {
                    // Handle manual scan request from popup
                    if (scanner.runScan) {
                        scanner.runScan().then(findings => {
                            sendResponse({ success: true, findings: findings });
                        }).catch(error => {
                            sendResponse({ success: false, error: error.message });
                        });
                    } else {
                        sendResponse({ success: false, error: 'Scanner not initialized' });
                    }
                    return true; // Keep channel open for async response
                }

                if (message.action === 'GET_LAST_RESULTS') {
                    // Return last scan results
                    if (scanner.getLastScanResults) {
                        sendResponse({ success: true, results: scanner.getLastScanResults() });
                    } else {
                        sendResponse({ success: false, error: 'Scanner not initialized' });
                    }
                    return false;
                }

                if (message.action === 'RESET_SEEN_CREDENTIALS') {
                    // Reset seen credentials cache
                    if (scanner.resetSeenCredentials) {
                        scanner.resetSeenCredentials();
                    }
                    if (notifications.resetNotificationDismissed) {
                        notifications.resetNotificationDismissed();
                    }
                    sendResponse({ success: true });
                    return false;
                }

                if (message.action === 'scanUnusedEndpoints') {
                    // Handle endpoint scanning request from background
                    (async () => {
                        try {
                            // EndpointScanner is loaded in content script context
                            if (typeof EndpointScanner === 'undefined') {
                                sendResponse({
                                    success: false,
                                    error: 'EndpointScanner not loaded'
                                });
                                return;
                            }

                            debugLog('[FW Content] Starting endpoint scan...');
                            const endpointScanner = new EndpointScanner();
                            const scanResult = await endpointScanner.scanPage();
                            debugLog(`[FW Content] Scan complete: ${scanResult.total} endpoints found`);

                            sendResponse({
                                success: true,
                                discovered: scanResult.endpoints,
                                total: scanResult.total,
                                scannedAt: scanResult.scannedAt
                            });
                        } catch (error) {
                            console.error('[FW Content] Endpoint scan error:', error);
                            sendResponse({
                                success: false,
                                error: error.message
                            });
                        }
                    })();
                    return true; // Keep channel open for async response
                }
            });
        }
    }

    /**
     * Main initialization
     */
    async function initialize() {
        debugLog('[FW Content] FerretWatch Content Script initialized');

        // 1. Inject interceptor immediately (at document_start if possible)
        await injectInterceptorEarly();

        // 2. Initialize message handlers
        initMessageHandlers();

        // 3. Initialize scanner when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initScanner);
        } else {
            // DOM already loaded, delay slightly to ensure page is ready
            setTimeout(initScanner, SCANNER_INIT_DELAY);
        }
    }

    // Expose scanner instance globally for backward compatibility
    Object.defineProperty(window, 'scanner', {
        get: function() {
            return scannerInstance;
        },
        set: function(value) {
            scannerInstance = value;
            if (scanner.setScanner) {
                scanner.setScanner(value);
            }
        }
    });

    // Start initialization
    initialize();

})();
