/**
 * Background Service Worker for Chrome Manifest V3
 * Handles cross-tab communication, storage, and notifications
 */

// Import utilities (ES modules for service workers)
// Note: Service workers don't support dynamic imports of regular scripts
// This would need to be adapted for actual Chrome deployment

class BackgroundService {
    constructor() {
        this.tabResults = new Map();
        this.apiEndpoints = new Map(); // Store API endpoints per tab
        this.settings = null;
        this.requestHeadersCache = new Map(); // Cache for capturing full headers including cookies

        this.init();
    }

    init() {
        console.log('🔧 Background service worker initializing...');

        // Set up listeners immediately (Synchronous)
        this.setupMessageListeners();
        this.setupStorageListeners();
        this.setupTabListeners();

        // Load settings (Async)
        this.loadSettings().then(() => {
            console.log('✅ Background service worker ready');
        });
    }


    async loadSettings() {
        try {
            const api = typeof browser !== 'undefined' ? browser : chrome;
            const result = await api.storage.local.get('userSettings');
            this.settings = result.userSettings || this.getDefaultSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            enabledCategories: ['aws', 'github', 'api-keys', 'databases', 'certificates'],
            riskThreshold: 'medium',
            enableNotifications: true,
            enableHighlighting: false,
            enableSoundAlerts: false,
            scanDelay: 1000,
            trustedDomains: [],
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
                    await this.handleScanComplete(message.data, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

                case 'GET_SETTINGS':
                    sendResponse({ settings: this.settings });
                    break;

                case 'UPDATE_SETTINGS':
                    await this.updateSettings(message.data);
                    sendResponse({ success: true });
                    break;

                case 'GET_TAB_RESULTS':
                    const results = this.tabResults.get(sender.tab?.id) || [];
                    sendResponse({ results });
                    break;

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
                    this.handleApiCall(message.data, sender.tab?.id);
                    sendResponse({ success: true });
                    break;

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

    async handleScanComplete(scanData, tabId) {
        if (!tabId) return;

        // Store results for this tab
        const existingResults = this.tabResults.get(tabId) || [];
        const newResults = [...existingResults, ...scanData.findings];
        this.tabResults.set(tabId, newResults);

        // Show notifications for high-risk findings
        if (this.settings.enableNotifications) {
            const highRiskFindings = scanData.findings.filter(
                f => f.riskLevel === 'critical' || f.riskLevel === 'high'
            );

            if (highRiskFindings.length > 0) {
                await this.showNotification({
                    type: 'credential_detected',
                    title: '🚨 Credentials Detected',
                    message: `Found ${highRiskFindings.length} high-risk credential(s)`,
                    findings: highRiskFindings
                });
            }
        }

        // Update badge with finding count
        await this.updateBadge(tabId, newResults.length);
    }

    handleApiCall(apiData, tabId) {
        if (!tabId) return;

        const currentEndpoints = this.apiEndpoints.get(tabId) || [];

        // Check if we already have this endpoint (deduplication)
        // We consider an endpoint unique by Method + URL
        const exists = currentEndpoints.some(e => e.method === apiData.method && e.url === apiData.url);

        if (!exists) {
            // Try to get full headers from cache (including cookies)
            const cacheKey = `${apiData.method}:${apiData.url}`;
            const cachedHeaders = this.requestHeadersCache.get(cacheKey);

            console.log(`🔍 [API] Looking for cached headers: ${cacheKey}`);
            console.log(`🔍 [API] Cache has entry: ${!!cachedHeaders}`);
            console.log(`🔍 [API] Current cache size: ${this.requestHeadersCache.size}`);

            if (cachedHeaders) {
                const hadCookie = Object.keys(apiData.headers || {}).some(k => k.toLowerCase() === 'cookie');

                // Merge captured headers with webRequest headers (webRequest takes precedence)
                apiData.headers = { ...apiData.headers, ...cachedHeaders };

                const nowHasCookie = Object.keys(apiData.headers).some(k => k.toLowerCase() === 'cookie');
                console.log(`✅ [API] Merged headers from webRequest for ${cacheKey}`);
                console.log(`🍪 [API] Cookie before merge: ${hadCookie}, after merge: ${nowHasCookie}`);

                // Clean up cache entry after use
                this.requestHeadersCache.delete(cacheKey);
            } else {
                console.log(`⚠️ [API] No cached headers found for ${cacheKey} - may have timed out or not captured yet`);
            }

            currentEndpoints.push(apiData);
            this.apiEndpoints.set(tabId, currentEndpoints);

            // Notify any open API Explorer tabs about the new endpoint
            this.notifyExplorerTabs(tabId, apiData);
        }
    }

    /**
     * Cache request headers captured from webRequest
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     * @param {Object} headers - Headers object from webRequest
     */
    cacheRequestHeaders(method, url, headers) {
        const cacheKey = `${method}:${url}`;

        // Convert headers array to object
        const headersObj = {};
        if (Array.isArray(headers)) {
            headers.forEach(h => {
                headersObj[h.name] = h.value;
            });
        }

        // Check if Cookie header is present
        const hasCookie = Object.keys(headersObj).some(k => k.toLowerCase() === 'cookie');
        console.log(`📦 [CACHE] Storing headers for ${cacheKey} - Cookie present: ${hasCookie}`);
        if (hasCookie) {
            console.log(`🍪 [CACHE] Cookie value: ${headersObj['Cookie'] || headersObj['cookie']}`);
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
            console.log(`🔍 [Background] Starting unused endpoint scan for tab ${targetTabId}`);

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

            console.log(`✅ [Background] Scan complete. Found ${scanResponse.total} potential endpoints`);

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

            console.log(`📊 [Background] Analysis: ${unused.length} unused, ${used.length} used`);

            return {
                success: true,
                discovered: scanResponse.discovered,
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
                // Check if this is an explorer page for the source tab
                if (tab.url && tab.url.includes('popup/explorer.html') && tab.url.includes(`tabId=${sourceTabId}`)) {
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
        try {
            console.log('🔄 [Background] Forwarding proxy request to Content Script');
            console.log('🔄 [Background] Request data:', requestData);
            console.log('🔄 [Background] Target tab ID:', specifiedTabId);
            const api = typeof browser !== 'undefined' ? browser : chrome;

            let activeTab;

            if (specifiedTabId) {
                try {
                    activeTab = await api.tabs.get(specifiedTabId);
                    console.log('✅ [Background] Found specified tab:', activeTab.id, activeTab.url);
                } catch (e) {
                    console.warn(`⚠️ [Background] Specified tab ${specifiedTabId} not found:`, e.message);
                }
            }

            if (!activeTab) {
                // Find the active tab to execute the request in
                const tabs = await api.tabs.query({ active: true, currentWindow: true });
                if (!tabs || tabs.length === 0) {
                    console.error('❌ [Background] No active tab found');
                    throw new Error('No active tab found to execute request');
                }
                activeTab = tabs[0];
                console.log('📍 [Background] Using active tab:', activeTab.id, activeTab.url);
            }

            console.log(`🎯 [Background] Target Tab: ID=${activeTab.id}, URL=${activeTab.url}`);

            // Check if URL is restricted (no content script)
            if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:') || activeTab.url.startsWith('moz-extension://')) {
                console.warn('⚠️ [Background] Target tab is a restricted page. Content script likely missing.');
                throw new Error('Cannot inject content script into restricted page');
            }

            // Helper to send message
            const sendMessageToTab = async () => {
                console.log('📤 [Background] Sending executeRequest to tab', activeTab.id);
                const response = await api.tabs.sendMessage(activeTab.id, {
                    action: 'executeRequest',
                    data: requestData
                });
                console.log('📥 [Background] Received response from content script:', response);
                return response;
            };

            try {
                // Try sending message first
                const result = await sendMessageToTab();
                console.log('✅ [Background] Proxy request successful');
                return result;
            } catch (error) {
                console.error('❌ [Background] sendMessage failed:', error.message);

                // Check if error is "Receiving end does not exist" or similar
                const isConnectionError = error.message.includes('Receiving end does not exist') ||
                    error.message.includes('Could not establish connection');

                if (isConnectionError && !activeTab.url.startsWith('about:') && !activeTab.url.startsWith('chrome')) {
                    console.log('⚠️ [Background] Content script disconnected. Attempting lazy injection...');

                    // Inject script dependencies in order
                    const scripts = [
                        "config/patterns.js",
                        "utils/storage.js",
                        "utils/context.js",
                        "utils/bucket-parser.js",
                        "utils/bucket-tester.js",
                        "utils/settings.js",
                        "utils/scanner.js",
                        "content.js"
                    ];

                    for (const file of scripts) {
                        try {
                            console.log(`💉 [Background] Injecting ${file}...`);
                            if (api.scripting) {
                                await api.scripting.executeScript({
                                    target: { tabId: activeTab.id },
                                    files: [file]
                                });
                            } else {
                                // MV2 fallback
                                await api.tabs.executeScript(activeTab.id, { file: file });
                            }
                        } catch (injectError) {
                            console.error(`❌ [Background] Failed to inject ${file}:`, injectError);
                        }
                    }

                    // Wait a moment for script to init
                    await new Promise(r => setTimeout(r, 500));

                    console.log('🔄 [Background] Retrying proxy request after injection...');
                    const result = await sendMessageToTab();
                    console.log('✅ [Background] Retry successful');
                    return result;

                } else {
                    throw error;
                }
            }

        } catch (error) {
            console.error('❌ [Background] Proxy forwarding failed:', error);
            return {
                success: false,
                error: `Proxy Error: ${error.message}`
            };
        }
    }


    async updateSettings(newSettings) {

        // Validate settings before updating
        const validatedSettings = this.validateSettings(newSettings);
        this.settings = { ...this.settings, ...validatedSettings };

        try {
            await chrome.storage.local.set({ userSettings: this.settings });

            // Broadcast settings update to all tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'SETTINGS_UPDATED',
                        data: this.settings
                    });
                } catch (error) {
                    // Tab might not have content script, ignore
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
            if (namespace === 'local' && changes.userSettings) {
                this.settings = changes.userSettings.newValue;
                console.log('Settings updated from storage');
            }
        });
    }

    setupTabListeners() {
        // Clear results when tab is removed
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.tabResults.delete(tabId);
            this.apiEndpoints.delete(tabId);
        });


        // Clear badge when tab is updated (navigation)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'loading') {
                this.tabResults.delete(tabId);
                this.apiEndpoints.delete(tabId);
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
                // Tab might be closed, skip
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
    console.log('🔧 Service worker installing...');
    self.skipWaiting(); // Immediately activate new service worker
});

self.addEventListener('activate', (event) => {
    console.log('✅ Service worker activated');
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
            console.log('✅ [TOP-LEVEL] Setting up webRequest listeners');

            // Listener 1: Capture ALL request headers (including cookies) for API discovery
            webRequest.onBeforeSendHeaders.addListener(
                (details) => {
                    // Skip extension internal requests
                    if (details.url.startsWith('chrome-extension://') || details.url.startsWith('moz-extension://')) {
                        return;
                    }

                    // Skip non-XHR/Fetch requests (only capture API calls)
                    if (details.type !== 'xmlhttprequest' && details.type !== 'fetch' && details.type !== 'other') {
                        console.log(`⏭️ [HEADERS] Skipping non-API request type: ${details.type} for ${details.url}`);
                        return;
                    }

                    console.log(`🎯 [HEADERS] Intercepted ${details.type} request: ${details.method} ${details.url}`);

                    // Check for Cookie header in this request
                    const hasCookie = details.requestHeaders?.some(h => h.name.toLowerCase() === 'cookie');
                    console.log(`🍪 [HEADERS] Cookie present in webRequest: ${hasCookie}`);

                    // Cache the full headers for this request
                    if (backgroundService && backgroundService.cacheRequestHeaders) {
                        backgroundService.cacheRequestHeaders(details.method, details.url, details.requestHeaders);
                        console.log(`📦 [HEADERS] Cached headers for ${details.method} ${details.url}`);
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
                            console.log('🎯 [PROXY] Intercepted request with marker:', details.url);
                            break;
                        }
                    }

                    // Check if this URL is in our active proxy list (for Preflight/OPTIONS)
                    const isTarget = activeProxyTargets.has(details.url);

                    if (hasProxyMarker || isTarget) {
                        const targetUrl = new URL(details.url);
                        const origin = targetUrl.origin;

                        if (isTarget && !hasProxyMarker) {
                            console.log(`🔎 [PROXY] Intercepted Preflight/Related request: ${details.method} ${details.url}`);
                        }

                        // Rewrite Origin
                        let originFound = false;
                        for (const h of headers) {
                            if (h.name.toLowerCase() === 'origin') {
                                console.log(`🔄 [PROXY] Rewriting Origin: ${h.value} -> ${origin}`);
                                h.value = origin;
                                originFound = true;
                            } else if (h.name.toLowerCase() === 'referer') {
                                console.log(`🔄 [PROXY] Rewriting Referer: ${h.value} -> ${targetUrl.href}`);
                                h.value = targetUrl.href;
                            }
                        }

                        if (!originFound) {
                            console.log(`➕ [PROXY] Adding Origin: ${origin}`);
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
    console.log('🚀 Extension startup');
    if (!backgroundService) {
        backgroundService = new BackgroundService();
    }
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log('📦 Extension installed/updated:', details.reason);
    if (!backgroundService) {
        backgroundService = new BackgroundService();
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackgroundService, ChromeAPIAdapter };
}
