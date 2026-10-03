/**
 * Whitelist management for FerretWatch
 * Handles domain whitelisting to skip scanning on trusted domains
 */

(function() {
    'use strict';

    // Browser API reference
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // State
    let whitelistedDomains = [];
    const currentDomain = window.location.hostname;

    /**
     * Load whitelist from browser storage
     * @returns {Promise<string[]>} Array of whitelisted domains
     */
    async function loadWhitelist() {
        try {
            if (window.StorageUtils && window.StorageUtils.ensureSettings) {
                await window.StorageUtils.ensureSettings();
                whitelistedDomains = window.StorageUtils.getSetting('whitelistedDomains', []) || [];
                return whitelistedDomains;
            }
            if (api.storage) {
                const result = await api.storage.local.get(['settings', 'whitelistedDomains']);
                whitelistedDomains = (result.settings && result.settings.whitelistedDomains) || result.whitelistedDomains || [];
                return whitelistedDomains;
            }
        } catch (error) {
            // Could not load whitelist, using empty list
            whitelistedDomains = [];
        }
        return whitelistedDomains;
    }

    /**
     * Check if current domain is whitelisted
     * @returns {boolean} True if domain is whitelisted
     */
    function isDomainWhitelisted() {
        const contracts = globalThis.FerretWatchContracts || window.FerretWatchContracts;
        if (contracts) {
            return contracts.hostMatchesWhitelist(currentDomain, whitelistedDomains);
        }
        return whitelistedDomains.some(domain => {
            if (domain.startsWith('*.')) {
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            }
            return currentDomain === domain;
        });
    }

    /**
     * Get current domain
     * @returns {string} Current domain hostname
     */
    function getCurrentDomain() {
        return currentDomain;
    }

    /**
     * Get whitelisted domains
     * @returns {string[]} Array of whitelisted domains
     */
    function getWhitelistedDomains() {
        return [...whitelistedDomains];
    }

    if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.settings || changes.whitelistedDomains)) {
                loadWhitelist();
            }
        });
    }

    // Expose public API
    window.FerretWatchWhitelist = {
        loadWhitelist,
        isDomainWhitelisted,
        getCurrentDomain,
        getWhitelistedDomains
    };

})();
