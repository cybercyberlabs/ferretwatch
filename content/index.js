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
    let domObserver = null;
    let policyRevision = 0;
    let monitoringStopped = false;

    function contracts() {
        return window.FerretWatchContracts || null;
    }

    function currentPageUrl() {
        return window.location.href;
    }

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

            if (window.StorageUtils && window.StorageUtils.ensureSettings) {
                await window.StorageUtils.ensureSettings();
            }

            // Load whitelist first
            if (whitelist.loadWhitelist) {
                await whitelist.loadWhitelist();
            }

            // Check if domain is whitelisted
            if (whitelist.isDomainWhitelisted && whitelist.isDomainWhitelisted()) {
                debugLog('[FW Content] Domain is whitelisted - skipping interceptor injection');
                return;
            }

            const diagnostics = window.StorageUtils && window.StorageUtils.getSetting
                ? window.StorageUtils.getSetting('diagnostics', {})
                : {};
            if (!diagnostics || diagnostics.pageInterceptor !== true) {
                debugLog('[FW Content] Page interceptor disabled; monitoring uses webRequest');
                return;
            }

            // Diagnostic-only page wrapper. Normal monitoring does not inject it.
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
                const name = (contracts() && contracts().messageName(message)) || message.action || message.type;

                if (name === 'RESCAN' || name === 'SCAN_NOW' || name === 'rescan') {
                    if (scanner.runScan) {
                        scanner.runScan().then(result => {
                            const findings = Array.isArray(result) ? result : (result && result.findings) || [];
                            const state = (result && result.state) || (scanner.getLastScanState && scanner.getLastScanState()) || 'success';
                            sendResponse({ success: state === 'success' || state === 'truncated', state, findings });
                        }).catch(error => {
                            sendResponse({ success: false, state: 'failed', findings: [], error: error.message });
                        });
                    } else {
                        sendResponse({ success: false, state: 'failed', findings: [], error: 'Scanner not initialized' });
                    }
                    return true;
                }

                if (name === 'GET_FINDINGS' || name === 'GET_LAST_RESULTS' || name === 'getCurrentFindings') {
                    if (scanner.getLastScanResults) {
                        const findings = scanner.getLastScanResults() || [];
                        const state = scanner.getLastScanState ? scanner.getLastScanState() : (findings.length ? 'success' : 'pending');
                        sendResponse({ success: true, state, findings, results: findings });
                    } else {
                        sendResponse({ success: false, state: 'unavailable', findings: [], error: 'Scanner not initialized' });
                    }
                    return false;
                }

                if (name === 'DISMISS_FINDING' || name === 'dismissFinding') {
                    if (scanner.dismissFinding) {
                        scanner.dismissFinding(message.id || message.value);
                    }
                    sendResponse({ success: true, state: 'success' });
                    return false;
                }

                if (name === 'SETTINGS_UPDATED') {
                    refreshPolicy(message);
                    sendResponse({ success: true });
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

        // Register immediately at document_start; later async scans keep this token.
        const registration = api.runtime.sendMessage({ type: 'REGISTER_DOCUMENT' });
        initMessageHandlers();
        scanner.setDocumentContext(await registration);
        await injectInterceptorEarly();

        // 3. Initialize scanner when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initScanner().then(startDomObserver);
            });
        } else {
            setTimeout(() => {
                initScanner().then(startDomObserver);
            }, SCANNER_INIT_DELAY);
        }
    }

    async function refreshPolicy(message) {
        const previous = scanner.getDocumentContext();
        // A settings broadcast may race navigation while the old page still exists.
        if (previous && previous.generation !== message.context?.generation) return;
        if (previous && previous.policyVersion > message.context?.policyVersion) return;
        const revision = ++policyRevision;
        if (domObserver) { domObserver.stop(); domObserver = null; }
        scanner.setDocumentContext(null); // Invalidate in-flight scans immediately.
        window.StorageUtils.applySettings(message.data);
        if (whitelist.loadWhitelist) await whitelist.loadWhitelist();
        if (revision !== policyRevision) return;
        scanner.setDocumentContext(message.context);
        applyMonitoringPolicy();
        if (!monitoringStopped && scannerInstance) await scanner.runScan();
    }

    function applyMonitoringPolicy() {
        monitoringStopped = (whitelist.isDomainWhitelisted && whitelist.isDomainWhitelisted()) ||
            window.StorageUtils.getSetting('diagnostics', {}).scanning === false;
        if (monitoringStopped) {
            if (domObserver) { domObserver.stop(); domObserver = null; }
            return;
        }
        startDomObserver();
    }

    function startDomObserver() {
        if (monitoringStopped || domObserver || !document.documentElement || !scannerInstance) return;
        if (whitelist.isDomainWhitelisted?.() || window.StorageUtils.getSetting('diagnostics', {}).scanning === false) return;
        domObserver = new window.FerretWatchDomMonitor(
            (text, options) => scanner.runScanText(text, options), document.documentElement);
    }

    window.addEventListener('pagehide', () => {
        monitoringStopped = true;
        scanner.setDocumentContext(null);
        if (domObserver) { domObserver.stop(); domObserver = null; }
    });
    window.addEventListener('pageshow', async event => {
        if (!event.persisted) return;
        scanner.setDocumentContext(await api.runtime.sendMessage({ type: 'REGISTER_DOCUMENT' }));
        await window.StorageUtils.ensureSettings();
        await whitelist.loadWhitelist();
        applyMonitoringPolicy();
        if (!monitoringStopped) await scanner.runScan();
    });

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
