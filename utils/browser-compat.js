/**
 * Cross-browser compatibility utilities
 * Handles API differences between Firefox, Chrome, and other browsers
 */

class BrowserCompat {
    constructor() {
        this.browser = this.detectBrowser();
        this.manifestVersion = this.getManifestVersion();
        this.api = this.getExtensionAPI();
    }

    /**
     * Detects the current browser environment
     * @returns {string} Browser name
     */
    detectBrowser() {
        // Check for browser-specific objects
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo) {
            return 'firefox';
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            return 'chrome';
        } else if (typeof browser !== 'undefined' && browser.runtime) {
            return 'edge'; // Edge uses browser namespace
        } else {
            return 'unknown';
        }
    }

    /**
     * Gets the manifest version being used
     * @returns {number} Manifest version (2 or 3)
     */
    getManifestVersion() {
        try {
            if (this.api && this.api.runtime && this.api.runtime.getManifest) {
                const manifest = this.api.runtime.getManifest();
                return manifest?.manifest_version || 2;
            } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
                const manifest = chrome.runtime.getManifest();
                return manifest?.manifest_version || 3;
            }
            return 2; // Default to v2 for testing
        } catch (error) {
            return 2; // Default to v2
        }
    }

    /**
     * Gets the appropriate extension API
     * @returns {Object} Extension API object
     */
    getExtensionAPI() {
        if (typeof browser !== 'undefined') {
            return browser; // Firefox/Edge
        } else if (typeof chrome !== 'undefined') {
            return this.createChromePromiseAPI(); // Chrome with promises
        } else {
            // Node.js or test environment - return null, will be mocked
            console.warn('No extension API available - running in test/Node.js environment');
            return null;
        }
    }

    /**
     * Creates a Promise-based API wrapper for Chrome
     * @returns {Object} Promise-wrapped Chrome API
     */
    createChromePromiseAPI() {
        const promiseAPI = {
            runtime: {
                sendMessage: (...args) => new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(...args, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                }),
                onMessage: chrome.runtime.onMessage,
                getURL: chrome.runtime.getURL.bind(chrome.runtime),
                getManifest: chrome.runtime.getManifest.bind(chrome.runtime),
                id: chrome.runtime.id
            },
            storage: {
                local: {
                    get: (keys) => new Promise((resolve, reject) => {
                        chrome.storage.local.get(keys, (result) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(result);
                            }
                        });
                    }),
                    set: (items) => new Promise((resolve, reject) => {
                        chrome.storage.local.set(items, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    }),
                    remove: (keys) => new Promise((resolve, reject) => {
                        chrome.storage.local.remove(keys, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    }),
                    clear: () => new Promise((resolve, reject) => {
                        chrome.storage.local.clear(() => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    })
                },
                onChanged: chrome.storage.onChanged
            },
            tabs: {
                query: (queryInfo) => new Promise((resolve, reject) => {
                    chrome.tabs.query(queryInfo, (tabs) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(tabs);
                        }
                    });
                }),
                sendMessage: (tabId, message) => new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tabId, message, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                }),
                onUpdated: chrome.tabs.onUpdated,
                onRemoved: chrome.tabs.onRemoved
            },
            notifications: {
                create: (notificationId, options) => new Promise((resolve, reject) => {
                    // Handle both create(options) and create(id, options) signatures
                    if (typeof notificationId === 'string') {
                        chrome.notifications.create(notificationId, options, (id) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(id);
                            }
                        });
                    } else {
                        chrome.notifications.create(notificationId, (id) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(id);
                            }
                        });
                    }
                }),
                clear: (notificationId) => new Promise((resolve, reject) => {
                    chrome.notifications.clear(notificationId, (wasCleared) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(wasCleared);
                        }
                    });
                })
            }
        };

        // Add action API (Manifest V3) or browserAction API (Manifest V2)
        // Use bracket notation to avoid static analysis warnings in Firefox for Manifest V3 APIs
        try {
            const actionAPI = chrome['action'];
            if (typeof chrome !== 'undefined' && actionAPI && typeof actionAPI.setBadgeText === 'function') {
                // Manifest V3
                promiseAPI.action = {
                    setBadgeText: (details) => new Promise((resolve, reject) => {
                        actionAPI.setBadgeText(details, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    }),
                    setBadgeBackgroundColor: (details) => new Promise((resolve, reject) => {
                        actionAPI.setBadgeBackgroundColor(details, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    })
                };
            }
        } catch (e) {
            // chrome.action not available, will use browserAction fallback
        }

        if (typeof chrome !== 'undefined' && chrome.browserAction && typeof chrome.browserAction.setBadgeText === 'function') {
            // Manifest V2
            promiseAPI.browserAction = {
                setBadgeText: (details) => new Promise((resolve, reject) => {
                    chrome.browserAction.setBadgeText(details, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                }),
                setBadgeBackgroundColor: (details) => new Promise((resolve, reject) => {
                    chrome.browserAction.setBadgeBackgroundColor(details, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                })
            };
        }

        return promiseAPI;
    }

    /**
     * Gets browser-specific configuration
     * @returns {Object} Browser configuration
     */
    getBrowserConfig() {
        return {
            browser: this.browser,
            manifestVersion: this.manifestVersion,
            supportsServiceWorkers: this.browser === 'chrome' && this.manifestVersion === 3,
            supportsBackgroundPages: this.browser === 'firefox' || this.manifestVersion === 2,
            maxStorageSize: this.browser === 'firefox' ? 10485760 : 5242880, // 10MB vs 5MB
            storageAPI: this.manifestVersion === 3 ? 'local' : 'sync',
            notificationAPI: this.browser === 'firefox' ? 'webNotifications' : 'chromeNotifications'
        };
    }

    /**
     * Sends a cross-browser message
     * @param {string} type Message type
     * @param {Object} data Message data
     * @param {number} tabId Optional tab ID
     * @returns {Promise<Object>} Response
     */
    async sendMessage(type, data = {}, tabId = null) {
        const message = { type, data, timestamp: Date.now() };

        try {
            if (tabId) {
                return await this.api.tabs.sendMessage(tabId, message);
            } else {
                return await this.api.runtime.sendMessage(message);
            }
        } catch (error) {
            console.error(`Failed to send message (${type}):`, error);
            throw error;
        }
    }

    /**
     * Gets cross-browser storage
     * @param {string|Array} keys Storage keys
     * @returns {Promise<Object>} Storage data
     */
    async getStorage(keys) {
        try {
            return await this.api.storage.local.get(keys);
        } catch (error) {
            console.error('Storage get failed:', error);
            return {};
        }
    }

    /**
     * Sets cross-browser storage
     * @param {Object} items Items to store
     * @returns {Promise<void>}
     */
    async setStorage(items) {
        try {
            await this.api.storage.local.set(items);
        } catch (error) {
            console.error('Storage set failed:', error);
            throw error;
        }
    }

    /**
     * Shows cross-browser notification
     * @param {Object} options Notification options
     * @returns {Promise<string>} Notification ID
     */
    async showNotification(options) {
        const notificationOptions = {
            type: 'basic',
            iconUrl: this.api.runtime.getURL('icons/icon-48.png'),
            title: options.title || 'Credential Scanner',
            message: options.message || '',
            ...options
        };

        try {
            return await this.api.notifications.create(notificationOptions);
        } catch (error) {
            console.error('Notification failed:', error);
            // Fallback for browsers without notification support
            console.log(`📢 ${options.title}: ${options.message}`);
            return null;
        }
    }

    /**
     * Updates extension badge
     * @param {string} text Badge text
     * @param {string} color Badge color
     * @param {number} tabId Optional tab ID
     * @returns {Promise<void>}
     */
    async updateBadge(text, color = '#dc3545', tabId = null) {
        try {
            const badgeAPI = this.api.action || this.api.browserAction;
            if (!badgeAPI) return;

            const details = { text, ...(tabId && { tabId }) };
            const colorDetails = { color, ...(tabId && { tabId }) };

            await badgeAPI.setBadgeText(details);
            await badgeAPI.setBadgeBackgroundColor(colorDetails);
        } catch (error) {
            console.error('Badge update failed:', error);
        }
    }

    /**
     * Gets current active tab
     * @returns {Promise<Object>} Active tab
     */
    async getActiveTab() {
        try {
            const tabs = await this.api.tabs.query({ active: true, currentWindow: true });
            return tabs[0] || null;
        } catch (error) {
            console.error('Get active tab failed:', error);
            return null;
        }
    }

    /**
     * Handles manifest version differences
     * @param {Object} v2Config Manifest V2 configuration
     * @param {Object} v3Config Manifest V3 configuration
     * @returns {Object} Appropriate configuration
     */
    getManifestConfig(v2Config, v3Config) {
        return this.manifestVersion === 3 ? v3Config : v2Config;
    }

    /**
     * Feature detection for browser capabilities
     * @returns {Object} Available features
     */
    getFeatureSupport() {
        return {
            serviceWorkers: this.manifestVersion === 3 && this.browser === 'chrome',
            persistentBackground: this.browser === 'firefox',
            dynamicContentScripts: this.manifestVersion === 3,
            webAccessibleResources: true,
            declarativeNetRequest: this.manifestVersion === 3,
            notifications: !!this.api.notifications,
            storage: !!this.api.storage,
            tabs: !!this.api.tabs,
            contextMenus: !!this.api.contextMenus,
            webNavigation: !!this.api.webNavigation
        };
    }

    /**
     * Gets recommended settings for the current browser
     * @returns {Object} Recommended settings
     */
    getRecommendedSettings() {
        const base = {
            enabledCategories: ['aws', 'github', 'api-keys', 'databases', 'certificates'],
            riskThreshold: 'medium',
            enableNotifications: true,
            enableHighlighting: false,
            scanDelay: 1000
        };

        // Browser-specific optimizations
        switch (this.browser) {
            case 'firefox':
                return {
                    ...base,
                    enableHighlighting: true, // Firefox handles DOM manipulation better
                    scanDelay: 500 // Faster scanning in Firefox
                };
            
            case 'chrome':
                return {
                    ...base,
                    enableHighlighting: false, // More conservative for Chrome
                    scanDelay: 1000 // Standard delay for Chrome
                };
                
            default:
                return base;
        }
    }
}

// Create global instance only in browser environment
let browserCompat = null;
if (typeof window !== 'undefined' || typeof chrome !== 'undefined' || typeof browser !== 'undefined') {
    browserCompat = new BrowserCompat();
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BrowserCompat, browserCompat };
} else if (typeof window !== 'undefined') {
    window.BrowserCompat = BrowserCompat;
    window.browserCompat = browserCompat;
} else {
    // Service worker or other contexts
    self.BrowserCompat = BrowserCompat;
    self.browserCompat = browserCompat;
}

// Browser compatibility initialized (logging removed to reduce console spam)
