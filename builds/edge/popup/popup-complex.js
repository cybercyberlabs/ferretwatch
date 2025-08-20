/**
 * Popup script for FerretWatch
 * Full-featured popup with whitelist management
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize popup
    await initializePopup();
    
    // Set up event listeners
    setupEventListeners();
});

async function initializePopup() {
    try {
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab) {
            updateStatus('error', 'Cannot access current tab');
            return;
        }
        
        // Update domain info
        const url = new URL(currentTab.url);
        document.getElementById('currentDomain').textContent = url.hostname;
        
        // Get scan results from content script
        try {
            updateStatus('active', 'Getting scan results...');
            
            const response = await browser.tabs.sendMessage(currentTab.id, { 
                action: 'getScanResults' 
            });
            
            if (response && response.success) {
                displayScanResults(response.data);
                updateStatus('active', 'Scan complete');
            } else {
                updateStatus('warning', 'No scan data available');
                displayEmptyResults();
            }
        } catch (error) {
            console.error('Failed to get scan results:', error);
            updateStatus('warning', 'Scanner not active on this page');
            displayEmptyResults();
        }
        
        // Check if domain is whitelisted
        await updateWhitelistButton(url.hostname);
        
        // Update highlight button state
        await updateHighlightButtonState();
        
    } catch (error) {
        console.error('Popup initialization error:', error);
        updateStatus('error', 'Initialization failed');
    }
}

function setupEventListeners() {
    // Rescan button
    document.getElementById('rescanBtn').addEventListener('click', async () => {
        await rescanPage();
    });
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        showSettings();
    });
    
    // Highlight button
    document.getElementById('highlightBtn').addEventListener('click', async () => {
        await toggleHighlighting();
    });
    
    // Whitelist button
    document.getElementById('whitelistBtn').addEventListener('click', async () => {
        await toggleWhitelist();
    });
    
    // Export dropdown functionality
    setupExportDropdown();
    
    // Settings modal functionality
    setupSettingsModal();
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
        browser.tabs.create({ 
            url: 'https://github.com/cybercyberlabs/firefox-scanner/wiki' 
        });
    });
}

function setupExportDropdown() {
    const exportBtn = document.getElementById('exportBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const exportOptions = document.getElementById('exportOptions');
    
    // Toggle dropdown
    exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        exportOptions.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!exportDropdown.contains(e.target)) {
            exportOptions.classList.remove('show');
        }
    });
    
    // Export JSON
    document.getElementById('exportJSON').addEventListener('click', (e) => {
        e.preventDefault();
        exportData('json');
        exportOptions.classList.remove('show');
    });
    
    // Export CSV
    document.getElementById('exportCSV').addEventListener('click', (e) => {
        e.preventDefault();
        exportData('csv');
        exportOptions.classList.remove('show');
    });
    
    // Export History
    document.getElementById('exportHistory').addEventListener('click', (e) => {
        e.preventDefault();
        exportSessionHistory();
        exportOptions.classList.remove('show');
    });
}

function setupSettingsModal() {
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const resetSettings = document.getElementById('resetSettings');
    const clearHistory = document.getElementById('clearHistory');
    
    // Close modal handlers
    closeSettings.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // Settings handlers
    saveSettings.addEventListener('click', async () => {
        await saveSettingsData();
        settingsModal.style.display = 'none';
    });
    
    resetSettings.addEventListener('click', () => {
        resetSettingsToDefaults();
    });
    
    clearHistory.addEventListener('click', async () => {
        await clearSessionHistory();
    });
}

async function showSettings() {
    const settingsModal = document.getElementById('settingsModal');
    
    // Load current settings
    const settings = await loadSettings();
    
    // Update UI
    document.getElementById('enableProgressiveScan').checked = settings.enableProgressiveScan;
    document.getElementById('enableEntropyFilter').checked = settings.enableEntropyFilter;
    document.getElementById('enableContextFilter').checked = settings.enableContextFilter;
    document.getElementById('maskSecretsInExport').checked = settings.maskSecretsInExport;
    document.getElementById('includeMetadataInExport').checked = settings.includeMetadataInExport;
    document.getElementById('enableInPageHighlighting').checked = settings.enableInPageHighlighting;
    document.getElementById('enableHighlightControls').checked = settings.enableHighlightControls;
    
    // Update history count
    const historyCount = await getHistoryCount();
    document.getElementById('historyCount').textContent = historyCount;
    
    settingsModal.style.display = 'flex';
}

async function loadSettings() {
    return new Promise((resolve) => {
        browser.storage.local.get([
            'enableProgressiveScan',
            'enableEntropyFilter', 
            'enableContextFilter',
            'maskSecretsInExport',
            'includeMetadataInExport',
            'enableInPageHighlighting',
            'enableHighlightControls'
        ], (result) => {
            resolve({
                enableProgressiveScan: result.enableProgressiveScan !== false,
                enableEntropyFilter: result.enableEntropyFilter !== false,
                enableContextFilter: result.enableContextFilter !== false,
                maskSecretsInExport: result.maskSecretsInExport !== false,
                includeMetadataInExport: result.includeMetadataInExport !== false,
                enableInPageHighlighting: result.enableInPageHighlighting === true,
                enableHighlightControls: result.enableHighlightControls !== false
            });
        });
    });
}

async function saveSettingsData() {
    const settings = {
        enableProgressiveScan: document.getElementById('enableProgressiveScan').checked,
        enableEntropyFilter: document.getElementById('enableEntropyFilter').checked,
        enableContextFilter: document.getElementById('enableContextFilter').checked,
        maskSecretsInExport: document.getElementById('maskSecretsInExport').checked,
        includeMetadataInExport: document.getElementById('includeMetadataInExport').checked,
        enableInPageHighlighting: document.getElementById('enableInPageHighlighting').checked,
        enableHighlightControls: document.getElementById('enableHighlightControls').checked
    };
    
    await browser.storage.local.set(settings);
    updateStatus('active', 'Settings saved');
    
    // Notify content script
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        await browser.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: settings
        });
    } catch (error) {
        console.error('Failed to update content script settings:', error);
    }
}

function resetSettingsToDefaults() {
    document.getElementById('enableProgressiveScan').checked = true;
    document.getElementById('enableEntropyFilter').checked = true;
    document.getElementById('enableContextFilter').checked = true;
    document.getElementById('maskSecretsInExport').checked = true;
    document.getElementById('includeMetadataInExport').checked = true;
    document.getElementById('enableInPageHighlighting').checked = false;
    document.getElementById('enableHighlightControls').checked = true;
    
    updateStatus('active', 'Settings reset to defaults');
}

async function exportData(format) {
    try {
        updateStatus('active', `Exporting as ${format.toUpperCase()}...`);
        
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'exportData',
            format: format
        });
        
        if (response && response.success) {
            updateStatus('active', `Exported as ${format.toUpperCase()}`);
        } else {
            updateStatus('error', 'Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        updateStatus('error', 'Export failed');
    }
}

async function exportSessionHistory() {
    try {
        updateStatus('active', 'Exporting session history...');
        
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'exportSessionHistory'
        });
        
        if (response && response.success) {
            updateStatus('active', 'Session history exported');
        } else {
            updateStatus('error', 'Export failed');
        }
    } catch (error) {
        console.error('History export error:', error);
        updateStatus('error', 'Export failed');
    }
}

async function clearSessionHistory() {
    if (confirm('Are you sure you want to clear the session history?')) {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            const response = await browser.tabs.sendMessage(tabs[0].id, {
                action: 'clearSessionHistory'
            });
            
            if (response && response.success) {
                document.getElementById('historyCount').textContent = '0';
                updateStatus('active', 'History cleared');
            } else {
                updateStatus('error', 'Failed to clear history');
            }
        } catch (error) {
            console.error('Clear history error:', error);
            updateStatus('error', 'Failed to clear history');
        }
    }
}

async function toggleHighlighting() {
    try {
        const highlightBtn = document.getElementById('highlightBtn');
        const isActive = highlightBtn.classList.contains('active');
        
        updateStatus('active', isActive ? 'Disabling highlights...' : 'Enabling highlights...');
        
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'toggleHighlighting',
            enabled: !isActive
        });
        
        if (response && response.success) {
            if (isActive) {
                highlightBtn.classList.remove('active');
                highlightBtn.innerHTML = '<span class="btn-icon">🎯</span>Highlight';
                updateStatus('active', 'Highlights disabled');
            } else {
                highlightBtn.classList.add('active');
                highlightBtn.innerHTML = '<span class="btn-icon">✨</span>Enabled';
                updateStatus('active', 'Highlights enabled');
            }
        } else {
            updateStatus('error', 'Failed to toggle highlighting');
        }
    } catch (error) {
        console.error('Toggle highlighting error:', error);
        updateStatus('error', 'Highlighting failed');
    }
}

async function updateHighlightButtonState() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'getHighlightStatus'
        });
        
        const highlightBtn = document.getElementById('highlightBtn');
        if (response && response.enabled) {
            highlightBtn.classList.add('active');
            highlightBtn.innerHTML = '<span class="btn-icon">✨</span>Enabled';
        } else {
            highlightBtn.classList.remove('active');
            highlightBtn.innerHTML = '<span class="btn-icon">🎯</span>Highlight';
        }
    } catch (error) {
        // Ignore errors, highlighting might not be available
    }
}

async function getHistoryCount() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            action: 'getHistoryCount'
        });
        return response ? response.count : 0;
    } catch (error) {
        console.error('Get history count error:', error);
        return 0;
    }
}

function displayScanResults(data) {
    const findingsCount = document.getElementById('findingsCount');
    const riskLevel = document.getElementById('riskLevel');
    const scanTime = document.getElementById('scanTime');
    const findingsList = document.getElementById('findingsList');
    
    // Update summary
    findingsCount.textContent = data.findings?.length || 0;
    riskLevel.textContent = getHighestRiskLevel(data.findings) || 'None';
    scanTime.textContent = data.scanTime ? `${Math.round(data.scanTime)}ms` : 'N/A';
    
    // Display findings
    if (data.findings && data.findings.length > 0) {
        findingsList.style.display = 'block';
        findingsList.innerHTML = '';
        
        data.findings.slice(0, 5).forEach(finding => {
            const item = createFindingItem(finding);
            findingsList.appendChild(item);
        });
        
        if (data.findings.length > 5) {
            const moreItem = document.createElement('div');
            moreItem.className = 'finding-item';
            moreItem.innerHTML = `
                <span class="finding-type">...and ${data.findings.length - 5} more</span>
            `;
            findingsList.appendChild(moreItem);
        }
    } else {
        findingsList.style.display = 'none';
    }
}

function displayEmptyResults() {
    document.getElementById('findingsCount').textContent = '0';
    document.getElementById('riskLevel').textContent = 'None';
    document.getElementById('scanTime').textContent = 'N/A';
    document.getElementById('findingsList').style.display = 'none';
}

function createFindingItem(finding) {
    const item = document.createElement('div');
    item.className = `finding-item ${finding.riskLevel}`;
    
    item.innerHTML = `
        <span class="finding-type">${finding.type}</span>
        <span class="finding-value">${maskValue(finding.value)}</span>
    `;
    
    return item;
}

function maskValue(value) {
    if (!value || value.length <= 8) {
        return '*'.repeat(value?.length || 3);
    }
    return value.slice(0, 4) + '...' + value.slice(-4);
}

function getHighestRiskLevel(findings) {
    if (!findings || findings.length === 0) return null;
    
    const levels = ['low', 'medium', 'high', 'critical'];
    let highest = 'low';
    
    findings.forEach(finding => {
        if (levels.indexOf(finding.riskLevel) > levels.indexOf(highest)) {
            highest = finding.riskLevel;
        }
    });
    
    return highest.charAt(0).toUpperCase() + highest.slice(1);
}

async function rescanPage() {
    const rescanBtn = document.getElementById('rescanBtn');
    const originalText = rescanBtn.innerHTML;
    
    try {
        // Update button state
        rescanBtn.innerHTML = '<span class="btn-icon">⏳</span>Scanning...';
        rescanBtn.disabled = true;
        updateStatus('active', 'Rescanning page...');
        
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        // Send rescan message
        const response = await browser.tabs.sendMessage(currentTab.id, { 
            action: 'rescan' 
        });
        
        if (response && response.success) {
            displayScanResults(response.data);
            updateStatus('active', 'Rescan complete');
        } else {
            updateStatus('warning', 'Rescan failed');
        }
        
    } catch (error) {
        console.error('Rescan error:', error);
        updateStatus('error', 'Rescan failed');
    } finally {
        // Restore button
        rescanBtn.innerHTML = originalText;
        rescanBtn.disabled = false;
    }
}

async function toggleWhitelist() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        const url = new URL(currentTab.url);
        const hostname = url.hostname;
        
        // Get current whitelist
        const result = await browser.storage.local.get('settings');
        const settings = result.settings || { whitelistedDomains: [] };
        
        const whitelist = settings.whitelistedDomains || [];
        const isWhitelisted = whitelist.includes(hostname);
        
        if (isWhitelisted) {
            // Remove from whitelist
            settings.whitelistedDomains = whitelist.filter(domain => domain !== hostname);
            updateStatus('active', 'Domain removed from whitelist');
        } else {
            // Add to whitelist
            settings.whitelistedDomains = [...whitelist, hostname];
            updateStatus('active', 'Domain added to whitelist');
        }
        
        // Save settings
        await browser.storage.local.set({ settings });
        
        // Update button
        await updateWhitelistButton(hostname);
        
    } catch (error) {
        console.error('Whitelist toggle error:', error);
        updateStatus('error', 'Failed to update whitelist');
    }
}

async function updateWhitelistButton(hostname) {
    try {
        const result = await browser.storage.local.get('settings');
        const settings = result.settings || { whitelistedDomains: [] };
        const whitelist = settings.whitelistedDomains || [];
        const isWhitelisted = whitelist.includes(hostname);
        
        const button = document.getElementById('whitelistBtn');
        
        if (isWhitelisted) {
            button.textContent = 'Remove from Whitelist';
            button.style.background = '#dc3545';
        } else {
            button.textContent = 'Add to Whitelist';
            button.style.background = '#17a2b8';
        }
        
    } catch (error) {
        console.error('Update whitelist button error:', error);
    }
}

function updateStatus(type, message) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = `status-dot ${type}`;
    statusText.textContent = message;
}
