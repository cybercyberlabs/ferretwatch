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
        this.settings = null;
        this.init();
    }

    async init() {
        console.log('🔧 Background service worker initializing...');
        
        // Load settings
        await this.loadSettings();
        
        // Set up listeners
        this.setupMessageListeners();
        this.setupStorageListeners();
        this.setupTabListeners();
        
        console.log('✅ Background service worker ready');
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get('userSettings');
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
        });

        // Clear badge when tab is updated (navigation)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'loading') {
                this.tabResults.delete(tabId);
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

// Initialize background service
let backgroundService = null;

// Initialize when service worker starts
if (isChromeExtension()) {
    backgroundService = new BackgroundService();
} else {
    console.error('❌ Not running in Chrome extension context');
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
