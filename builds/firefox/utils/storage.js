/**
 * Storage utilities for managing extension settings and data
 */

/**
 * Default settings for the extension
 */
const DEFAULT_SETTINGS = {
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
    enableDynamicScanning: false, // New setting
    debugMode: false
};

/**
 * Gets a setting value or returns default
 * @param {string} key - Setting key (supports dot notation like 'enabledCategories.aws')
 * @param {any} defaultValue - Default value if setting not found
 * @returns {any} Setting value
 */
function getSetting(key, defaultValue = null) {
    try {
        // For browser environment, use localStorage as fallback
        if (typeof browser !== 'undefined' && browser.storage) {
            // This would be async in real implementation
            return defaultValue || getNestedValue(DEFAULT_SETTINGS, key);
        } else if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('cyberlabs-scanner-settings');
            const settings = stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
            return getNestedValue(settings, key) || defaultValue;
        }
    } catch (error) {
        console.error('Error getting setting:', key, error);
    }
    
    return getNestedValue(DEFAULT_SETTINGS, key) || defaultValue;
}

/**
 * Sets a setting value
 * @param {string} key - Setting key (supports dot notation)
 * @param {any} value - Value to set
 * @returns {Promise<boolean>} Success status
 */
async function setSetting(key, value) {
    try {
        // For browser environment
        if (typeof browser !== 'undefined' && browser.storage) {
            const result = await browser.storage.local.get('settings');
            const settings = result.settings || { ...DEFAULT_SETTINGS };
            setNestedValue(settings, key, value);
            await browser.storage.local.set({ settings });
            return true;
        } else if (typeof localStorage !== 'undefined') {
            // Fallback to localStorage
            const stored = localStorage.getItem('cyberlabs-scanner-settings');
            const settings = stored ? JSON.parse(stored) : { ...DEFAULT_SETTINGS };
            setNestedValue(settings, key, value);
            localStorage.setItem('cyberlabs-scanner-settings', JSON.stringify(settings));
            return true;
        }
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
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('cyberlabs-scanner-settings');
            return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
        }
    } catch (error) {
        console.error('Error getting all settings:', error);
    }
    
    return { ...DEFAULT_SETTINGS };
}

/**
 * Resets all settings to defaults
 * @returns {Promise<boolean>} Success status
 */
async function resetSettings() {
    try {
        if (typeof browser !== 'undefined' && browser.storage) {
            await browser.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
            return true;
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem('cyberlabs-scanner-settings', JSON.stringify(DEFAULT_SETTINGS));
            return true;
        }
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
    return whitelist.some(pattern => {
        // Support wildcards
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
        return regex.test(domain);
    });
}

/**
 * Checks if a pattern category is enabled
 * @param {string} category - Category name (e.g., 'aws', 'github')
 * @returns {boolean} True if enabled
 */
function isCategoryEnabled(category) {
    return getSetting(`enabledCategories.${category}`, true);
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
        isDomainWhitelisted,
        isCategoryEnabled
    };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.StorageUtils = {
        DEFAULT_SETTINGS,
        getSetting,
        setSetting,
        getAllSettings,
        resetSettings,
        isDomainWhitelisted,
        isCategoryEnabled
    };
}
