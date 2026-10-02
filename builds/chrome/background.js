/**
 * Background Service Worker for Chrome Manifest V3
 * Handles cross-tab communication, storage, and notifications
 */

// Firefox loads these as background scripts. Chrome's MV3 worker loads background.js alone.
try {
    if (typeof importScripts === 'function' && typeof FerretWatchContracts === 'undefined') {
        importScripts(
            'utils/contracts.js',
            'config/patterns.js',
            'utils/context.js',
            'utils/scanner.js'
        );
    }
} catch (error) {
    console.error('Failed to import background dependencies:', error);
}

class BackgroundService {
    constructor() {
        this.tabResults = new Map();
        this.apiEndpoints = new Map(); // Store API endpoints per tab
        this.settings = null;
        this.requestHeadersCache = new Map(); // Cache for capturing full headers including cookies
        this.debugMode = false; // Will be loaded from settings
        this.findingStore = new FerretWatchContracts.FindingStore();
        this.requestLog = new FerretWatchContracts.RequestLog();
        this.captureBudgets = new Map();
        this.pageUrls = new Map();
        this.responseScanner = null;
        this.pendingScans = 0;

        this.init();
    }

    /**
     * Debug logging - only logs when debugMode is enabled
     */
    debugLog(message, ...args) {
        if (this.debugMode) {
            console.log(message, ...args);
        }
    }

    init() {
// debugLog('🔧 Background service worker initializing...');

        // Set up listeners immediately (Synchronous)
        this.setupMessageListeners();
        this.setupStorageListeners();
        this.setupTabListeners();
        this.installResponseMonitor();

        // Load settings (Async)
        this.loadSettings().then(() => {
// debugLog('✅ Background service worker ready');
        });
    }


    async loadSettings() {
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            const result = await api.storage.local.get(['settings', 'userSettings', 'whitelistedDomains', 'debugMode']);
            this.settings = FerretWatchContracts.migrateStoredSettings(result);
            this.debugMode = !!this.settings.debugMode;
            if (!result.settings) {
                await api.storage.local.set({ settings: this.settings });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = this.getDefaultSettings();
            this.debugMode = false;
        }
    }

    getDefaultSettings() {
        return FerretWatchContracts.defaultSettings();
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }




    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'SCAN_COMPLETE':
                case 'SCAN_REPORT':
                    sendResponse(await this.handleScanReport(message.data, sender.tab?.id));
                    break;

                case 'GET_FINDINGS':
                case 'EXPORT_FINDINGS': {
                    const tabId = message.tabId || sender.tab?.id;
                    sendResponse({
                        state: this.findingStore.state(tabId),
                        findings: this.findingStore.list(tabId, false),
                        exportFindings: this.findingStore.list(tabId, true)
                    });
                    break;
                }

                case 'DISMISS_FINDING': {
                    const tabId = message.tabId || sender.tab?.id;
                    const dismissed = this.findingStore.dismiss(tabId, message.id);
                    const active = this.findingStore.list(tabId, false);
                    await this.updateBadge(tabId, active.length);
                    sendResponse({ success: dismissed, state: this.findingStore.state(tabId), findings: active });
                    break;
                }

                case 'GET_SETTINGS':
                    sendResponse({ settings: this.settings });
                    break;

                case 'UPDATE_SETTINGS':
                    await this.updateSettings(message.data);
                    sendResponse({ success: true });
                    break;

                case 'GET_TAB_RESULTS': {
                    const tabId = message.tabId || sender.tab?.id;
                    const results = this.findingStore.list(tabId, false);
                    sendResponse({ results, state: this.findingStore.state(tabId) });
                    break;
                }

                case 'CLEAR_TAB_RESULTS':
                    this.tabResults.delete(sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'EXPORT_SESSION_DATA':
                    const sessionData = await this.getSessionData();
                    sendResponse({ data: sessionData });
                    break;

                case 'SHOW_NOTIFICATION':
                    await this.showNotification(message.data);
                    sendResponse({ success: true });
                    break;

                case 'API_CALL_CAPTURED':
                    this.handleApiCall(message.data, sender.tab?.id, sender.tab?.url);
                    sendResponse({ success: true });
                    break;

                case 'API_RESPONSE_CAPTURED':
                    this.handleApiResponse(message.data, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'REPLAY_REQUEST':
                    this.replayRequest(message.data).then(sendResponse);
                    return true;

                case 'PROXY_REQUEST':
                    // Must return true to keep channel open for async fetch
                    this.handleProxyRequest(message.data, message.tabId).then(sendResponse);
                    return true;


                case 'GET_API_ENDPOINTS':
                    const endpoints = this.apiEndpoints.get(message.tabId) || [];
                    sendResponse({ endpoints });
                    break;

                case 'CLEAR_API_ENDPOINTS':
                    this.apiEndpoints.set(message.tabId, []);
                    sendResponse({ success: true });
                    break;

                case 'SCAN_UNUSED_ENDPOINTS':
                    this.handleUnusedEndpointScan(message.tabId, sender.tab?.id).then(sendResponse);
                    return true;

                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async handleScanReport(scanData, tabId) {
        if (!tabId || !scanData) {
            return { accepted: false, state: 'unavailable', findings: [] };
        }
        const currentUrl = this.pageUrls.get(tabId);
        if (scanData.pageUrl && currentUrl && scanData.pageUrl !== currentUrl) {
            return { accepted: false, reason: 'stale', state: this.findingStore.state(tabId), findings: this.findingStore.list(tabId, false) };
        }
        const generation = this.findingStore.generation(tabId);
        const report = this.findingStore.report(tabId, generation, scanData.findings || [], scanData.state || 'success');
        this.tabResults.set(tabId, report.findings);
        if (report.accepted && this.settings && (this.settings.enableNotifications || this.settings.showNotifications)) {
            const fresh = (scanData.findings || []).filter((finding) => report.added.includes(finding.id || FerretWatchContracts.findingId(finding)));
            const credentials = fresh.filter((finding) => finding.category !== 'cloudStorage' && (finding.riskLevel === 'critical' || finding.riskLevel === 'high'));
            if (credentials.length > 0) {
                await this.showNotification({
                    type: 'credential_detected',
                    title: 'Credentials detected',
                    message: `Found ${credentials.length} high-risk credential(s)`,
                    findings: credentials
                });
            }
        }
        await this.updateBadge(tabId, report.findings.length);
        return report;
    }

    async handleScanComplete(scanData, tabId) {
        return this.handleScanReport(scanData, tabId);
    }

    budgetFor(tabId) {
        if (!this.captureBudgets.has(tabId)) {
            this.captureBudgets.set(tabId, new FerretWatchContracts.CaptureBudget());
        }
        return this.captureBudgets.get(tabId);
    }

    isWhitelistedUrl(url) {
        try {
            const host = new URL(url).hostname;
            return FerretWatchContracts.hostMatchesWhitelist(host, (this.settings && this.settings.whitelistedDomains) || []);
        } catch (error) {
            return false;
        }
    }

    monitoringEnabled() {
        const diagnostics = this.settings && this.settings.diagnostics;
        if (!diagnostics) {
            return true;
        }
        return diagnostics.monitoring !== false && diagnostics.responseFilter !== false;
    }

    handleApiCall(apiData, tabId, tabUrl) {
        if (!tabId) {
            console.warn('[API] No tabId provided for API call:', apiData.url);
            return;
        }

// debugLog(`[API] Storing endpoint for tab ${tabId}: ${apiData.method} ${apiData.url}`);

        // Store the tab origin for resolving relative URLs during replay
        if (tabUrl) {
            try {
                apiData.origin = new URL(tabUrl).origin;
            } catch (e) {
                console.warn('[API] Could not parse tab URL for origin:', tabUrl);
            }
        }

        const currentEndpoints = this.apiEndpoints.get(tabId) || [];

        // Check if we already have this endpoint (deduplication)
        // We consider an endpoint unique by Method + URL
        const normalized = FerretWatchContracts.normalizeRequestUrl(apiData.url, apiData.origin || tabUrl) || apiData.url;
        apiData.url = normalized;
        apiData.method = String(apiData.method || 'GET').toUpperCase();
        if (apiData.body) {
            const bounded = FerretWatchContracts.boundText(apiData.body, FerretWatchContracts.CAPTURE_LIMITS.requestBodyBytes);
            apiData.body = bounded.text;
            apiData.bodyTruncated = bounded.truncated;
        }

        const exists = false;

        if (!exists) {
            // Try to get full headers from cache (including cookies)
            const cacheKey = apiData.requestId ? String(apiData.requestId) : `${apiData.method}:${apiData.url}`;
            const cachedHeaders = this.requestHeadersCache.get(cacheKey) || this.requestHeadersCache.get(`${apiData.method}:${apiData.url}`);

// debugLog(`🔍 [API] Looking for cached headers: ${cacheKey}`);
// debugLog(`🔍 [API] Cache has entry: ${!!cachedHeaders}`);
// debugLog(`🔍 [API] Current cache size: ${this.requestHeadersCache.size}`);

            if (cachedHeaders) {
                const hadCookie = Object.keys(apiData.headers || {}).some(k => k.toLowerCase() === 'cookie');

                // Merge captured headers with webRequest headers (webRequest takes precedence)
                apiData.headers = { ...apiData.headers, ...cachedHeaders };

                const nowHasCookie = Object.keys(apiData.headers).some(k => k.toLowerCase() === 'cookie');
// debugLog(`✅ [API] Merged headers from webRequest for ${cacheKey}`);
// debugLog(`🍪 [API] Cookie before merge: ${hadCookie}, after merge: ${nowHasCookie}`);

                // Clean up cache entry after use
                this.requestHeadersCache.delete(cacheKey);
            } else {
// debugLog(`⚠️ [API] No cached headers found for ${cacheKey} - may have timed out or not captured yet`);
            }

            // Mark as live request with source
            apiData.source = 'live';
            apiData.response = null;

            if (!this.budgetFor(tabId).tryEndpoint()) {
                apiData.omitted = true;
                return;
            }
            if (apiData.requestId) {
                this.requestLog.observe({
                    requestId: apiData.requestId,
                    tabId,
                    generation: this.findingStore.generation(tabId),
                    method: apiData.method,
                    url: apiData.url,
                    headers: apiData.headers,
                    body: apiData.body
                });
            }
            currentEndpoints.push(apiData);
            this.apiEndpoints.set(tabId, currentEndpoints);

            // Notify any open API Explorer tabs about the new endpoint
            this.notifyExplorerTabs(tabId, apiData);
        }
    }

    /**
     * Handle API response and update the corresponding request
     */
    handleApiResponse(responseData, tabId) {
        if (!tabId) {
            console.warn('[API] No tabId provided for API response:', responseData.url);
            return;
        }

// debugLog(`[API] Received response for tab ${tabId}: ${responseData.status} ${responseData.method} ${responseData.url}`);

        const currentEndpoints = this.apiEndpoints.get(tabId) || [];

        // Find the matching request
        const normalizedUrl = FerretWatchContracts.normalizeRequestUrl(responseData.url, this.pageUrls.get(tabId)) || responseData.url;
        responseData.url = normalizedUrl;
        responseData.method = String(responseData.method || 'GET').toUpperCase();
        const endpoint = (responseData.requestId && currentEndpoints.find(e => e.requestId === responseData.requestId)) ||
            currentEndpoints.find(e => e.method === responseData.method && e.url === responseData.url && !e.response);

        if (endpoint) {
            // Update endpoint with response data
            endpoint.response = {
                status: responseData.status,
                statusText: responseData.statusText,
                responseHeaders: responseData.responseHeaders,
                responseBody: responseData.responseBody,
                responseSize: responseData.responseSize,
                duration: responseData.duration,
                error: responseData.error
            };

            // Update storage
            this.apiEndpoints.set(tabId, currentEndpoints);

            // Notify explorer tabs
            this.notifyExplorerTabs(tabId, endpoint);
            this.scanResponsePayload(tabId, responseData);
        } else {
            console.warn(`⚠️ [API] No matching request found for response: ${responseData.method} ${responseData.url}`);

            // If no matching request found, create a new entry (edge case)
            const newEndpoint = {
                method: responseData.method,
                url: responseData.url,
                type: responseData.type,
                timestamp: responseData.timestamp,
                headers: {},
                body: null,
                source: 'live',
                response: {
                    status: responseData.status,
                    statusText: responseData.statusText,
                    responseHeaders: responseData.responseHeaders,
                    responseBody: responseData.responseBody,
                    responseSize: responseData.responseSize,
                    duration: responseData.duration,
                    error: responseData.error
                }
            };

            currentEndpoints.push(newEndpoint);
            this.apiEndpoints.set(tabId, currentEndpoints);
            this.notifyExplorerTabs(tabId, newEndpoint);
            this.scanResponsePayload(tabId, responseData);
        }
    }

    scanResponsePayload(tabId, responseData) {
        const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
        if (this.monitoringEnabled() && api && api.webRequest && typeof api.webRequest.filterResponseData === 'function') {
            return;
        }
        if (!responseData || responseData.inspection === 'unavailable' || !responseData.responseBody) {
            return;
        }
        if (this.isWhitelistedUrl(responseData.url)) {
            return;
        }
        const bounded = FerretWatchContracts.boundText(responseData.responseBody, FerretWatchContracts.CAPTURE_LIMITS.bytesPerResponse);
        this.scanCapturedText(tabId, this.pageUrls.get(tabId), bounded.text, {
            url: responseData.url,
            sourceKind: 'response'
        });
    }

    /**
     * Replay/send a request
     */
    async replayRequest(requestData) {
// debugLog(`[API] Replaying request: ${requestData.method} ${requestData.url}`);
// debugLog(`[API] Request origin: ${requestData.origin || 'NOT SET'}`);
// debugLog(`[API] Full request data:`, requestData);

        const startTime = Date.now();

        const sourceTabId = requestData.sourceTabId || requestData.tabId;
        if (sourceTabId == null) {
            return { success: false, error: 'Replay requires the source tab. Refusing to use another tab.' };
        }
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            const sourceTab = await api.tabs.get(sourceTabId);
            if (!sourceTab || !sourceTab.url) {
                return { success: false, error: 'Source tab is closed or unavailable.' };
            }
            let absoluteUrl = FerretWatchContracts.normalizeRequestUrl(requestData.url, requestData.origin || sourceTab.url);
            if (!absoluteUrl) {
                return { success: false, error: 'Could not resolve the replay URL.' };
            }

// debugLog(`[API] Final URL to fetch: ${absoluteUrl}`);

            const response = await fetch(absoluteUrl, {
                method: requestData.method,
                headers: requestData.headers || {},
                body: requestData.body || null,
                credentials: 'omit', // Don't send cookies by default for security
                mode: 'cors'
            });

            const duration = Date.now() - startTime;
            const body = await response.text();

            // Extract response headers
            const headers = {};
            for (const [key, value] of response.headers.entries()) {
                headers[key] = value;
            }

// debugLog(`✅ [API] Request completed: ${response.status} in ${duration}ms`);

            return {
                success: true,
                status: response.status,
                statusText: response.statusText,
                headers: headers,
                body: body,
                duration: duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [API] Request failed:`, error);

            return {
                success: false,
                error: error.message,
                duration: duration
            };
        }
    }

    /**
     * Cache request headers captured from webRequest
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     * @param {Object} headers - Headers object from webRequest
     */
    cacheRequestHeaders(method, url, headers, requestId) {
        const cacheKey = requestId ? String(requestId) : `${method}:${url}`;

        // Convert headers array to object
        const headersObj = {};
        if (Array.isArray(headers)) {
            headers.forEach(h => {
                headersObj[h.name] = h.value;
            });
        }

        // Check if Cookie header is present
        const hasCookie = Object.keys(headersObj).some(k => k.toLowerCase() === 'cookie');
// debugLog(`📦 [CACHE] Storing headers for ${cacheKey} - Cookie present: ${hasCookie}`);
        if (hasCookie) {
// debugLog(`🍪 [CACHE] Cookie value: ${headersObj['Cookie'] || headersObj['cookie']}`);
        }

        this.requestHeadersCache.set(cacheKey, headersObj);

        // Auto-cleanup after 5 seconds to prevent memory leaks
        setTimeout(() => {
            this.requestHeadersCache.delete(cacheKey);
        }, 5000);
    }

    /**
     * Handle unused endpoint scan request
     */
    async handleUnusedEndpointScan(requestedTabId, senderTabId) {
        const targetTabId = requestedTabId || senderTabId;

        if (!targetTabId) {
            return {
                success: false,
                error: 'No target tab specified'
            };
        }

        try {
// debugLog(`🔍 [Background] Starting unused endpoint scan for tab ${targetTabId}`);

            const api = typeof browser !== 'undefined' ? browser : chrome;

            // Request the content script to scan the page
            const scanResponse = await api.tabs.sendMessage(targetTabId, {
                action: 'scanUnusedEndpoints'
            });

            if (!scanResponse || !scanResponse.success) {
                return {
                    success: false,
                    error: scanResponse?.error || 'Scan failed'
                };
            }

// debugLog(`✅ [Background] Scan complete. Found ${scanResponse.total} potential endpoints`);

            // Get the list of API calls that have been captured for this tab
            const calledEndpoints = this.apiEndpoints.get(targetTabId) || [];

            // Compare discovered endpoints with called endpoints
            const calledUrls = new Set(calledEndpoints.map(ep => {
                try {
                    const url = new URL(ep.url);
                    return url.origin + url.pathname;
                } catch {
                    return ep.url;
                }
            }));

            // Filter out endpoints that have been called
            const unused = scanResponse.discovered.filter(endpoint => {
                const normalizedUrl = endpoint.normalizedUrl || endpoint.url;
                return !calledUrls.has(normalizedUrl);
            });

            const used = scanResponse.discovered.filter(endpoint => {
                const normalizedUrl = endpoint.normalizedUrl || endpoint.url;
                return calledUrls.has(normalizedUrl);
            });

// debugLog(`📊 [Background] Analysis: ${unused.length} unused, ${used.length} used`);

            // Get tab URL to provide origin for resolving relative URLs
            let tabOrigin = null;
            try {
                const tab = await api.tabs.get(targetTabId);
                if (tab && tab.url) {
                    tabOrigin = new URL(tab.url).origin;
// debugLog(`🌐 [Background] Tab origin for URL resolution: ${tabOrigin}`);
                }
            } catch (e) {
                console.warn('[Background] Could not get tab URL for origin:', e);
            }

            // Add origin to all discovered endpoints for replay support
            const discoveredWithOrigin = scanResponse.discovered.map(ep => ({
                ...ep,
                origin: tabOrigin
            }));

            return {
                success: true,
                discovered: discoveredWithOrigin,
                unused: unused,
                used: used,
                stats: {
                    totalDiscovered: scanResponse.total,
                    totalCalled: calledEndpoints.length,
                    totalUnused: unused.length,
                    totalUsed: used.length
                },
                scannedAt: scanResponse.scannedAt
            };

        } catch (error) {
            console.error(`❌ [Background] Unused endpoint scan failed:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Notify all API Explorer tabs that are watching a specific tab about new API calls
     */
    async notifyExplorerTabs(sourceTabId, newEndpoint) {
        try {
            // Query all tabs to find any that are API Explorer pages
            const allTabs = await (typeof browser !== 'undefined' ? browser : chrome).tabs.query({});

            for (const tab of allTabs) {
                // Check if this is an explorer page for the source tab (support both v1 and v2)
                if (tab.url && (tab.url.includes('popup/explorer.html') || tab.url.includes('popup/explorer-v2.html')) && tab.url.includes(`tabId=${sourceTabId}`)) {
                    // Send update to the explorer tab
                    (typeof browser !== 'undefined' ? browser : chrome).tabs.sendMessage(tab.id, {
                        type: 'NEW_API_ENDPOINT',
                        tabId: sourceTabId,
                        endpoint: newEndpoint
                    }).catch(err => {
                        // Explorer might not be ready yet, that's fine
                        console.debug('Could not notify explorer tab:', err.message);
                    });
                }
            }
        } catch (error) {
            console.error('Error notifying explorer tabs:', error);
        }
    }

    async handleProxyRequest(requestData, specifiedTabId) {
        const tabId = specifiedTabId || (requestData && (requestData.sourceTabId || requestData.tabId));
        if (tabId == null) {
            return { success: false, error: 'Replay requires the source tab. Refusing to use another tab.' };
        }
        return this.replayRequest({ ...(requestData || {}), sourceTabId: tabId, tabId });
    }


    async updateSettings(newSettings) {

        // Validate settings before updating
        const validatedSettings = FerretWatchContracts.migrateStoredSettings({
            settings: { ...this.settings, ...this.validateSettings(newSettings) }
        });
        this.settings = validatedSettings;

        try {
            await chrome.storage.local.set({ settings: this.settings });

            // Broadcast settings update to all tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'SETTINGS_UPDATED',
                        data: this.settings
                    });
                } catch (error) {
                    // Tab might not have content script loaded yet - this is expected
                    console.debug(`Could not notify tab ${tab.id} of settings update:`, error.message);
                }
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }

    validateSettings(settings) {
        const validated = { ...settings };

        // Validate cloud bucket scanning settings
        if (validated.cloudBucketScanning) {
            const bucketSettings = validated.cloudBucketScanning;

            // Ensure enabled is boolean
            if (typeof bucketSettings.enabled !== 'boolean') {
                bucketSettings.enabled = true;
            }

            // Validate providers object
            if (!bucketSettings.providers || typeof bucketSettings.providers !== 'object') {
                bucketSettings.providers = {
                    aws: true,
                    gcp: true,
                    azure: true,
                    digitalocean: true,
                    alibaba: true
                };
            } else {
                // Ensure all provider values are boolean
                const validProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];
                validProviders.forEach(provider => {
                    if (typeof bucketSettings.providers[provider] !== 'boolean') {
                        bucketSettings.providers[provider] = true;
                    }
                });
            }

            // Validate timeout (must be positive integer between 1000 and 30000)
            if (typeof bucketSettings.testTimeout !== 'number' ||
                bucketSettings.testTimeout < 1000 ||
                bucketSettings.testTimeout > 30000) {
                bucketSettings.testTimeout = 5000;
            }

            // Validate max concurrent tests (must be positive integer between 1 and 10)
            if (typeof bucketSettings.maxConcurrentTests !== 'number' ||
                bucketSettings.maxConcurrentTests < 1 ||
                bucketSettings.maxConcurrentTests > 10) {
                bucketSettings.maxConcurrentTests = 3;
            }

            // Ensure testPublicAccess is boolean
            if (typeof bucketSettings.testPublicAccess !== 'boolean') {
                bucketSettings.testPublicAccess = true;
            }
        }

        return validated;
    }

    async showNotification(notificationData) {
        if (!this.settings.enableNotifications) return;

        const options = {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
            title: notificationData.title || 'Credential Scanner',
            message: notificationData.message || 'Credentials detected',
            priority: notificationData.findings?.some(f => f.riskLevel === 'critical') ? 2 : 1
        };

        try {
            const notificationId = await chrome.notifications.create(options);

            // Auto-clear notification after delay
            setTimeout(() => {
                chrome.notifications.clear(notificationId);
            }, 5000);

        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    async updateBadge(tabId, count) {
        const badgeText = count > 0 ? count.toString() : '';
        const badgeColor = count > 0 ? '#dc3545' : '#28a745';

        try {
            // Use browserAction for Firefox Manifest V2 compatibility
            await chrome.browserAction.setBadgeText({ text: badgeText, tabId });
            await chrome.browserAction.setBadgeBackgroundColor({ color: badgeColor, tabId });
        } catch (error) {
            console.error('Failed to update badge:', error);
        }
    }

    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.settings) {
                this.settings = FerretWatchContracts.migrateStoredSettings({ settings: changes.settings.newValue });
// debugLog('Settings updated from storage');
            }
        });
    }

    setupTabListeners() {
        // Clear results when tab is removed
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.tabResults.delete(tabId);
            this.apiEndpoints.delete(tabId);
            this.findingStore.close(tabId);
            this.requestLog.dropTab(tabId);
            this.captureBudgets.delete(tabId);
            this.pageUrls.delete(tabId);
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url || changeInfo.status === 'loading') {
                if (tab && tab.url) {
                    this.pageUrls.set(tabId, tab.url);
                }
            }
            if (changeInfo.status === 'loading') {
                this.tabResults.delete(tabId);
                this.apiEndpoints.set(tabId, []);
                this.findingStore.beginDocument(tabId);
                this.requestLog.dropTab(tabId);
                const budget = this.budgetFor(tabId);
                budget.reset();
                this.updateBadge(tabId, 0);
            }
        });
    }

    async getSessionData() {
        const sessionResults = [];

        // Collect results from all tabs
        for (const [tabId, results] of this.tabResults.entries()) {
            try {
                const tab = await chrome.tabs.get(tabId);
                sessionResults.push({
                    tabId,
                    url: tab.url,
                    title: tab.title,
                    findings: results,
                    timestamp: Date.now()
                });
            } catch (error) {
                // Tab might be closed or inaccessible - skip it
                console.debug(`Could not get findings from tab ${tabId}:`, error.message);
            }
        }

        return {
            sessionId: Date.now().toString(),
            exportDate: new Date().toISOString(),
            totalFindings: sessionResults.reduce((sum, tab) => sum + tab.findings.length, 0),
            totalTabs: sessionResults.length,
            settings: this.settings,
            tabs: sessionResults
        };
    }

    headerContentType(headers) {
        if (!Array.isArray(headers)) {
            return '';
        }
        const header = headers.find((item) => item.name && item.name.toLowerCase() === 'content-type');
        return header ? header.value : '';
    }

    async scanCapturedText(tabId, pageUrl, text, meta) {
        if (!text || tabId == null || tabId < 0) {
            return;
        }
        if (this.pendingScans >= FerretWatchContracts.CAPTURE_LIMITS.pendingScans) {
            return;
        }
        const budget = this.budgetFor(tabId);
        const retained = budget.retain(text);
        if (!retained.text) {
            return;
        }
        if (typeof ProgressiveScanner === 'undefined' || typeof patternManager === 'undefined') {
            return;
        }
        this.pendingScans += 1;
        try {
            if (!this.responseScanner) {
                this.responseScanner = new ProgressiveScanner();
            }
            const findings = await this.responseScanner.progressiveScan(retained.text, patternManager.getAllPatterns(), {
                sourceKind: meta.sourceKind || 'response',
                sourceUrl: meta.url,
                skipBucketProbes: true,
                scanTimeMs: FerretWatchContracts.CAPTURE_LIMITS.scanTimeMs
            });
            const state = retained.state === 'truncated' || this.responseScanner.lastScanState === 'truncated'
                ? 'truncated'
                : (this.responseScanner.lastScanState || 'success');
            await this.handleScanReport({
                pageUrl: pageUrl || meta.url,
                findings,
                state
            }, tabId);
        } catch (error) {
            console.debug('Response scan failed:', error.message);
        } finally {
            this.pendingScans -= 1;
        }
    }

    installResponseMonitor() {
        const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
        const webRequest = api && (api.webRequest || null);
        if (!webRequest || typeof webRequest.filterResponseData !== 'function' || !webRequest.onHeadersReceived) {
            console.debug('Response filter API is unavailable in this browser. Document HTML and scripts are still scanned in the page.');
            return;
        }
        const watched = new Set(['xmlhttprequest', 'fetch', 'script']);
        webRequest.onHeadersReceived.addListener((details) => {
            try {
                if (!this.monitoringEnabled() || !watched.has(details.type)) {
                    return;
                }
                if (details.tabId < 0 || this.isWhitelistedUrl(details.url)) {
                    return;
                }
                const contentType = this.headerContentType(details.responseHeaders);
                if (!FerretWatchContracts.isScannableContentType(contentType)) {
                    return;
                }
                const filter = webRequest.filterResponseData(details.requestId);
                const tap = new FerretWatchContracts.ResponseTap({
                    byteLimit: FerretWatchContracts.CAPTURE_LIMITS.bytesPerResponse,
                    contentType
                });
                let wrote = false;
                filter.ondata = (event) => {
                    try {
                        filter.write(event.data);
                        wrote = true;
                        tap.write(event.data);
                    } catch (error) {
                        try { filter.disconnect(); } catch (disconnectError) { /* already closed */ }
                    }
                };
                filter.onstop = () => {
                    try {
                        if (wrote) {
                            filter.close();
                        } else {
                            filter.disconnect();
                        }
                    } catch (error) {
                        try { filter.disconnect(); } catch (disconnectError) { /* already closed */ }
                    }
                    const snapshot = tap.finish();
                    const pageUrl = this.pageUrls.get(details.tabId);
                    setTimeout(() => {
                        this.scanCapturedText(details.tabId, pageUrl, snapshot.text, {
                            url: details.url,
                            sourceKind: details.type === 'script' ? 'script' : 'response'
                        });
                    }, 0);
                };
                filter.onerror = () => {
                    tap.fail();
                    try { filter.disconnect(); } catch (error) { /* already closed */ }
                };
            } catch (error) {
                console.debug('Could not attach response filter:', error.message);
            }
        }, { urls: ['<all_urls>'] }, ['responseHeaders']);
    }
}

// Chrome-specific API compatibility layer
class ChromeAPIAdapter {
    static adaptFirefoxToChrome() {
        // Create browser namespace for Chrome compatibility
        if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
            window.browser = {
                runtime: {
                    sendMessage: chrome.runtime.sendMessage.bind(chrome.runtime),
                    onMessage: chrome.runtime.onMessage,
                    getURL: chrome.runtime.getURL.bind(chrome.runtime)
                },
                storage: {
                    local: {
                        get: (keys) => new Promise(resolve =>
                            chrome.storage.local.get(keys, resolve)
                        ),
                        set: (items) => new Promise(resolve =>
                            chrome.storage.local.set(items, resolve)
                        )
                    },
                    onChanged: chrome.storage.onChanged
                },
                tabs: {
                    query: (queryInfo) => new Promise(resolve =>
                        chrome.tabs.query(queryInfo, resolve)
                    ),
                    sendMessage: (tabId, message) => new Promise(resolve =>
                        chrome.tabs.sendMessage(tabId, message, resolve)
                    )
                },
                notifications: {
                    create: (options) => new Promise(resolve =>
                        chrome.notifications.create(options, resolve)
                    ),
                    clear: chrome.notifications.clear.bind(chrome.notifications)
                }
            };
        }
    }
}

// Chrome extension context detection
function isChromeExtension() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

// Cross-browser compatibility wrapper
function getExtensionAPI() {
    if (typeof browser !== 'undefined') {
        return browser; // Firefox
    } else if (typeof chrome !== 'undefined') {
        ChromeAPIAdapter.adaptFirefoxToChrome();
        return browser; // Chrome with adapter
    } else {
        throw new Error('No extension API available');
    }
}

// Service worker installation and activation
self.addEventListener('install', (event) => {
// debugLog('🔧 Service worker installing...');
    self.skipWaiting(); // Immediately activate new service worker
});

self.addEventListener('activate', (event) => {
// debugLog('✅ Service worker activated');
    event.waitUntil(
        clients.claim() // Take control of all clients immediately
    );
});

// TOP-LEVEL WEB REQUEST LISTENER FOR PROXY SPOOFING
// Stores URLs that are currently being proxied to allow Preflight (OPTIONS) spoofing
const activeProxyTargets = new Set();
// Expose for BackgroundService to use
self.activeProxyTargets = activeProxyTargets;

(function () {
    try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        const webRequest = api.webRequest || (typeof chrome !== 'undefined' ? chrome.webRequest : null);

        if (webRequest && webRequest.onBeforeSendHeaders) {
// debugLog('✅ [TOP-LEVEL] Setting up webRequest listeners');

            // Listener 1: Capture ALL request headers (including cookies) for API discovery
            webRequest.onBeforeSendHeaders.addListener(
                (details) => {
                    // Skip extension internal requests
                    if (details.url.startsWith('chrome-extension://') || details.url.startsWith('moz-extension://')) {
                        return;
                    }

                    // Skip non-XHR/Fetch requests (only capture API calls)
                    if (details.type !== 'xmlhttprequest' && details.type !== 'fetch' && details.type !== 'other' && details.type !== 'script') {
// debugLog(`⏭️ [HEADERS] Skipping non-API request type: ${details.type} for ${details.url}`);
                        return;
                    }

// debugLog(`🎯 [HEADERS] Intercepted ${details.type} request: ${details.method} ${details.url}`);

                    // Check for Cookie header in this request
                    const hasCookie = details.requestHeaders?.some(h => h.name.toLowerCase() === 'cookie');
// debugLog(`🍪 [HEADERS] Cookie present in webRequest: ${hasCookie}`);

                    // Cache the full headers for this request
                    if (backgroundService && backgroundService.cacheRequestHeaders) {
                        backgroundService.cacheRequestHeaders(details.method, details.url, details.requestHeaders, details.requestId);
                        if (backgroundService.requestLog && !backgroundService.isWhitelistedUrl(details.url)) {
                            backgroundService.requestLog.observe({
                                requestId: details.requestId,
                                tabId: details.tabId,
                                generation: backgroundService.findingStore.generation(details.tabId),
                                method: details.method,
                                url: details.url,
                                headers: details.requestHeaders
                            });
                        }
// debugLog(`📦 [HEADERS] Cached headers for ${details.method} ${details.url}`);
                    } else {
                        console.warn(`⚠️ [HEADERS] backgroundService not available!`);
                    }
                },
                { urls: ["<all_urls>"] },
                typeof browser !== 'undefined'
                    ? ["requestHeaders"]  // Firefox
                    : ["requestHeaders", "extraHeaders"]  // Chrome - extraHeaders needed for Cookie
            );

            // Listener 2: Proxy request rewriting (existing functionality)
            webRequest.onBeforeSendHeaders.addListener(
                (details) => {
                    let hasProxyMarker = false;
                    const headers = details.requestHeaders || [];

                    // Check for marker and remove it
                    for (let i = 0; i < headers.length; i++) {
                        if (headers[i].name === 'X-FW-Proxy') {
                            hasProxyMarker = true;
                            headers.splice(i, 1); // Remove marker
// debugLog('🎯 [PROXY] Intercepted request with marker:', details.url);
                            break;
                        }
                    }

                    // Check if this URL is in our active proxy list (for Preflight/OPTIONS)
                    const isTarget = activeProxyTargets.has(details.url);

                    if (hasProxyMarker || isTarget) {
                        const targetUrl = new URL(details.url);
                        const origin = targetUrl.origin;

                        if (isTarget && !hasProxyMarker) {
// debugLog(`🔎 [PROXY] Intercepted Preflight/Related request: ${details.method} ${details.url}`);
                        }

                        // Rewrite Origin
                        let originFound = false;
                        for (const h of headers) {
                            if (h.name.toLowerCase() === 'origin') {
// debugLog(`🔄 [PROXY] Rewriting Origin: ${h.value} -> ${origin}`);
                                h.value = origin;
                                originFound = true;
                            } else if (h.name.toLowerCase() === 'referer') {
// debugLog(`🔄 [PROXY] Rewriting Referer: ${h.value} -> ${targetUrl.href}`);
                                h.value = targetUrl.href;
                            }
                        }

                        if (!originFound) {
// debugLog(`➕ [PROXY] Adding Origin: ${origin}`);
                            headers.push({ name: 'Origin', value: origin });
                            // Also ensure Referer is set if not present
                            if (!headers.some(h => h.name.toLowerCase() === 'referer')) {
                                headers.push({ name: 'Referer', value: targetUrl.href });
                            }
                        }

                        return { requestHeaders: headers };
                    }
                },
                { urls: ["<all_urls>"] },
                // Firefox doesn't support "extraHeaders", Chrome needs it for some headers
                typeof browser !== 'undefined'
                    ? ["blocking", "requestHeaders"]  // Firefox
                    : ["blocking", "requestHeaders", "extraHeaders"]  // Chrome
            );
        } else {
            console.error('❌ [TOP-LEVEL] webRequest API not available!');
        }
    } catch (e) {
        console.error('❌ [TOP-LEVEL] CRITICAL ERROR during webRequest setup:', e);
    }
})();

// Initialize background service
let backgroundService = null;


// Initialize when service worker starts
// Initialize when service worker starts
try {
    backgroundService = new BackgroundService();
} catch (e) {
    console.error('❌ Failed to initialize background service:', e);
}


// Handle service worker wakeup
chrome.runtime.onStartup.addListener(() => {
// debugLog('🚀 Extension startup');
    if (!backgroundService) {
        backgroundService = new BackgroundService();
    }
});

chrome.runtime.onInstalled.addListener((details) => {
// debugLog('📦 Extension installed/updated:', details.reason);
    if (!backgroundService) {
        backgroundService = new BackgroundService();
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackgroundService, ChromeAPIAdapter };
}
