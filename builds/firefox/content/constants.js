/**
 * Constants for FerretWatch content script modules
 */

// Scanner initialization delay
const SCANNER_INIT_DELAY = 100;

// Message types for window.postMessage
const MESSAGE_TYPES = {
    API_CALL: 'FERRETWATCH_API_CALL',
    API_RESPONSE: 'FERRETWATCH_API_RESPONSE'
};

// Risk levels
const RISK_LEVELS = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

// Risk colors (from getRiskColor function)
const RISK_COLORS = {
    [RISK_LEVELS.CRITICAL]: '#ff1744',
    [RISK_LEVELS.HIGH]: '#ff5722',
    [RISK_LEVELS.MEDIUM]: '#ff9800',
    [RISK_LEVELS.LOW]: '#ffc107'
};

// Darker risk colors (for borders)
const DARKER_RISK_COLORS = {
    [RISK_LEVELS.CRITICAL]: '#d50000',
    [RISK_LEVELS.HIGH]: '#d84315',
    [RISK_LEVELS.MEDIUM]: '#e65100',
    [RISK_LEVELS.LOW]: '#f57c00'
};

// S3 bucket provider icons
const BUCKET_PROVIDER_ICONS = {
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

// Notification styling
const NOTIFICATION_STYLES = {
    CONTAINER_PADDING: '16px',
    BORDER_WIDTH: '3px',
    BORDER_RADIUS: '8px',
    Z_INDEX: 2147483647,
    ANIMATION_DURATION: '0.3s'
};

// Browser API reference
const api = typeof browser !== 'undefined' ? browser : chrome;

// Export all constants
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SCANNER_INIT_DELAY,
        MESSAGE_TYPES,
        RISK_LEVELS,
        RISK_COLORS,
        DARKER_RISK_COLORS,
        BUCKET_PROVIDER_ICONS,
        NOTIFICATION_STYLES,
        api
    };
}
