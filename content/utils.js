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
     * Log levels in order of severity
     */
    const LOG_LEVELS = {
        'critical': 0,
        'error': 1,
        'warn': 2,
        'info': 3,
        'debug': 4
    };

    /**
     * Check if a log level should be displayed based on current settings
     * @param {string} level - Log level to check
     * @returns {boolean} True if should log
     */
    function shouldLog(level) {
        // Check the debugMode setting from storage (controlled by settings UI)
        const debugMode = window.StorageUtils?.getSetting?.('debugMode', false) || false;

        // If debug mode is enabled, show all logs (debug level and above)
        // If debug mode is disabled, only show critical and error logs
        const currentLevel = debugMode ? 'debug' : 'error';
        return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
    }

    /**
     * Debug logging (only logs when debug level is 'debug')
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function debugLog(message, ...args) {
        if (shouldLog('debug')) {
            console.log(`[FW Debug] ${message}`, ...args);
        }
    }

    /**
     * Info logging (only logs when debug level is 'info' or higher)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function infoLog(message, ...args) {
        if (shouldLog('info')) {
            console.log(`[FW Info] ${message}`, ...args);
        }
    }

    /**
     * Warning logging (only logs when debug level is 'warn' or higher)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function warnLog(message, ...args) {
        if (shouldLog('warn')) {
            console.warn(`[FW Warning] ${message}`, ...args);
        }
    }

    /**
     * Error logging (only logs when debug level is 'error' or higher)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function errorLog(message, ...args) {
        if (shouldLog('error')) {
            console.error(`[FW Error] ${message}`, ...args);
        }
    }

    /**
     * Critical logging (always logs)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    function criticalLog(message, ...args) {
        if (shouldLog('critical')) {
            console.error(`[FW CRITICAL] ${message}`, ...args);
        }
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
        warnLog,
        errorLog,
        criticalLog,
        escapeHtml,
        RISK_LEVELS,
        LOG_LEVELS
    };

    // Also expose logging functions globally for backward compatibility
    window.debugLog = debugLog;
    window.infoLog = infoLog;
    window.warnLog = warnLog;
    window.errorLog = errorLog;
    window.criticalLog = criticalLog;

})();
