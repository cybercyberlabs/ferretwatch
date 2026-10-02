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
    let lastScanResults = [];
    let lastScanState = 'pending';
    let seenCredentials = new Set();
    const dismissedIds = new Set();

    function maskValue(value) {
        const lib = window.FerretWatchContracts;
        return lib ? lib.maskSecret(value) : '••••';
    }

    /**
     * Load settings from storage into cache
     */
    async function loadSettings() {
        try {
            if (!api.storage) {
                debugLog('Storage API not available');
                return;
            }

            if (window.StorageUtils && window.StorageUtils.ensureSettings) {
                const unified = await window.StorageUtils.ensureSettings();
                settingsCache = { ...settingsCache, ...unified };
            }
            const result = await api.storage.local.get(['settings', 'debugMode']);
            if (result.settings) {
                settingsCache = { ...settingsCache, ...result.settings };
            }
            // Load debug mode setting separately
            if (result.debugMode !== undefined) {
                settingsCache.debugMode = result.debugMode;
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
            // Only log "no issues" in debug mode to avoid console spam on clean pages
            debugLog("✅ No security issues found on this page.");
            return;
        }

        // Separate bucket findings from regular findings
        const bucketFindings = findings.filter(f => f.bucketInfo);
        const regularFindings = findings.filter(f => !f.bucketInfo);

        // Summary log for normal mode with actual findings
        const criticalCount = findings.filter(f => f.riskLevel === 'critical').length;
        const highCount = findings.filter(f => f.riskLevel === 'high').length;
        const mediumCount = findings.filter(f => f.riskLevel === 'medium').length;

        // Show summary with counts (ALWAYS shown - not conditional on debugMode)
        if (criticalCount > 0 || highCount > 0) {
            console.warn(`🚨 SECURITY ALERT: Found ${criticalCount + highCount} high-risk issue(s) on ${window.location.hostname}`);
        } else if (mediumCount > 0) {
            console.warn(`⚠️ Found ${mediumCount} medium-risk issue(s) on ${window.location.hostname}`);
        } else {
            console.log(`ℹ️ Found ${findings.length} low-risk issue(s) on ${window.location.hostname}`);
        }

        // Show actual findings (ALWAYS visible for important discoveries)
        const importantFindings = findings.filter(f => ['critical', 'high', 'medium'].includes(f.riskLevel));
        importantFindings.forEach((finding, index) => {
            const riskEmoji = {
                critical: '🔥',
                high: '🚨',
                medium: '⚠️',
                low: 'ℹ️'
            }[finding.riskLevel] || '❓';

            if (finding.bucketInfo) {
                const accessStatus = finding.accessStatus || finding.bucketInfo.accessStatus || 'untested';
                console.warn(`${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${maskValue(finding.value)} (${accessStatus})`);
            } else {
                console.warn(`${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${maskValue(finding.value)}`);
            }
        });

        // Detect new credentials (credentials not seen before)
        const newFindings = findings.filter(f => {
            const key = `${f.type}:${f.value}`;
            if (seenCredentials.has(key)) {
                return false;
            } else {
                seenCredentials.add(key);
                return true;
            }
        });

        // Filter out low-risk findings from notifications (but keep in console)
        const notifiableNewFindings = newFindings.filter(f => (f.riskLevel || 'medium') !== 'low');
        const notifiableAllFindings = findings.filter(f => (f.riskLevel || 'medium') !== 'low');

        if (notifiableNewFindings.length > 0 || notifiableAllFindings.length > 0) {
            const newBucketFindings = notifiableNewFindings.filter(f => f.bucketInfo);
            const newRegularFindings = notifiableNewFindings.filter(f => !f.bucketInfo);
            const allBucketFindings = notifiableAllFindings.filter(f => f.bucketInfo);
            const allRegularFindings = notifiableAllFindings.filter(f => !f.bucketInfo);

            // Show bucket notification if there are bucket findings
            if (allBucketFindings.length > 0 && showBucketNotification) {
                showBucketNotification(allBucketFindings, newBucketFindings);
            }
            if (allRegularFindings.length > 0 && showRegularNotification) {
                showRegularNotification(allRegularFindings, newRegularFindings);
            }
        } else {
            debugLog("Same findings detected (notification dismissed - check console for details)");
        }

        // Log info about low-risk findings that are excluded from popup
        const lowRiskNewFindings = newFindings.filter(f => (f.riskLevel || 'medium') === 'low');
        if (lowRiskNewFindings.length > 0) {
            debugLog(`${lowRiskNewFindings.length} low-risk finding(s) detected (informational only - not shown in popup)`);
        }
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

    function reportScan(findings, state) {
        const visible = findings.filter((finding) => !dismissedIds.has(finding.id));
        lastScanResults = visible;
        lastScanState = state;
        window.lastScanResults = visible;
        if (!api.runtime) {
            return;
        }
        api.runtime.sendMessage({
            type: 'SCAN_REPORT',
            data: {
                pageUrl: window.location.href,
                findings,
                state
            }
        }).catch(() => {});
    }

    async function runScan() {
        if (isDomainWhitelisted()) {
            lastScanState = 'skipped';
            lastScanResults = [];
            reportScan([], 'skipped');
            return { state: 'skipped', findings: [] };
        }
        if (!scanner) {
            console.error('[FW Scanner] Scanner not initialized');
            lastScanState = 'failed';
            return { state: 'failed', findings: [], error: 'Scanner not initialized' };
        }

        const allPatterns = collectPatterns();
        const content = document.documentElement ? document.documentElement.innerHTML : '';
        let findings = [];
        try {
            findings = await scanner.progressiveScan(content, allPatterns, {
                sourceUrl: window.location.href
            });
            lastScanState = scanner.lastScanState || 'success';
        } catch (error) {
            lastScanState = 'failed';
            return { state: 'failed', findings: [], error: error.message };
        }

        processFindings(findings);
        reportScan(findings, lastScanState);
        return { state: lastScanState, findings: lastScanResults };
    }

    async function runScanText(text, options) {
        if (isDomainWhitelisted() || !scanner || !text) {
            return { state: 'skipped', findings: [] };
        }
        const findings = await scanner.progressiveScan(text, collectPatterns(), {
            sourceKind: (options && options.sourceKind) || 'dom',
            sourceUrl: (options && options.sourceUrl) || window.location.href,
            skipBucketProbes: true
        });
        const state = scanner.lastScanState || 'success';
        if (findings.length) {
            processFindings(findings);
            const merged = dedupeFindings(lastScanResults.concat(findings));
            reportScan(merged, state);
        }
        return { state, findings };
    }

    function dedupeFindings(findings) {
        const seen = new Set();
        const unique = [];
        findings.forEach((finding) => {
            const key = finding.id || ((finding.type || '') + finding.value);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(finding);
            }
        });
        return unique;
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

            if (isDomainWhitelisted()) {
                debugLog('[FW Content] FerretWatch disabled for whitelisted domain:', currentDomain);
                lastScanState = 'skipped';
                reportScan([], 'skipped');
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
        getScanner,
        getLastScanResults,
        getLastScanState: function() { return lastScanState; },
        resetSeenCredentials,
        runScanText,
        dismissFinding
    };

    // Note: StorageUtils is provided by utils/storage.js which is loaded before this script

})();
