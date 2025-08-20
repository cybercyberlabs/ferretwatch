/**
 * In-page highlighting utilities for detected secrets
 */

class HighlightManager {
    constructor() {
        this.highlightEnabled = false;
        this.highlights = new Map(); // Store highlight elements
        this.highlightId = 0;
        this.highlightColors = {
            critical: '#ff4757',
            high: '#ff6b35', 
            medium: '#ffa502',
            low: '#26de81'
        };
        
        this.injectStyles();
    }
    
    /**
     * Inject CSS styles for highlighting
     */
    injectStyles() {
        if (document.getElementById('cyberscan-highlight-styles')) {
            return; // Already injected
        }
        
        const style = document.createElement('style');
        style.id = 'cyberscan-highlight-styles';
        style.textContent = `
            .cyberscan-highlight {
                position: relative;
                background: rgba(255, 71, 87, 0.2);
                border: 1px solid rgba(255, 71, 87, 0.5);
                border-radius: 3px;
                padding: 1px 3px;
                margin: 0 1px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .cyberscan-highlight.critical {
                background: rgba(255, 71, 87, 0.25);
                border-color: rgba(255, 71, 87, 0.6);
            }
            
            .cyberscan-highlight.high {
                background: rgba(255, 107, 53, 0.25);
                border-color: rgba(255, 107, 53, 0.6);
            }
            
            .cyberscan-highlight.medium {
                background: rgba(255, 165, 2, 0.25);
                border-color: rgba(255, 165, 2, 0.6);
            }
            
            .cyberscan-highlight.low {
                background: rgba(38, 222, 129, 0.25);
                border-color: rgba(38, 222, 129, 0.6);
            }
            
            .cyberscan-highlight:hover {
                background: rgba(255, 255, 255, 0.9);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 1000;
            }
            
            .cyberscan-tooltip {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: #2c3e50;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.2s ease;
                z-index: 1001;
                margin-bottom: 5px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .cyberscan-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-top-color: #2c3e50;
            }
            
            .cyberscan-highlight:hover .cyberscan-tooltip {
                opacity: 1;
                visibility: visible;
            }
            
            .cyberscan-highlight-controls {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                display: none;
            }
            
            .cyberscan-highlight-controls.show {
                display: block;
            }
            
            .cyberscan-controls-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                font-weight: 600;
                color: #2c3e50;
            }
            
            .cyberscan-controls-close {
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #7f8c8d;
            }
            
            .cyberscan-controls-close:hover {
                color: #2c3e50;
            }
            
            .cyberscan-controls-toggle {
                display: flex;
                align-items: center;
                margin: 8px 0;
            }
            
            .cyberscan-controls-toggle input {
                margin-right: 8px;
            }
            
            .cyberscan-controls-stats {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #eee;
                font-size: 12px;
                color: #7f8c8d;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Enable/disable highlighting
     * @param {boolean} enabled - Whether highlighting should be enabled
     */
    setHighlightEnabled(enabled) {
        this.highlightEnabled = enabled;
        
        if (enabled) {
            this.showHighlightControls();
        } else {
            this.clearAllHighlights();
            this.hideHighlightControls();
        }
    }
    
    /**
     * Highlight findings on the page
     * @param {Array} findings - Array of finding objects
     */
    highlightFindings(findings) {
        if (!this.highlightEnabled || !findings || findings.length === 0) {
            return;
        }
        
        this.clearAllHighlights();
        
        findings.forEach(finding => {
            this.highlightText(finding.value, finding.type, finding.riskLevel);
        });
        
        this.updateHighlightControls();
    }
    
    /**
     * Highlight specific text in the document
     * @param {string} text - Text to highlight
     * @param {string} type - Type of secret
     * @param {string} riskLevel - Risk level
     */
    highlightText(text, type, riskLevel) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip already highlighted elements and script/style tags
                    if (node.parentElement.classList?.contains('cyberscan-highlight') ||
                        ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes(text)) {
                textNodes.push(node);
            }
        }
        
        textNodes.forEach(textNode => {
            this.highlightInTextNode(textNode, text, type, riskLevel);
        });
    }
    
    /**
     * Highlight text within a specific text node
     * @param {Node} textNode - Text node to search in
     * @param {string} text - Text to highlight
     * @param {string} type - Type of secret
     * @param {string} riskLevel - Risk level
     */
    highlightInTextNode(textNode, text, type, riskLevel) {
        const content = textNode.textContent;
        const index = content.indexOf(text);
        
        if (index === -1) return;
        
        const parent = textNode.parentNode;
        const highlightId = `cyberscan-highlight-${++this.highlightId}`;
        
        // Create highlight element
        const highlight = document.createElement('span');
        highlight.className = `cyberscan-highlight ${riskLevel}`;
        highlight.id = highlightId;
        highlight.setAttribute('data-type', type);
        highlight.setAttribute('data-risk', riskLevel);
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'cyberscan-tooltip';
        tooltip.textContent = `${type} (${riskLevel.toUpperCase()} risk)`;
        highlight.appendChild(tooltip);
        
        // Split text node and insert highlight
        const beforeText = content.substring(0, index);
        const highlightText = content.substring(index, index + text.length);
        const afterText = content.substring(index + text.length);
        
        if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
        }
        
        highlight.textContent = highlightText;
        parent.insertBefore(highlight, textNode);
        
        if (afterText) {
            const afterNode = document.createTextNode(afterText);
            parent.insertBefore(afterNode, textNode);
            // Continue searching in the remaining text
            this.highlightInTextNode(afterNode, text, type, riskLevel);
        }
        
        parent.removeChild(textNode);
        
        // Store highlight reference
        this.highlights.set(highlightId, {
            element: highlight,
            type: type,
            riskLevel: riskLevel,
            text: highlightText
        });
        
        // Add click handler
        highlight.addEventListener('click', (e) => {
            e.preventDefault();
            this.onHighlightClick(highlightId);
        });
    }
    
    /**
     * Handle highlight click
     * @param {string} highlightId - ID of clicked highlight
     */
    onHighlightClick(highlightId) {
        const highlight = this.highlights.get(highlightId);
        if (!highlight) return;
        
        // Show detailed information
        const message = `Secret Type: ${highlight.type}\nRisk Level: ${highlight.riskLevel.toUpperCase()}\nValue: ${this.maskSecret(highlight.text)}`;
        
        if (confirm(message + '\n\nCopy to clipboard?')) {
            navigator.clipboard.writeText(highlight.text).catch(err => {
                console.error('Failed to copy to clipboard:', err);
            });
        }
    }
    
    /**
     * Clear all highlights from the page
     */
    clearAllHighlights() {
        this.highlights.forEach((highlight, id) => {
            if (highlight.element && highlight.element.parentNode) {
                const parent = highlight.element.parentNode;
                const textContent = highlight.element.textContent;
                parent.insertBefore(document.createTextNode(textContent), highlight.element);
                parent.removeChild(highlight.element);
            }
        });
        
        this.highlights.clear();
        this.normalizeTextNodes();
    }
    
    /**
     * Normalize adjacent text nodes after removing highlights
     */
    normalizeTextNodes() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        textNodes.forEach(textNode => {
            if (textNode.parentNode) {
                textNode.parentNode.normalize();
            }
        });
    }
    
    /**
     * Show highlight controls
     */
    showHighlightControls() {
        let controls = document.getElementById('cyberscan-highlight-controls');
        if (!controls) {
            controls = this.createHighlightControls();
        }
        controls.classList.add('show');
    }
    
    /**
     * Hide highlight controls
     */
    hideHighlightControls() {
        const controls = document.getElementById('cyberscan-highlight-controls');
        if (controls) {
            controls.classList.remove('show');
        }
    }
    
    /**
     * Create highlight controls UI
     */
    createHighlightControls() {
        const controls = document.createElement('div');
        controls.id = 'cyberscan-highlight-controls';
        controls.className = 'cyberscan-highlight-controls';
        
        controls.innerHTML = `
            <div class="cyberscan-controls-header">
                <span>🔍 Secret Highlights</span>
                <button class="cyberscan-controls-close" id="cyberscan-close-controls">&times;</button>
            </div>
            <div class="cyberscan-controls-toggle">
                <input type="checkbox" id="cyberscan-toggle-highlights" checked>
                <label for="cyberscan-toggle-highlights">Show highlights</label>
            </div>
            <div class="cyberscan-controls-stats" id="cyberscan-highlight-stats">
                Loading...
            </div>
        `;
        
        document.body.appendChild(controls);
        
        // Add event listeners
        controls.querySelector('#cyberscan-close-controls').addEventListener('click', () => {
            this.setHighlightEnabled(false);
        });
        
        controls.querySelector('#cyberscan-toggle-highlights').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.showAllHighlights();
            } else {
                this.hideAllHighlights();
            }
        });
        
        return controls;
    }
    
    /**
     * Update highlight controls with current stats
     */
    updateHighlightControls() {
        const stats = document.getElementById('cyberscan-highlight-stats');
        if (!stats) return;
        
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        this.highlights.forEach(highlight => {
            counts[highlight.riskLevel] = (counts[highlight.riskLevel] || 0) + 1;
        });
        
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        
        stats.innerHTML = `
            Total: ${total} secrets found<br>
            <span style="color: ${this.highlightColors.critical}">Critical: ${counts.critical}</span> | 
            <span style="color: ${this.highlightColors.high}">High: ${counts.high}</span> | 
            <span style="color: ${this.highlightColors.medium}">Medium: ${counts.medium}</span> | 
            <span style="color: ${this.highlightColors.low}">Low: ${counts.low}</span>
        `;
    }
    
    /**
     * Show all highlights
     */
    showAllHighlights() {
        this.highlights.forEach(highlight => {
            if (highlight.element) {
                highlight.element.style.display = '';
            }
        });
    }
    
    /**
     * Hide all highlights (but don't remove them)
     */
    hideAllHighlights() {
        this.highlights.forEach(highlight => {
            if (highlight.element) {
                highlight.element.style.display = 'none';
            }
        });
    }
    
    /**
     * Mask secret value for display
     * @param {string} secret - Secret to mask
     * @returns {string} Masked secret
     */
    maskSecret(secret) {
        if (window.SecurityUtils && window.SecurityUtils.maskSecret) {
            return window.SecurityUtils.maskSecret(secret);
        }
        if (secret.length <= 8) {
            return '*'.repeat(secret.length);
        }
        return secret.slice(0, 4) + '***' + secret.slice(-4);
    }
    
    /**
     * Check if highlighting is currently enabled
     * @returns {boolean} True if highlighting is enabled
     */
    isEnabled() {
        return this.highlightEnabled;
    }
    
    /**
     * Get highlight statistics
     * @returns {object} Statistics object
     */
    getStats() {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        this.highlights.forEach(highlight => {
            counts[highlight.riskLevel] = (counts[highlight.riskLevel] || 0) + 1;
        });
        
        return {
            total: this.highlights.size,
            counts: counts,
            enabled: this.highlightEnabled
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HighlightManager };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.HighlightManager = HighlightManager;
    
    // Create global instance
    if (!window.highlightManager) {
        window.highlightManager = new HighlightManager();
    }
}
