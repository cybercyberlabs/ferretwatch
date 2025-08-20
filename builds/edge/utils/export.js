/**
 * Export utilities for scan results and session data
 */

class ExportManager {
    constructor() {
        this.sessionHistory = [];
        this.maxHistoryItems = 100;
    }
    
    /**
     * Exports scan results in JSON format
     * @param {Array} findings - Scan findings
     * @param {object} metadata - Additional metadata
     * @returns {string} JSON string
     */
    exportAsJSON(findings, metadata = {}) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                scannerVersion: '1.4.0',
                url: window.location.href,
                domain: window.location.hostname,
                userAgent: navigator.userAgent,
                ...metadata
            },
            summary: {
                totalFindings: findings.length,
                riskLevels: this.getRiskLevelCounts(findings),
                categories: this.getCategoryCounts(findings),
                highestRisk: this.getHighestRiskLevel(findings)
            },
            findings: findings.map(finding => ({
                ...finding,
                value: this.shouldMaskInExport() ? this.maskSecretForExport(finding.value) : finding.value,
                exportId: this.generateExportId(),
                detectionTime: finding.timestamp || Date.now()
            })),
            statistics: this.getStatistics()
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * Exports scan results in CSV format
     * @param {Array} findings - Scan findings
     * @param {object} metadata - Additional metadata
     * @returns {string} CSV string
     */
    exportAsCSV(findings, metadata = {}) {
        const headers = [
            'Type',
            'Risk Level',
            'Category', 
            'Value',
            'URL',
            'Detection Time',
            'Export ID'
        ];
        
        const rows = findings.map(finding => [
            `"${finding.type || 'Unknown'}"`,
            `"${finding.riskLevel || 'medium'}"`,
            `"${finding.category || 'unknown'}"`,
            `"${this.shouldMaskInExport() ? this.maskSecretForExport(finding.value) : finding.value}"`,
            `"${window.location.href}"`,
            `"${new Date(finding.timestamp || Date.now()).toISOString()}"`,
            `"${this.generateExportId()}"`
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csvContent;
    }
    
    /**
     * Downloads export data as a file
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * Exports current scan results
     * @param {Array} findings - Findings to export
     * @param {string} format - Export format ('json' | 'csv')
     * @param {object} options - Export options
     */
    exportScanResults(findings, format = 'json', options = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const domain = window.location.hostname;
        
        let content, filename, mimeType;
        
        switch (format.toLowerCase()) {
            case 'json':
                content = this.exportAsJSON(findings, options.metadata);
                filename = `cyberscan-${domain}-${timestamp}.json`;
                mimeType = 'application/json';
                break;
                
            case 'csv':
                content = this.exportAsCSV(findings, options.metadata);
                filename = `cyberscan-${domain}-${timestamp}.csv`;
                mimeType = 'text/csv';
                break;
                
            default:
                throw new Error('Unsupported export format');
        }
        
        this.downloadFile(content, filename, mimeType);
        
        // Add to session history
        this.addToSessionHistory({
            type: 'export',
            format,
            findingsCount: findings.length,
            timestamp: Date.now(),
            url: window.location.href
        });
    }
    
    /**
     * Manages session history
     * @param {object} entry - History entry
     */
    addToSessionHistory(entry) {
        this.sessionHistory.unshift(entry);
        
        // Limit history size
        if (this.sessionHistory.length > this.maxHistoryItems) {
            this.sessionHistory = this.sessionHistory.slice(0, this.maxHistoryItems);
        }
        
        // Persist to storage
        this.saveSessionHistory();
    }
    
    /**
     * Gets session history
     * @returns {Array} Session history
     */
    getSessionHistory() {
        return [...this.sessionHistory];
    }
    
    /**
     * Clears session history
     */
    clearSessionHistory() {
        this.sessionHistory = [];
        this.saveSessionHistory();
    }
    
    /**
     * Exports session history
     * @param {string} format - Export format
     */
    exportSessionHistory(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cyberscan-session-${timestamp}.${format}`;
        
        let content, mimeType;
        
        if (format === 'json') {
            content = JSON.stringify({
                exportDate: new Date().toISOString(),
                sessionStart: this.sessionHistory.length > 0 ? 
                    new Date(Math.min(...this.sessionHistory.map(h => h.timestamp))).toISOString() : 
                    new Date().toISOString(),
                totalEntries: this.sessionHistory.length,
                history: this.sessionHistory
            }, null, 2);
            mimeType = 'application/json';
        } else {
            // CSV format for session history
            const headers = ['Type', 'Format', 'Findings Count', 'URL', 'Timestamp'];
            const rows = this.sessionHistory.map(entry => [
                `"${entry.type}"`,
                `"${entry.format || 'N/A'}"`,
                `"${entry.findingsCount || 0}"`,
                `"${entry.url}"`,
                `"${new Date(entry.timestamp).toISOString()}"`
            ]);
            
            content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            mimeType = 'text/csv';
        }
        
        this.downloadFile(content, filename, mimeType);
    }
    
    // Helper methods
    getRiskLevelCounts(findings) {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        findings.forEach(f => {
            counts[f.riskLevel] = (counts[f.riskLevel] || 0) + 1;
        });
        return counts;
    }
    
    getCategoryCounts(findings) {
        const counts = {};
        findings.forEach(f => {
            counts[f.category] = (counts[f.category] || 0) + 1;
        });
        return counts;
    }
    
    getHighestRiskLevel(findings) {
        const levels = ['low', 'medium', 'high', 'critical'];
        return findings.reduce((highest, finding) => {
            const currentIndex = levels.indexOf(finding.riskLevel);
            const highestIndex = levels.indexOf(highest);
            return currentIndex > highestIndex ? finding.riskLevel : highest;
        }, 'low');
    }
    
    shouldMaskInExport() {
        // Check settings to see if secrets should be masked in exports
        if (window.StorageUtils) {
            return window.StorageUtils.getSetting('maskSecretsInExport', true);
        }
        return true; // Default to masking for security
    }
    
    maskSecretForExport(secret) {
        if (window.SecurityUtils && window.SecurityUtils.maskSecret) {
            return window.SecurityUtils.maskSecret(secret);
        }
        return secret ? secret.slice(0, 4) + '***' + secret.slice(-4) : '***';
    }
    
    generateExportId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    getStatistics() {
        if (window.scanner && window.scanner.getStats) {
            return window.scanner.getStats();
        }
        return null;
    }
    
    saveSessionHistory() {
        try {
            if (window.StorageUtils) {
                window.StorageUtils.setSetting('sessionHistory', this.sessionHistory);
            } else if (typeof localStorage !== 'undefined') {
                localStorage.setItem('cyberlabs-session-history', JSON.stringify(this.sessionHistory));
            }
        } catch (error) {
            console.error('Failed to save session history:', error);
        }
    }
    
    loadSessionHistory() {
        try {
            if (window.StorageUtils) {
                this.sessionHistory = window.StorageUtils.getSetting('sessionHistory', []);
            } else if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('cyberlabs-session-history');
                this.sessionHistory = stored ? JSON.parse(stored) : [];
            }
        } catch (error) {
            console.error('Failed to load session history:', error);
            this.sessionHistory = [];
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportManager };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
    
    // Create global instance
    if (!window.exportManager) {
        window.exportManager = new ExportManager();
        window.exportManager.loadSessionHistory();
    }
}
