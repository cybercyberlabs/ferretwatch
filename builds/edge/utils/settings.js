/**
 * Settings utility for managing bucket scanning configuration
 * Provides centralized access to bucket scanning settings with validation
 */

class BucketScanningSettings {
    constructor() {
        this.defaultSettings = {
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
            testPublicAccess: true,
            // Performance optimization settings
            cacheTimeout: 300000, // 5 minutes
            throttleDelay: 100, // 100ms between requests
            enableCaching: true,
            enableThrottling: true,
            adaptiveConcurrency: true,
            maxCacheSize: 1000
        };
    }

    /**
     * Get bucket scanning settings from storage or return defaults
     * @returns {Promise<Object>} Bucket scanning settings
     */
    async getBucketScanningSettings() {
        try {
            const result = await browser.storage.local.get(['userSettings']);
            const userSettings = result.userSettings || {};
            
            if (userSettings.cloudBucketScanning) {
                return this.validateSettings(userSettings.cloudBucketScanning);
            }
            
            return this.defaultSettings;
        } catch (error) {
            console.warn('Failed to load bucket scanning settings:', error);
            return this.defaultSettings;
        }
    }

    /**
     * Update bucket scanning settings in storage
     * @param {Object} newSettings - New settings to merge
     * @returns {Promise<void>}
     */
    async updateBucketScanningSettings(newSettings) {
        try {
            const result = await browser.storage.local.get(['userSettings']);
            const userSettings = result.userSettings || {};
            
            const validatedSettings = this.validateSettings(newSettings);
            userSettings.cloudBucketScanning = {
                ...this.defaultSettings,
                ...userSettings.cloudBucketScanning,
                ...validatedSettings
            };
            
            await browser.storage.local.set({ userSettings });
            
            // Broadcast settings update
            if (typeof browser.runtime !== 'undefined' && browser.runtime.sendMessage) {
                browser.runtime.sendMessage({
                    type: 'UPDATE_SETTINGS',
                    data: userSettings
                });
            }
            
        } catch (error) {
            console.error('Failed to update bucket scanning settings:', error);
            throw error;
        }
    }

    /**
     * Check if bucket scanning is enabled
     * @returns {Promise<boolean>}
     */
    async isBucketScanningEnabled() {
        const settings = await this.getBucketScanningSettings();
        return settings.enabled === true;
    }

    /**
     * Check if a specific provider is enabled
     * @param {string} provider - Provider name (aws, gcp, azure, digitalocean, alibaba)
     * @returns {Promise<boolean>}
     */
    async isProviderEnabled(provider) {
        const settings = await this.getBucketScanningSettings();
        return settings.providers && settings.providers[provider] === true;
    }

    /**
     * Get timeout setting for bucket tests
     * @returns {Promise<number>} Timeout in milliseconds
     */
    async getTestTimeout() {
        const settings = await this.getBucketScanningSettings();
        return settings.testTimeout || 5000;
    }

    /**
     * Get maximum concurrent tests setting
     * @returns {Promise<number>} Maximum concurrent tests
     */
    async getMaxConcurrentTests() {
        const settings = await this.getBucketScanningSettings();
        return settings.maxConcurrentTests || 3;
    }

    /**
     * Check if public access testing is enabled
     * @returns {Promise<boolean>}
     */
    async isPublicAccessTestingEnabled() {
        const settings = await this.getBucketScanningSettings();
        return settings.testPublicAccess === true;
    }

    /**
     * Validate bucket scanning settings
     * @param {Object} settings - Settings to validate
     * @returns {Object} Validated settings
     */
    validateSettings(settings) {
        const validated = { ...settings };
        
        // Ensure enabled is boolean
        if (typeof validated.enabled !== 'boolean') {
            validated.enabled = true;
        }
        
        // Validate providers object
        if (!validated.providers || typeof validated.providers !== 'object') {
            validated.providers = { ...this.defaultSettings.providers };
        } else {
            // Ensure all provider values are boolean
            const validProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];
            validProviders.forEach(provider => {
                if (typeof validated.providers[provider] !== 'boolean') {
                    validated.providers[provider] = this.defaultSettings.providers[provider];
                }
            });
        }
        
        // Validate timeout (must be positive integer between 1000 and 30000)
        if (typeof validated.testTimeout !== 'number' || 
            validated.testTimeout < 1000 || 
            validated.testTimeout > 30000) {
            validated.testTimeout = this.defaultSettings.testTimeout;
        }
        
        // Validate max concurrent tests (must be positive integer between 1 and 10)
        if (typeof validated.maxConcurrentTests !== 'number' || 
            validated.maxConcurrentTests < 1 || 
            validated.maxConcurrentTests > 10) {
            validated.maxConcurrentTests = this.defaultSettings.maxConcurrentTests;
        }
        
        // Ensure testPublicAccess is boolean
        if (typeof validated.testPublicAccess !== 'boolean') {
            validated.testPublicAccess = this.defaultSettings.testPublicAccess;
        }

        // Validate performance optimization settings
        if (typeof validated.cacheTimeout !== 'number' || 
            validated.cacheTimeout < 60000 || 
            validated.cacheTimeout > 3600000) {
            validated.cacheTimeout = this.defaultSettings.cacheTimeout;
        }

        if (typeof validated.throttleDelay !== 'number' || 
            validated.throttleDelay < 0 || 
            validated.throttleDelay > 5000) {
            validated.throttleDelay = this.defaultSettings.throttleDelay;
        }

        if (typeof validated.enableCaching !== 'boolean') {
            validated.enableCaching = this.defaultSettings.enableCaching;
        }

        if (typeof validated.enableThrottling !== 'boolean') {
            validated.enableThrottling = this.defaultSettings.enableThrottling;
        }

        if (typeof validated.adaptiveConcurrency !== 'boolean') {
            validated.adaptiveConcurrency = this.defaultSettings.adaptiveConcurrency;
        }

        if (typeof validated.maxCacheSize !== 'number' || 
            validated.maxCacheSize < 100 || 
            validated.maxCacheSize > 10000) {
            validated.maxCacheSize = this.defaultSettings.maxCacheSize;
        }
        
        return validated;
    }

    /**
     * Reset bucket scanning settings to defaults
     * @returns {Promise<void>}
     */
    async resetToDefaults() {
        await this.updateBucketScanningSettings(this.defaultSettings);
    }

    /**
     * Get all available providers
     * @returns {Array<string>} Array of provider names
     */
    getAvailableProviders() {
        return ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];
    }

    /**
     * Get provider display names
     * @returns {Object} Mapping of provider keys to display names
     */
    getProviderDisplayNames() {
        return {
            aws: 'Amazon S3',
            gcp: 'Google Cloud Storage',
            azure: 'Azure Blob Storage',
            digitalocean: 'DigitalOcean Spaces',
            alibaba: 'Alibaba Cloud OSS'
        };
    }

    /**
     * Get cache timeout setting
     * @returns {Promise<number>} Cache timeout in milliseconds
     */
    async getCacheTimeout() {
        const settings = await this.getBucketScanningSettings();
        return settings.cacheTimeout || 300000;
    }

    /**
     * Get throttle delay setting
     * @returns {Promise<number>} Throttle delay in milliseconds
     */
    async getThrottleDelay() {
        const settings = await this.getBucketScanningSettings();
        return settings.throttleDelay || 100;
    }

    /**
     * Check if caching is enabled
     * @returns {Promise<boolean>}
     */
    async isCachingEnabled() {
        const settings = await this.getBucketScanningSettings();
        return settings.enableCaching !== false;
    }

    /**
     * Check if throttling is enabled
     * @returns {Promise<boolean>}
     */
    async isThrottlingEnabled() {
        const settings = await this.getBucketScanningSettings();
        return settings.enableThrottling !== false;
    }

    /**
     * Check if adaptive concurrency is enabled
     * @returns {Promise<boolean>}
     */
    async isAdaptiveConcurrencyEnabled() {
        const settings = await this.getBucketScanningSettings();
        return settings.adaptiveConcurrency !== false;
    }

    /**
     * Get maximum cache size
     * @returns {Promise<number>}
     */
    async getMaxCacheSize() {
        const settings = await this.getBucketScanningSettings();
        return settings.maxCacheSize || 1000;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BucketScanningSettings;
} else {
    window.BucketScanningSettings = BucketScanningSettings;
}