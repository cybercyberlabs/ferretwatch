/**
 * Utility functions for FerretWatch content script
 */

(function() {
    'use strict';

    // Risk levels
    const RISK_LEVELS = {
        CRITICAL: 'critical',
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    };

    /**
     * Get color for risk level
     * @param {string} risk - Risk level (critical, high, medium, low)
     * @returns {string} Hex color code
     */
    function getRiskColor(risk) {
        const colors = {
            [RISK_LEVELS.CRITICAL]: '#ff1744',
            [RISK_LEVELS.HIGH]: '#ff5722',
            [RISK_LEVELS.MEDIUM]: '#ff9800',
            [RISK_LEVELS.LOW]: '#ffc107'
        };
        return colors[risk] || colors[RISK_LEVELS.MEDIUM];
    }

    /**
     * Get darker color for risk level (used for borders)
     * @param {string} risk - Risk level
     * @returns {string} Darker hex color code
     */
    function getDarkerRiskColor(risk) {
        const colors = {
            [RISK_LEVELS.CRITICAL]: '#d50000',
            [RISK_LEVELS.HIGH]: '#d84315',
            [RISK_LEVELS.MEDIUM]: '#e65100',
            [RISK_LEVELS.LOW]: '#f57c00'
        };
        return colors[risk] || colors[RISK_LEVELS.MEDIUM];
    }

    /**
     * Get icon for S3 bucket provider
     * @param {string} provider - Provider name (aws, gcp, azure, etc.)
     * @returns {string} Emoji icon
     */
    function getBucketProviderIcon(provider) {
        const icons = {
            aws: '☁️',
            gcp: '🌐',
            azure: '🔷',
            digitalocean: '💧',
            backblaze: '📦',
            wasabi: '🗄️',
            alibaba: '🐘',
            oracle: '🔴',
            unknown: '📁'
        };
        return icons[provider] || icons.unknown;
    }

    /**
     * Debug logging (only logs when debug mode is enabled)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function debugLog(message, ...args) {
        if (window.DEBUG_MODE) {
            console.log(`[FW Debug] ${message}`, ...args);
        }
    }

    /**
     * Info logging
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function infoLog(message, ...args) {
        console.log(`[FW Info] ${message}`, ...args);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose public API
    window.FerretWatchUtils = {
        getRiskColor,
        getDarkerRiskColor,
        getBucketProviderIcon,
        debugLog,
        infoLog,
        escapeHtml,
        RISK_LEVELS
    };

    // Also expose debugLog globally for backward compatibility
    window.debugLog = debugLog;

})();
