/**
 * FerretWatch - Scanner Manager Module
 *
 * Handles scanner initialization, settings, and execution
 * Exposes: window.FerretWatchScanner
 */

(function() {
    'use strict';

    // Get browser API reference
    const api = (typeof browser !== 'undefined' ? browser : chrome);

    // Get utilities
    const utils = window.FerretWatchUtils || {};
    const debugLog = utils.debugLog || function() {};

    // Get whitelist checker
    const whitelistChecker = window.FerretWatchWhitelist || {};
    const isDomainWhitelisted = whitelistChecker.isDomainWhitelisted || function() { return false; };
    const isTemporarilyPaused = whitelistChecker.isTemporarilyPaused || function() { return false; };
    const getCurrentDomain = whitelistChecker.getCurrentDomain || function() { return window.location.hostname; };

    // Get notification system
    const notifications = window.FerretWatchNotifications || {};
    const showBucketNotification = notifications.showBucketNotification;
    const showRegularNotification = notifications.showRegularNotification;

    // Settings cache for synchronous access
    let settingsCache = {
        maxFindings: 50,
        scanningMode: 'progressive',
        scanDelay: 500,
        enableDebounce: true,
        enabledCategories: {
            aws: true,
            github: true,
            slack: true,
            discord: true,
            apiKeys: true,
            azure: true,
            gcp: true,
            jwt: true,
            services: true,
            passwords: true,
            keys_and_certificates: true,
            database: true,
            environment: true
        },
        cloudBucketScanning: {
            enabled: true,
            providers: {
                aws: true,
                gcp: true,
                azure: true,
                digitalocean: true,
                alibaba: true
            },
            testTimeout: 5000,
            maxConcurrentTests: 3,
            testPublicAccess: true
        }
    };

    // Scanner state
    let scanner = null;
    let documentContext = null;
    let activeScans = 0;
    let lastScanResults = [];
    let lastScanState = 'pending';
    let seenCredentials = new Set();
    const dismissedIds = new Set();
    let alertTimer = null;
    let alertBurst = [];
    let alertGeneration = null;
    const knownFindings = [];

    /**
     * Load settings from storage into cache
     */
    async function loadSettings() {
        try {
            if (!api.storage) {
                debugLog('Storage API not available');
                return;
            }

            const storage = storageUtils();
            if (storage && storage.ensureSettings) {
                const unified = await storage.ensureSettings();
                settingsCache = { ...settingsCache, ...unified };
            }
            debugLog('Settings loaded:', settingsCache);
        } catch (error) {
            debugLog('Failed to load settings:', error);
        }
    }

    /**
     * Get a setting value from cache
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Setting value
     */
    function getSetting(key, defaultValue) {
        return settingsCache[key] !== undefined ? settingsCache[key] : defaultValue;
    }

    /**
     * Process scan findings and display notifications
     * @param {Array} findings - Array of findings from scanner
     */
    function processFindings(findings) {
        // Store for export
        lastScanResults = findings.map(finding => ({
            ...finding,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            domain: window.location.hostname
        }));

        // Update the global window reference
        window.lastScanResults = lastScanResults;

        if (findings.length === 0) {
            debugLog("✅ No security issues found on this page.");
            return;
        }

        const newFindings = findings.filter(f => {
            const key = `${f.type}:${f.value}`;
            if (seenCredentials.has(key)) {
                return false;
            }
            seenCredentials.add(key);
            return true;
        });

        if (newFindings.length > 0) {
            const counts = { critical: 0, high: 0, medium: 0, low: 0 };
            newFindings.forEach((finding) => {
                const level = Object.prototype.hasOwnProperty.call(counts, finding.riskLevel) ? finding.riskLevel : 'low';
                counts[level] += 1;
            });
            const parts = ['critical', 'high', 'medium', 'low']
                .filter((level) => counts[level] > 0)
                .map((level) => `${counts[level]} ${level}`);
            const noun = newFindings.length === 1 ? 'issue' : 'issues';
            const summary = `Found ${newFindings.length} ${noun} on ${window.location.hostname}: ${parts.join(', ')}`;
            if (counts.critical || counts.high || counts.medium) {
                console.warn(`FerretWatch 🚨 SECURITY ALERT: ${summary}`);
            } else {
                console.log(`FerretWatch ℹ️ ${summary}`);
            }
            newFindings.forEach((finding) => {
                const riskEmoji = {
                    critical: '🔥',
                    high: '🚨',
                    medium: '⚠️',
                    low: 'ℹ️'
                }[finding.riskLevel] || '❓';
                if (finding.bucketInfo) {
                    const accessStatus = finding.accessStatus || finding.bucketInfo.accessStatus || 'untested';
                    console.warn(`FerretWatch ${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${finding.value} (${accessStatus})`);
                } else {
                    console.warn(`FerretWatch ${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${finding.value}`);
                }
            });
        }

        // One popup for every finding on the page. A later smaller scan must not
        // replace the set already discovered in this document.
        rememberFindings(findings);
        if (newFindings.length === 0) {
            debugLog("Same findings detected (notification already shown)");
            return;
        }
        newFindings.forEach((finding) => {
            const key = `${finding.type}:${finding.value}`;
            if (!alertBurst.some((existing) => `${existing.type}:${existing.value}` === key)) {
                alertBurst.push(finding);
            }
        });
        clearTimeout(alertTimer);
        alertTimer = setTimeout(showCoalescedAlert, 700);
    }

    function findingKey(finding) {
        return `${finding.type}:${finding.value}`;
    }

    function rememberFindings(findings) {
        (findings || []).forEach((finding) => {
            if (!finding || finding.value == null) return;
            const key = findingKey(finding);
            if (!knownFindings.some((existing) => findingKey(existing) === key)) {
                knownFindings.push(finding);
            }
        });
    }

    /**
     * Run a security scan on the current page
     * @returns {Promise<Array>} Array of findings
     */
    function collectPatterns() {
        const allPatterns = [];
        if (window.SECURITY_PATTERNS) {
            for (const category in window.SECURITY_PATTERNS) {
                for (const key in window.SECURITY_PATTERNS[category]) {
                    const patternConfig = window.SECURITY_PATTERNS[category][key];
                    if (patternConfig.pattern) {
                        allPatterns.push({
                            id: key,
                            regex: patternConfig.pattern,
                            type: patternConfig.description,
                            risk: patternConfig.riskLevel,
                            riskLevel: patternConfig.riskLevel,
                            category: patternConfig.category || category,
                            provider: patternConfig.provider,
                            excludePattern: patternConfig.excludePattern
                        });
                    }
                }
            }
        }
        if (window.patternManager && typeof window.patternManager.getAllPatterns === 'function') {
            return window.patternManager.getAllPatterns();
        }
        return allPatterns;
    }

    function showCoalescedAlert() {
        alertTimer = null;
        const fresh = alertBurst.splice(0);
        if (notifications.isNotificationDismissed && notifications.isNotificationDismissed()) return;
        if (!fresh.length || !knownFindings.length || !showRegularNotification) return;
        showRegularNotification(knownFindings.slice(), fresh);
        api.runtime.sendMessage({
            type: 'SHOW_PAGE_ALERT',
            count: knownFindings.length
        }).catch(() => {});
    }

    function setDocumentContext(context) {
        if (context && context.generation !== alertGeneration) {
            alertGeneration = context.generation;
            if (notifications.resetNotificationDismissed) notifications.resetNotificationDismissed();
        }
        documentContext = context;
        lastScanResults = [];
        lastScanState = 'pending';
        window.lastScanResults = [];
        seenCredentials.clear();
        alertBurst = [];
        knownFindings.splice(0);
        clearTimeout(alertTimer);
        alertTimer = null;
    }

    function storageUtils() {
        return globalThis.StorageUtils || window.StorageUtils || null;
    }

    function canScan() {
        const storage = storageUtils();
        const scanning = storage ? storage.getSetting('diagnostics', {}).scanning : true;
        return documentContext && !isDomainWhitelisted() && !isTemporarilyPaused() && scanning !== false;
    }

    async function reportScan(findings, state, context) {
        if (context !== documentContext) return { state: 'unavailable', findings: [] };
        try {
            const report = await api.runtime.sendMessage({ type: 'SCAN_REPORT', data: {
                pageUrl: window.location.href, findings, state, context
            }});
            if (context !== documentContext || !report?.accepted) {
                return { state: report?.state || 'unavailable', findings: [] };
            }
            lastScanState = report.state;
            // The background owns merging and dismissal, including network findings.
            processFindings(report.findings);
            return { state: lastScanState, findings: lastScanResults };
        } catch (error) {
            lastScanState = 'failed';
            return { state: 'failed', findings: [], error: error.message };
        }
    }

    async function scanText(text, options = {}) {
        const context = documentContext;
        if (!canScan()) {
            lastScanState = 'skipped';
            return { state: 'skipped', findings: [] };
        }
        if (!scanner) return { state: 'failed', findings: [], error: 'Scanner not initialized' };
        const limits = (globalThis.FerretWatchContracts || window.FerretWatchContracts || {}).CAPTURE_LIMITS;
        if (limits && activeScans >= limits.pendingScans) {
            return reportScan([], 'truncated', context);
        }
        activeScans += 1;
        try {
            // Scan state is per operation; DOM mutations and manual scans may overlap.
            const operation = new ProgressiveScanner();
            const findings = await operation.progressiveScan(text, collectPatterns(), {
                sourceUrl: window.location.href, sourceKind: 'dom', skipBucketProbes: true, ...options
            });
            // Remember this scan's own matches before the background echoes a
            // possibly smaller merged list.
            rememberFindings(findings);
            return await reportScan(findings,
                options.truncated ? 'truncated' : (operation.lastScanState || 'success'), context);
        } catch (error) {
            return reportScan([], 'failed', context);
        } finally { activeScans -= 1; }
    }

    async function runScan() {
        return scanText(document.documentElement ? document.documentElement.innerHTML : '');
    }

    async function runScanText(text, options) {
        return scanText(text, options);
    }

    function dismissFinding(idOrValue) {
        lastScanResults.forEach((finding) => {
            if (finding.id === idOrValue || finding.value === idOrValue) {
                dismissedIds.add(finding.id || finding.value);
            }
        });
        lastScanResults = lastScanResults.filter((finding) => !dismissedIds.has(finding.id) && finding.value !== idOrValue);
        window.lastScanResults = lastScanResults;
    }

    /**
     * Initialize the scanner
     * @returns {Promise<void>}
     */
    async function initializeScanner() {
        try {
            const currentDomain = getCurrentDomain();
            debugLog('[FW Content] Initializing FerretWatch scanner on domain:', currentDomain);

            await loadSettings(); // Load settings into cache

            if (isDomainWhitelisted() || isTemporarilyPaused()) {
                debugLog('[FW Content] FerretWatch disabled for this domain:', currentDomain);
                lastScanState = 'skipped';
                lastScanResults = [];
                return;
            }

            debugLog('[FW Content] FerretWatch starting scan on:', currentDomain);
            debugLog('FerretWatch Auto-scanning for credentials...');

            await runScan();

        } catch (error) {
            console.error('[FW Content] Initialization error:', error);
        }
    }

    /**
     * Set the scanner instance
     * @param {Object} scannerInstance - The ProgressiveScanner instance
     */
    function setScanner(scannerInstance) {
        scanner = scannerInstance;
    }

    /**
     * Get the scanner instance
     * @returns {Object} The scanner instance
     */
    function getScanner() {
        return scanner;
    }

    /**
     * Get the last scan results
     * @returns {Array} Array of findings from last scan
     */
    function getLastScanResults() {
        return lastScanResults;
    }

    /**
     * Reset seen credentials cache
     */
    function resetSeenCredentials() {
        seenCredentials.clear();
    }

    // Expose public API
    window.FerretWatchScanner = {
        initializeScanner,
        runScan,
        loadSettings,
        getSetting,
        processFindings,
        setScanner,
        setDocumentContext,
        getDocumentContext: () => documentContext,
        getScanner,
        getLastScanResults,
        getLastScanState: function() { return lastScanState; },
        resetSeenCredentials,
        runScanText,
        dismissFinding
    };

    // Note: StorageUtils is provided by utils/storage.js which is loaded before this script

})();
