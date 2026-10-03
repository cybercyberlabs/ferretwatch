/**
 * Background Service Worker for Chrome Manifest V3
 * Handles cross-tab communication, storage, and notifications
 */

// Firefox loads these as background scripts. Chrome's MV3 worker loads background.js alone.
try {
    if (typeof importScripts === 'function' && typeof FerretWatchContracts === 'undefined') {
        importScripts(
            'utils/contracts.js',
            'utils/storage.js',
            'utils/response-monitor.js',
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
        this.queuedScans = 0;
        this.policyVersion = 0;
        this.pendingAlerts = new Map();
        this.alertTimers = new Map();
        this.notifyCounts = new Map();
        this.notifyTimers = new Map();
        this.pausedHosts = new Set();
        this.announcedCounts = new Map();

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
        this.nativeMonitor = new NativeResponseMonitor(this, typeof browser !== 'undefined' ? browser : chrome);
        this.nativeMonitor.install();

        // Load settings (Async)
        this.pausedHosts = new Set();
        this.ready = this.loadSettings().then(() => this.loadPausedHosts());
    }


    async loadPausedHosts() {
        try {
            const session = (typeof browser !== 'undefined' ? browser : chrome).storage.session;
            if (!session) return;
            const stored = await session.get('pausedHosts');
            this.pausedHosts = new Set(Array.isArray(stored.pausedHosts) ? stored.pausedHosts : []);
        } catch (error) {
            console.debug('Could not load temporary pauses:', error.message);
        }
    }

    isPausedUrl(url) {
        try {
            return FerretWatchContracts.hostPaused(new URL(url).hostname, this.pausedHosts);
        } catch (error) {
            return false;
        }
    }

    async setSitePause(host, paused) {
        const name = String(host || '').trim().toLowerCase();
        if (!name) return;
        if (paused) this.pausedHosts.add(name);
        else this.pausedHosts.delete(name);
        try {
            const session = (typeof browser !== 'undefined' ? browser : chrome).storage.session;
            if (session) await session.set({ pausedHosts: [...this.pausedHosts] });
        } catch (error) {
            console.debug('Could not store temporary pause:', error.message);
        }
        this.policyVersion += 1;
        this.nativeMonitor?.policyChanged();
        await this.broadcastSettings();
    }

    async loadSettings() {
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            this.settings = await globalThis.StorageUtils.ensureSettings();
            this.debugMode = !!this.settings.debugMode;
            // Existing tabs may not navigate after extension startup.
            for (const tab of await api.tabs.query({})) {
                if (tab.url && !this.pageUrls.has(tab.id)) this.pageUrls.set(tab.id, tab.url);
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




    extensionOrigin() {
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            return api.runtime.getURL('');
        } catch (error) {
            return '';
        }
    }

    isExtensionSender(sender) {
        return FerretWatchContracts.isExtensionSender(sender, this.extensionOrigin());
    }

    authorizedTab(message, sender) {
        return FerretWatchContracts.authorizedTabId(message, sender, this.extensionOrigin());
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            const tabId = this.authorizedTab(message, sender);
            const extensionPage = this.isExtensionSender(sender);
            await this.ready;
            switch (message.type) {
                case 'SHOW_PAGE_ALERT': {
                    const alertTab = sender.tab?.id;
                    const count = Number(message.count);
                    if (alertTab == null || !Number.isInteger(count) || count < 1) {
                        sendResponse({ success: false });
                        break;
                    }
                    if (this.isWhitelistedUrl(this.pageUrls.get(alertTab)) || this.isPausedUrl(this.pageUrls.get(alertTab))) {
                        sendResponse({ success: false });
                        break;
                    }
                    this.announceFindings(alertTab, count);
                    sendResponse({ success: true });
                    break;
                }

                case 'REGISTER_DOCUMENT':
                    sendResponse(sender.tab ? {
                        ...this.documentContext(sender.tab.id),
                        pausedHosts: [...this.pausedHosts]
                    } : null);
                    break;

                case 'SET_SITE_PAUSE':
                    if (!extensionPage) {
                        sendResponse({ error: 'Only the extension popup can pause a site' });
                        break;
                    }
                    await this.setSitePause(message.host, message.paused === true);
                    sendResponse({ pausedHosts: [...this.pausedHosts] });
                    break;

                case 'GET_SITE_PAUSE':
                    if (!extensionPage) {
                        sendResponse({ pausedHosts: [] });
                        break;
                    }
                    sendResponse({ pausedHosts: [...this.pausedHosts] });
                    break;
                case 'SCAN_COMPLETE':
                case 'SCAN_REPORT':
                    sendResponse(await this.handleScanReport(message.data, sender.tab?.id));
                    break;

                case 'GET_FINDINGS':
                case 'EXPORT_FINDINGS': {
                    if (tabId == null) {
                        sendResponse({ state: 'unavailable', findings: [], exportFindings: [], error: 'Tab not authorized' });
                        break;
                    }
                    sendResponse({
                        state: this.findingStore.state(tabId),
                        findings: this.findingStore.list(tabId, false),
                        exportFindings: extensionPage ? this.findingStore.list(tabId, true) : []
                    });
                    break;
                }

                case 'DISMISS_FINDING': {
                    if (tabId == null) {
                        sendResponse({ success: false, state: 'unavailable', findings: [], error: 'Tab not authorized' });
                        break;
                    }
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
                    if (!extensionPage) { sendResponse({ success: false, error: 'Extension page required' }); break; }
                    await this.updateSettings(message.data);
                    sendResponse({ success: true });
                    break;

                case 'GET_TAB_RESULTS': {
                    if (tabId == null) {
                        sendResponse({ results: [], state: 'unavailable', error: 'Tab not authorized' });
                        break;
                    }
                    const results = this.findingStore.list(tabId, false);
                    sendResponse({ results, state: this.findingStore.state(tabId) });
                    break;
                }

                case 'CLEAR_TAB_RESULTS':
                    this.tabResults.delete(sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'EXPORT_SESSION_DATA':
                    if (!extensionPage) {
                        sendResponse({ error: 'Export is only available from the extension' });
                        break;
                    }
                    const sessionData = await this.getSessionData();
                    sendResponse({ data: sessionData });
                    break;

                case 'SHOW_NOTIFICATION':
                    await this.showNotification(message.data);
                    sendResponse({ success: true });
                    break;

                case 'API_CALL_CAPTURED':
                    if (!this.settings.diagnostics.pageInterceptor) { sendResponse({ success: false }); break; }
                    this.handleApiCall(message.data, sender.tab?.id, sender.tab?.url);
                    sendResponse({ success: true });
                    break;

                case 'API_RESPONSE_CAPTURED':
                    if (!this.settings.diagnostics.pageInterceptor) { sendResponse({ success: false }); break; }
                    this.handleApiResponse(message.data, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'REPLAY_REQUEST':
                case 'PROXY_REQUEST':
                    if (!extensionPage) { sendResponse({ success: false, error: 'Replay requires an extension page' }); break; }
                    if (tabId == null) {
                        sendResponse({ success: false, error: 'Replay requires the source tab. Refusing to use another tab.' });
                        break;
                    }
                    this.replayRequest({ ...(message.data || {}), sourceTabId: tabId, tabId }).then(sendResponse);
                    return true;

                case 'GET_API_ENDPOINTS':
                    if (tabId == null) {
                        sendResponse({ endpoints: [], error: 'Tab not authorized' });
                        break;
                    }
                    const endpoints = this.apiEndpoints.get(tabId) || [];
                    sendResponse({ endpoints });
                    break;

                case 'CLEAR_API_ENDPOINTS':
                    if (tabId == null) {
                        sendResponse({ success: false, error: 'Tab not authorized' });
                        break;
                    }
                    this.apiEndpoints.set(tabId, []);
                    this.requestLog.dropTab(tabId);
                    this.notifyExplorerTabs(tabId);
                    sendResponse({ success: true });
                    break;

                case 'SCAN_UNUSED_ENDPOINTS':
                    if (tabId == null) {
                        sendResponse({ success: false, error: 'Tab not authorized' });
                        break;
                    }
                    this.handleUnusedEndpointScan(tabId, sender.tab?.id).then(sendResponse);
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
        if (tabId == null || !scanData || !this.contextCurrent(tabId, scanData.context)) {
            return { accepted: false, reason: 'stale', state: 'unavailable', findings: [] };
        }
        if (this.isWhitelistedUrl(this.pageUrls.get(tabId)) || this.isPausedUrl(this.pageUrls.get(tabId)) ||
            this.settings?.diagnostics.scanning === false) {
            return { accepted: false, state: 'skipped', findings: [] };
        }
        const report = this.findingStore.report(tabId, scanData.context.generation,
            scanData.findings || [], scanData.state || 'success');
        this.tabResults.set(tabId, report.findings);
        if (report.accepted && this.settings && (this.settings.enableNotifications || this.settings.showNotifications)) {
            // The content script sends one desktop notification for the page's
            // full finding set. Do not raise a second, smaller one from here.
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
            sourceKind: 'response',
            context: this.documentContext(tabId)
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
    async notifyExplorerTabs(sourceTabId) {
        // Invalidate only; extension pages fetch their authorized bounded snapshot.
        // tabs.sendMessage targets content scripts, not the Explorer extension page.
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            await api.runtime.sendMessage({ type: 'API_ENDPOINTS_UPDATED', tabId: sourceTabId });
        } catch (_) { /* no Explorer open */ }
    }

    async handleProxyRequest(requestData, specifiedTabId) {
        const tabId = specifiedTabId || (requestData && (requestData.sourceTabId || requestData.tabId));
        if (tabId == null) {
            return { success: false, error: 'Replay requires the source tab. Refusing to use another tab.' };
        }
        return this.replayRequest({ ...(requestData || {}), sourceTabId: tabId, tabId });
    }


    async updateSettings(newSettings) {
        const settings = FerretWatchContracts.migrateStoredSettings({
            settings: { ...this.settings, ...this.validateSettings(newSettings) }
        });
        await chrome.storage.local.set({ settings });
    }

    async broadcastSettings() {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        for (const tab of await api.tabs.query({})) {
            try {
                await api.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED',
                    data: this.settings, pausedHosts: [...this.pausedHosts],
                    context: this.documentContext(tab.id) });
            } catch (_) { /* A content script may not be loaded on this tab. */ }
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

    queueAlert(tabId, findings) {
        const pending = this.pendingAlerts.get(tabId) || [];
        findings.forEach((finding) => {
            const id = finding.id || FerretWatchContracts.findingId(finding);
            if (!pending.some((existing) => (existing.id || FerretWatchContracts.findingId(existing)) === id)) {
                pending.push(finding);
            }
        });
        this.pendingAlerts.set(tabId, pending);
        clearTimeout(this.alertTimers.get(tabId));
        this.alertTimers.set(tabId, setTimeout(() => this.flushAlert(tabId), 700));
    }

    announceFindings(tabId, count) {
        if (!Number.isInteger(count) || count < 1 || this.announcedCounts.has(tabId)) return;
        const pending = this.notifyCounts.get(tabId) || 0;
        if (count < pending) return;
        // Later scans on the same page raise the total before anything is shown.
        // One settled total becomes one system notification for this document.
        if (count > pending) this.notifyCounts.set(tabId, count);
        if (this.notifyTimers.has(tabId) && count === pending) return;
        clearTimeout(this.notifyTimers.get(tabId));
        this.notifyTimers.set(tabId, setTimeout(() => this.flushAnnounced(tabId), 2000));
    }

    flushAnnounced(tabId) {
        clearTimeout(this.notifyTimers.get(tabId));
        this.notifyTimers.delete(tabId);
        if (this.announcedCounts.has(tabId)) {
            this.notifyCounts.delete(tabId);
            return;
        }
        const count = this.notifyCounts.get(tabId) || 0;
        this.notifyCounts.delete(tabId);
        if (count < 1) return;
        this.announcedCounts.set(tabId, count);
        this.showNotification({
            type: 'credential_detected',
            title: 'FerretWatch',
            message: `${count} issue${count === 1 ? '' : 's'} found`,
            notificationId: `ferretwatch-findings-${tabId}`
        });
    }

    discardAlert(tabId) {
        clearTimeout(this.alertTimers.get(tabId));
        this.alertTimers.delete(tabId);
        this.pendingAlerts.delete(tabId);
        clearTimeout(this.notifyTimers.get(tabId));
        this.notifyTimers.delete(tabId);
        this.notifyCounts.delete(tabId);
    }

    flushAlert(tabId) {
        clearTimeout(this.alertTimers.get(tabId));
        this.alertTimers.delete(tabId);
        const pending = this.pendingAlerts.get(tabId) || [];
        this.pendingAlerts.delete(tabId);
        if (!pending.length) return;
        this.showNotification({
            type: 'credential_detected',
            title: 'FerretWatch',
            message: `${pending.length} issue${pending.length === 1 ? '' : 's'} found`,
            findings: pending,
            notificationId: `ferretwatch-findings-${tabId}`
        });
    }

    flushAlerts() {
        [...this.pendingAlerts.keys()].forEach((tabId) => this.flushAlert(tabId));
        [...this.notifyTimers.keys()].forEach((tabId) => this.flushAnnounced(tabId));
    }

    async showNotification(notificationData) {
        if (!this.settings?.enableNotifications || this.settings.showNotifications === false) return;

        const options = {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
            title: notificationData.title || 'Credential Scanner',
            message: notificationData.message || 'Credentials detected'
        };

        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            const requestedId = notificationData.notificationId;
            if (requestedId) await api.notifications.create(requestedId, options);
            else await api.notifications.create(options);
            // Do not clear this notification from code. On this desktop, clear()
            // shows the same toast a second time a few seconds later.

        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    async updateBadge(tabId, count) {
        const badgeText = count > 0 ? count.toString() : '';
        const badgeColor = count > 0 ? '#dc3545' : '#28a745';

        try {
            // Use browserAction for Firefox Manifest V2 compatibility
            const action = chrome.browserAction || chrome.action;
            await action.setBadgeText({ text: badgeText, tabId });
            await action.setBadgeBackgroundColor({ color: badgeColor, tabId });
        } catch (error) {
            console.error('Failed to update badge:', error);
        }
    }

    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local' || !changes.settings) return;
            this.settings = globalThis.StorageUtils.applySettings(changes.settings.newValue);
            this.policyVersion += 1;
            this.nativeMonitor?.policyChanged();
            for (const [tabId, url] of this.pageUrls) {
                if (this.isWhitelistedUrl(url)) {
                    const tab = this.findingStore.ensure(tabId);
                    tab.findings.clear();
                    tab.state = 'skipped';
                    this.tabResults.delete(tabId);
                    this.updateBadge(tabId, 0);
                }
            }
            this.broadcastSettings().catch(() => {});
        });
    }

    documentContext(tabId) {
        return { generation: this.findingStore.generation(tabId), policyVersion: this.policyVersion };
    }

    contextCurrent(tabId, context) {
        const tab = this.findingStore.tabs.get(tabId);
        return !!(tab && context && tab.generation === context.generation &&
            context.policyVersion === this.policyVersion);
    }

    beginDocument(tabId, url) {
        this.discardAlert(tabId);
        this.announcedCounts.delete(tabId);
        this.nativeMonitor?.cancelTab(tabId);
        this.findingStore.beginDocument(tabId);
        this.pageUrls.set(tabId, url);
        this.tabResults.delete(tabId);
        this.apiEndpoints.set(tabId, []);
        this.requestLog.dropTab(tabId);
        this.captureBudgets.delete(tabId);
        this.updateBadge(tabId, 0);
        this.notifyExplorerTabs(tabId);
    }

    setupTabListeners() {
        chrome.tabs.onRemoved.addListener(tabId => {
            this.nativeMonitor?.cancelTab(tabId);
            this.tabResults.delete(tabId);
            this.apiEndpoints.delete(tabId);
            this.findingStore.close(tabId);
            this.requestLog.dropTab(tabId);
            this.captureBudgets.delete(tabId);
            this.pageUrls.delete(tabId);
            this.notifyExplorerTabs(tabId);
        });
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            // A same-document URL change retains findings and request ownership.
            // New documents are established at onBeforeRequest, before subresources.
            if (changeInfo.url || changeInfo.status === 'loading') {
                if (tab?.url) this.pageUrls.set(tabId, tab.url);
            }
            if (!this.nativeMonitor?.hasNavigationListener && changeInfo.status === 'loading') {
                this.beginDocument(tabId, tab?.url);
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

    queueCapturedText(tabId, pageUrl, text, meta) {
        if (this.queuedScans >= FerretWatchContracts.CAPTURE_LIMITS.pendingScans) {
            this.handleScanReport({ context: meta.context, findings: [], state: 'truncated' }, tabId);
            return;
        }
        this.queuedScans += 1;
        setTimeout(async () => {
            try { await this.scanCapturedText(tabId, pageUrl, text, meta); }
            finally { this.queuedScans -= 1; }
        }, 0);
    }

    async scanCapturedText(tabId, pageUrl, text, meta) {
        await this.ready;
        const context = meta.context;
        if (!text || !this.contextCurrent(tabId, context) ||
            this.settings.diagnostics.scanning === false ||
            this.settings.diagnostics.monitoring === false ||
            this.isWhitelistedUrl(this.pageUrls.get(tabId) || pageUrl) || this.isWhitelistedUrl(meta.url) ||
            this.isPausedUrl(this.pageUrls.get(tabId) || pageUrl) || this.isPausedUrl(meta.url)) return;
        if (this.pendingScans >= FerretWatchContracts.CAPTURE_LIMITS.pendingScans) {
            await this.handleScanReport({ context, findings: [], state: 'truncated' }, tabId);
            return;
        }
        this.pendingScans += 1;
        try {
            // Each operation owns its cancellation, timing and state fields.
            const scanner = new ProgressiveScanner();
            const bounded = FerretWatchContracts.boundText(text, FerretWatchContracts.CAPTURE_LIMITS.bytesPerResponse);
            const findings = await scanner.progressiveScan(bounded.text, patternManager.getAllPatterns(), {
                sourceKind: meta.sourceKind || 'response', sourceUrl: meta.url,
                skipBucketProbes: true, scanTimeMs: FerretWatchContracts.CAPTURE_LIMITS.scanTimeMs
            });
            const state = meta.state === 'failed' || scanner.lastScanState === 'failed' ? 'failed' :
                meta.state === 'truncated' || bounded.truncated || scanner.lastScanState === 'truncated'
                    ? 'truncated' : (scanner.lastScanState || 'failed');
            await this.handleScanReport({ context, findings, state }, tabId);
            this.announceFindings(tabId, this.findingStore.list(tabId, false).length);
        } catch (_) {
            await this.handleScanReport({ context, findings: [], state: 'failed' }, tabId);
        } finally {
            this.pendingScans -= 1;
        }
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
