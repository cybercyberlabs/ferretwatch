/**
 * Storage utilities for managing extension settings and data
 */

// Cache for debugMode setting (loaded asynchronously at startup)
let cachedDebugMode = false;

// Load debugMode from storage on initialization
(async () => {
    try {
        const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
        if (api && api.storage) {
            const result = await api.storage.local.get('debugMode');
            cachedDebugMode = result.debugMode || false;
        }
    } catch (e) {
        // Storage API not available during initialization - use default value
        console.debug('Could not load debugMode from storage:', e.message);
        cachedDebugMode = false;
    }
})();

// Listen for debugMode changes
function watchStorage(api) {
    if (!api || !api.storage || !api.storage.onChanged) {
        return;
    }
    api.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') {
            return;
        }
        if (changes.settings && changes.settings.newValue) {
            applySettings(changes.settings.newValue);
        } else if (changes.debugMode) {
            cachedDebugMode = changes.debugMode.newValue || false;
        }
    });
}
watchStorage(typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

let settingsCache = null;
let settingsReady = null;

function extensionApi() {
    if (typeof browser !== 'undefined' && browser.storage) {
        return browser;
    }
    if (typeof chrome !== 'undefined' && chrome.storage) {
        return chrome;
    }
    return null;
}

function contracts() {
    if (typeof FerretWatchContracts !== 'undefined') {
        return FerretWatchContracts;
    }
    if (typeof window !== 'undefined' && window.FerretWatchContracts) {
        return window.FerretWatchContracts;
    }
    return null;
}

/**
 * Default settings for the extension. Categories match config/patterns.js.
 */
const DEFAULT_SETTINGS = contracts() ? contracts().defaultSettings() : {
    // Pattern toggles
    enabledCategories: {
        aws: true,
        github: true,
        slack: true,
        discord: true,
        apiKeys: true,
        database: true,
        auth: true,
        ssh: true,
        passwords: true
    },
    
    // Scanning preferences
    scanningMode: 'progressive', // 'progressive' | 'full' | 'visible-only'
    scanDelay: 500, // milliseconds
    enableDebounce: true,
    
    // Notification preferences
    showNotifications: true,
    notificationDuration: 8000, // milliseconds
    notificationPosition: 'top-right', // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    playSound: false,
    
    // Sensitivity settings
    entropyThreshold: 3.5,
    minimumSecretLength: 10,
    enableContextFiltering: true,
    
    // Domain management
    whitelistedDomains: [],
    blacklistedDomains: [],
    
    // Advanced settings
    maxFindings: 10,
    enableHighlighting: false,
    debugMode: false,

    // Bucket scanning settings
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

/**
 * Gets a setting value or returns default
 * @param {string} key - Setting key (supports dot notation like 'enabledCategories.aws')
 * @param {any} defaultValue - Default value if setting not found
 * @returns {any} Setting value
 */
function activeSettings() {
    return settingsCache || DEFAULT_SETTINGS;
}

async function loadExtensionSettings() {
    const api = extensionApi();
    const lib = contracts();
    if (!api) {
        settingsCache = lib ? lib.defaultSettings() : { ...DEFAULT_SETTINGS };
        return settingsCache;
    }
    const stored = await api.storage.local.get(['settings', 'userSettings', 'whitelistedDomains', 'debugMode']);
    settingsCache = lib ? lib.migrateStoredSettings(stored) : { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
    cachedDebugMode = !!settingsCache.debugMode;
    if (!stored.settings) {
        await api.storage.local.set({ settings: settingsCache });
    }
    return settingsCache;
}

function ensureSettings() {
    if (!settingsReady) {
        settingsReady = loadExtensionSettings().catch((error) => {
            console.debug('Could not load extension settings:', error.message);
            settingsCache = contracts() ? contracts().defaultSettings() : { ...DEFAULT_SETTINGS };
            return settingsCache;
        });
    }
    return settingsReady;
}

function applySettings(next) {
    const lib = contracts();
    settingsCache = lib ? lib.migrateStoredSettings({ settings: next }) : { ...DEFAULT_SETTINGS, ...next };
    cachedDebugMode = !!settingsCache.debugMode;
    settingsReady = Promise.resolve(settingsCache);
    return settingsCache;
}

function getSetting(key, defaultValue = null) {
    if (key === 'debugMode' && settingsCache == null) {
        return cachedDebugMode;
    }
    const value = getNestedValue(activeSettings(), key);
    if (value !== undefined) {
        return value;
    }
    return defaultValue !== null ? defaultValue : getNestedValue(DEFAULT_SETTINGS, key);
}

/**
 * Sets a setting value
 * @param {string} key - Setting key (supports dot notation)
 * @param {any} value - Value to set
 * @returns {Promise<boolean>} Success status
 */
async function setSetting(key, value) {
    try {
        const api = extensionApi();
        const settings = { ...activeSettings() };
        setNestedValue(settings, key, value);
        applySettings(settings);
        if (api) {
            await api.storage.local.set({ settings: settingsCache });
        }
        return true;
    } catch (error) {
        console.error('Error setting value:', key, error);
    }
    return false;
}

/**
 * Gets all settings
 * @returns {object} All settings
 */
function getAllSettings() {
    return { ...activeSettings() };
}

/**
 * Resets all settings to defaults
 * @returns {Promise<boolean>} Success status
 */
async function resetSettings() {
    try {
        const api = extensionApi();
        applySettings(contracts() ? contracts().defaultSettings() : { ...DEFAULT_SETTINGS });
        if (api) {
            await api.storage.local.set({ settings: settingsCache });
        }
        return true;
    } catch (error) {
        console.error('Error resetting settings:', error);
    }
    return false;
}

/**
 * Checks if a domain is whitelisted (should skip scanning)
 * @param {string} domain - Domain to check
 * @returns {boolean} True if whitelisted
 */
function isDomainWhitelisted(domain) {
    const whitelist = getSetting('whitelistedDomains', []);
    const lib = contracts();
    if (lib) {
        return lib.hostMatchesWhitelist(domain, whitelist);
    }
    return Array.isArray(whitelist) && whitelist.indexOf(domain) !== -1;
}

/**
 * Checks if a pattern category is enabled
 * @param {string} category - Category name (e.g., 'aws', 'github')
 * @returns {boolean} True if enabled
 */
function isCategoryEnabled(category) {
    return getSetting(`enabledCategories.${category}`, true);
}

/**
 * Checks if bucket scanning is enabled
 * @returns {boolean} True if bucket scanning is enabled
 */
function isBucketScanningEnabled() {
    return getSetting('cloudBucketScanning.enabled', true);
}

/**
 * Checks if a specific cloud provider is enabled for bucket scanning
 * @param {string} provider - Provider name (aws, gcp, azure, digitalocean, alibaba)
 * @returns {boolean} True if provider is enabled
 */
function isProviderEnabled(provider) {
    return getSetting(`cloudBucketScanning.providers.${provider}`, true);
}

/**
 * Gets bucket scanning settings
 * @returns {object} Bucket scanning settings
 */
function getBucketScanningSettings() {
    return getSetting('cloudBucketScanning', DEFAULT_SETTINGS.cloudBucketScanning);
}

// Helper functions for nested object access
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_SETTINGS,
        getSetting,
        setSetting,
        getAllSettings,
        resetSettings,
        loadExtensionSettings,
        ensureSettings,
        applySettings,
        isDomainWhitelisted,
        isCategoryEnabled,
        isBucketScanningEnabled,
        isProviderEnabled,
        getBucketScanningSettings
    };
}

// Firefox content scripts keep window (the page) separate from globalThis
// (the sandbox). Publish on both so either lookup finds the same object.
const storageApi = {
    DEFAULT_SETTINGS,
    getSetting,
    setSetting,
    getAllSettings,
    resetSettings,
    loadExtensionSettings,
    ensureSettings,
    applySettings,
    isDomainWhitelisted,
    isCategoryEnabled,
    isBucketScanningEnabled,
    isProviderEnabled,
    getBucketScanningSettings
};
if (typeof globalThis !== 'undefined') {
    globalThis.StorageUtils = storageApi;
}
if (typeof window !== 'undefined') {
    window.StorageUtils = storageApi;
}
