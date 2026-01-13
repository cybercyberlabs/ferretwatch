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
    let seenCredentials = new Set();

    /**
     * Load settings from storage into cache
     */
    async function loadSettings() {
        try {
            if (!api.storage) {
                debugLog('Storage API not available');
                return;
            }

            const result = await api.storage.local.get(['userSettings', 'debugMode']);
            if (result.userSettings) {
                settingsCache = { ...settingsCache, ...result.userSettings };
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
                // Bucket finding
                const accessStatus = finding.bucketInfo.testResults?.listingEnabled ? 'PUBLIC LISTING' :
                    finding.bucketInfo.testResults?.accessible ? 'ACCESSIBLE' : 'SECURED';
                console.warn(`${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${finding.value} (${accessStatus})`);
            } else {
                // Regular finding
                console.warn(`${riskEmoji} [${finding.riskLevel?.toUpperCase()}] ${finding.type}: ${finding.value}`);
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
            // Show regular notification if there are regular findings
            else if (allRegularFindings.length > 0 && showRegularNotification) {
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
    async function runScan() {
        if (!scanner) {
            console.error('[FW Scanner] Scanner not initialized');
            return [];
        }

        // 1. Get patterns from the global scope (loaded from config/patterns.js)
        const allPatterns = [];
        if (window.SECURITY_PATTERNS) {
            for (const category in window.SECURITY_PATTERNS) {
                for (const key in window.SECURITY_PATTERNS[category]) {
                    const patternConfig = window.SECURITY_PATTERNS[category][key];
                    if (patternConfig.pattern) {
                        allPatterns.push({
                            regex: patternConfig.pattern,
                            type: patternConfig.description,
                            risk: patternConfig.riskLevel,
                            riskLevel: patternConfig.riskLevel, // Add this for consistency
                            category: patternConfig.category || category, // Use pattern's category if specified
                            provider: patternConfig.provider
                        });
                    }
                }
            }
        }

        // 2. Run the scan using the ProgressiveScanner
        const content = document.documentElement.innerHTML;
        let findings = await scanner.progressiveScan(content, allPatterns);

        // 3. Run bucket scanning if enabled and bucket findings exist
        if (scanner.isBucketScanningEnabled && typeof scanner.isBucketScanningEnabled === 'function' && scanner.isBucketScanningEnabled()) {
            try {
                const bucketFindings = await scanner.scanCloudBuckets(findings);
                if (bucketFindings && bucketFindings.length > 0) {
                    // Replace original bucket findings with enhanced ones
                    const nonBucketFindings = findings.filter(f => !f.category || f.category !== 'cloudStorage');
                    findings = [...nonBucketFindings, ...bucketFindings];
                }
            } catch (error) {
                debugLog('Bucket scanning failed:', error);
            }
        }

        // 4. Process the results
        processFindings(findings);
        return findings;
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
        resetSeenCredentials
    };

    // Note: StorageUtils is provided by utils/storage.js which is loaded before this script

})();
