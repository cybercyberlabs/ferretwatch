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
            if (api.storage) {
                const result = await api.storage.local.get(['whitelistedDomains']);
                whitelistedDomains = result.whitelistedDomains || [];
                // Whitelist loaded successfully
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
        // Check user whitelist only (no built-in whitelist - root causes fixed)
        const isWhitelisted = whitelistedDomains.some(domain => {
            if (domain.startsWith('*.')) {
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            } else {
                return currentDomain === domain;
            }
        });
        // Domain whitelist check complete
        return isWhitelisted;
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

    // Expose public API
    window.FerretWatchWhitelist = {
        loadWhitelist,
        isDomainWhitelisted,
        getCurrentDomain,
        getWhitelistedDomains
    };

})();
