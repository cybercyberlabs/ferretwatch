/**
 * Simple and reliable popup script for FerretWatch
 * Uses direct event handlers for maximum compatibility
 */

// Global variables
let currentTab = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 FerretWatch popup loading...');
    setTimeout(initializePopup, 100);
});

async function initializePopup() {
    console.log('🔧 Initializing popup...');

    try {
        // Get current tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];

        if (!currentTab) {
            console.error('❌ Cannot access current tab');
            updateStatus('error', 'Cannot access current tab');
            return;
        }

        // Update domain info
        const url = new URL(currentTab.url);
        document.getElementById('currentDomain').textContent = url.hostname;

        // Set up all button handlers
        setupButtonHandlers();

        // Check whitelist status
        await updateWhitelistStatus();

        // Update status
        updateStatus('active', 'Scanner ready');

        console.log('✅ Popup initialized successfully');

    } catch (error) {
        console.error('❌ Popup initialization error:', error);
        updateStatus('error', 'Initialization failed');
    }
}

function setupButtonHandlers() {
    console.log('🔧 Setting up button handlers...');

    // Rescan button
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.onclick = function() {
            console.log('🔄 Rescan button clicked!');
            handleRescan();
        };
        console.log('✅ Rescan button ready');
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = function() {
            console.log('⚙️ Settings button clicked!');
            showSettings();
        };
        console.log('✅ Settings button ready');
    }

    // Whitelist button
    const whitelistBtn = document.getElementById('whitelistBtn');
    if (whitelistBtn) {
        whitelistBtn.onclick = function() {
            console.log('📝 Whitelist button clicked!');
            handleWhitelist();
        };
        console.log('✅ Whitelist button ready');
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.onclick = function() {
            console.log('📊 Export button clicked!');
            toggleExport();
        };
        console.log('✅ Export button ready');
    }

    // Settings modal close button
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) {
        closeSettings.onclick = function() {
            console.log('❌ Close settings clicked!');
            hideSettings();
        };
        console.log('✅ Close settings button ready');
    }

    // Save settings button
    const saveSettings = document.getElementById('saveSettings');
    if (saveSettings) {
        saveSettings.onclick = function() {
            console.log('💾 Save settings clicked!');
            saveSettingsData();
        };
        console.log('✅ Save settings button ready');
    }

    // Reset settings button
    const resetSettings = document.getElementById('resetSettings');
    if (resetSettings) {
        resetSettings.onclick = function() {
            console.log('🔄 Reset settings clicked!');
            resetSettingsData();
        };
        console.log('✅ Reset settings button ready');
    }

    // Export dropdown options
    const exportJSON = document.getElementById('exportJSON');
    if (exportJSON) {
        exportJSON.onclick = function() {
            console.log('📄 Export JSON clicked!');
            exportData('json');
        };
    }

    const exportCSV = document.getElementById('exportCSV');
    if (exportCSV) {
        exportCSV.onclick = function() {
            console.log('📊 Export CSV clicked!');
            exportData('csv');
        };
    }

    const exportHistory = document.getElementById('exportHistory');
    if (exportHistory) {
        exportHistory.onclick = function() {
            console.log('📚 Export History clicked!');
            exportSessionHistory();
        };
    }

    // Modal click-outside to close
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.onclick = function(e) {
            if (e.target === settingsModal) {
                hideSettings();
            }
        };
    }

    console.log('🎉 All button handlers set up successfully!');
}

// Button handler functions
async function handleRescan() {
    console.log('🔄 Starting rescan...');
    const rescanBtn = document.getElementById('rescanBtn');
    const originalText = rescanBtn.innerHTML;

    try {
        // Update button
        rescanBtn.innerHTML = '⏳ Scanning...';
        rescanBtn.disabled = true;
        updateStatus('active', 'Rescanning page...');

        if (!currentTab) {
            throw new Error('No active tab found');
        }

        // Try to communicate with content script
        try {
            const response = await browser.tabs.sendMessage(currentTab.id, {
                action: 'rescan'
            });

            console.log('📨 Rescan response:', response);

            if (response && response.success) {
                const count = response.findings ? response.findings.length : 0;
                updateStatus('active', count > 0 ?
                    `Found ${count} credential${count === 1 ? '' : 's'}` :
                    'No credentials found');
                console.log(`✅ Rescan complete: ${count} findings`);
            } else {
                updateStatus('warning', 'Rescan completed - check console');
                console.log('⚠️ Rescan completed with no clear response');
            }
        } catch (msgError) {
            console.log('📡 Direct messaging failed, trying script injection...');

            // Fallback: inject scan script directly
            const results = await browser.tabs.executeScript(currentTab.id, {
                code: `
                    (function() {
                        console.log('🔍 Manual rescan via popup');
                        if (typeof scanForCredentials === 'function') {
                            return scanForCredentials();
                        }
                        return [];
                    })();
                `
            });

            if (results && results[0]) {
                const findings = results[0];
                const count = Array.isArray(findings) ? findings.length : 0;
                updateStatus('active', count > 0 ?
                    `Found ${count} credential${count === 1 ? '' : 's'}` :
                    'No credentials found');
                console.log(`✅ Script injection scan complete: ${count} findings`);
            } else {
                updateStatus('warning', 'Rescan completed - check console');
                console.log('⚠️ Script injection completed');
            }
        }

    } catch (error) {
        console.error('❌ Rescan error:', error);
        updateStatus('error', 'Rescan failed');
    } finally {
        // Restore button
        setTimeout(() => {
            rescanBtn.innerHTML = originalText;
            rescanBtn.disabled = false;
        }, 2000);
    }
}

function showSettings() {
    console.log('⚙️ Showing settings modal...');
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        loadSettingsData();
    }
}

function hideSettings() {
    console.log('❌ Hiding settings modal...');
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function loadSettingsData() {
    console.log('📖 Loading settings data...');

    // Set default values
    document.getElementById('historyCount').textContent = '0';

    // Enable all checkboxes
    const checkboxes = document.querySelectorAll('#settingsModal input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.disabled = false;
    });

    // Load settings from storage
    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(['ferretWatchSettings']).then(result => {
            const settings = result.ferretWatchSettings || {};

            // Apply settings with defaults
            const settingsConfig = {
                enableProgressiveScan: settings.enableProgressiveScan !== false,
                enableEntropyFilter: settings.enableEntropyFilter !== false,
                enableContextFilter: settings.enableContextFilter !== false,
                maskSecretsInExport: settings.maskSecretsInExport !== false,
                includeMetadataInExport: settings.includeMetadataInExport !== false,
                enableInPageHighlighting: settings.enableInPageHighlighting === true,
                enableHighlightControls: settings.enableHighlightControls !== false
            };

            // Apply to checkboxes
            Object.keys(settingsConfig).forEach(key => {
                const checkbox = document.getElementById(key);
                if (checkbox) {
                    checkbox.checked = settingsConfig[key];
                }
            });

            console.log('✅ Settings loaded:', settingsConfig);
        }).catch(err => {
            console.log('⚠️ Could not load settings, using defaults');
        });
    }

    // Load whitelist info
    updateWhitelistInfo();
}

function saveSettingsData() {
    console.log('💾 Saving settings...');

    const settings = {
        enableProgressiveScan: document.getElementById('enableProgressiveScan').checked,
        enableEntropyFilter: document.getElementById('enableEntropyFilter').checked,
        enableContextFilter: document.getElementById('enableContextFilter').checked,
        maskSecretsInExport: document.getElementById('maskSecretsInExport').checked,
        includeMetadataInExport: document.getElementById('includeMetadataInExport').checked,
        enableInPageHighlighting: document.getElementById('enableInPageHighlighting').checked,
        enableHighlightControls: document.getElementById('enableHighlightControls').checked
    };

    if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.set({ ferretWatchSettings: settings });
    }

    console.log('✅ Settings saved:', settings);
    hideSettings();
}

function resetSettingsData() {
    console.log('🔄 Resetting settings...');

    // Reset to defaults
    document.getElementById('enableProgressiveScan').checked = true;
    document.getElementById('enableEntropyFilter').checked = true;
    document.getElementById('enableContextFilter').checked = true;
    document.getElementById('maskSecretsInExport').checked = true;
    document.getElementById('includeMetadataInExport').checked = true;
    document.getElementById('enableInPageHighlighting').checked = false;
    document.getElementById('enableHighlightControls').checked = true;

    console.log('✅ Settings reset to defaults');
}

async function handleWhitelist() {
    console.log('📝 Handling whitelist...');

    if (!currentTab) {
        console.error('❌ No current tab for whitelist operation');
        return;
    }

    try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;

        // Get current whitelist
        const storage = await browser.storage.local.get(['whitelistedDomains']);
        let whitelistedDomains = storage.whitelistedDomains || [];

        // Check if already whitelisted
        const isWhitelisted = whitelistedDomains.some(d => {
            if (d.startsWith('*.')) {
                const baseDomain = d.substring(2);
                return domain === baseDomain || domain.endsWith('.' + baseDomain);
            }
            return domain === d;
        });

        if (isWhitelisted) {
            // Remove from whitelist
            const domainToRemove = whitelistedDomains.find(d => {
                if (d.startsWith('*.')) {
                    const baseDomain = d.substring(2);
                    return domain === baseDomain || domain.endsWith('.' + baseDomain);
                }
                return domain === d;
            });

            if (domainToRemove) {
                whitelistedDomains = whitelistedDomains.filter(d => d !== domainToRemove);
                await browser.storage.local.set({ whitelistedDomains });
                console.log('✅ Removed from whitelist:', domainToRemove);
                alert(`✅ Scanner enabled for ${domain}\n\nPage will reload.`);
                browser.tabs.reload(currentTab.id);
            }
        } else {
            // Add to whitelist (simple version - just exact domain)
            if (!whitelistedDomains.includes(domain)) {
                whitelistedDomains.push(domain);
                await browser.storage.local.set({ whitelistedDomains });
                console.log('✅ Added to whitelist:', domain);
                alert(`🔕 Scanner disabled for ${domain}\n\nPage will reload.`);
                browser.tabs.reload(currentTab.id);
            }
        }

        // Update UI
        setTimeout(updateWhitelistStatus, 500);

    } catch (error) {
        console.error('❌ Whitelist error:', error);
        alert('Error updating whitelist: ' + error.message);
    }
}

function toggleExport() {
    console.log('📊 Toggling export dropdown...');
    const dropdown = document.getElementById('exportOptions');
    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
        console.log(`📊 Export dropdown ${isVisible ? 'hidden' : 'shown'}`);
    }
}

async function exportData(format) {
    console.log('📤 Exporting data as:', format);

    // Hide dropdown
    const dropdown = document.getElementById('exportOptions');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    try {
        updateStatus('active', `Exporting as ${format.toUpperCase()}...`);

        if (!currentTab) {
            throw new Error('No active tab');
        }

        // Try to get findings from content script
        let findings = [];
        try {
            const response = await browser.tabs.sendMessage(currentTab.id, {
                action: 'getCurrentFindings'
            });
            if (response && response.findings) {
                findings = response.findings;
            }
        } catch (error) {
            console.log('📡 Could not get findings from content script');
        }

        // Create export data
        const url = new URL(currentTab.url);
        const exportData = {
            timestamp: new Date().toISOString(),
            domain: url.hostname,
            url: currentTab.url,
            title: currentTab.title,
            findings: findings.map(f => ({
                type: f.type || 'Unknown',
                risk: f.risk || 'unknown',
                value: f.maskedValue || 'Hidden',
                context: f.context || '',
                position: f.position || 0
            })),
            summary: {
                total: findings.length,
                critical: findings.filter(f => f.risk === 'critical').length,
                high: findings.filter(f => f.risk === 'high').length,
                medium: findings.filter(f => f.risk === 'medium').length,
                low: findings.filter(f => f.risk === 'low').length
            }
        };

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ferretwatch-${url.hostname}-${timestamp}.${format}`;

        // Create file content
        let content;
        if (format === 'json') {
            content = JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            content = convertToCSV(exportData);
        }

        // Download file
        downloadFile(content, filename);

        updateStatus('active', `✅ Exported ${findings.length} findings`);
        console.log('✅ Export completed:', filename);

        setTimeout(() => updateStatus('active', 'Scanner ready'), 3000);

    } catch (error) {
        console.error('❌ Export error:', error);
        updateStatus('error', 'Export failed');
    }
}

function convertToCSV(data) {
    const headers = ['Domain', 'URL', 'Type', 'Risk', 'Value', 'Context', 'Timestamp'];
    const rows = [headers.join(',')];

    data.findings.forEach(finding => {
        const row = [
            `"${data.domain}"`,
            `"${data.url}"`,
            `"${finding.type}"`,
            `"${finding.risk}"`,
            `"${finding.value}"`,
            `"${finding.context.replace(/"/g, '""')}"`,
            `"${data.timestamp}"`
        ];
        rows.push(row.join(','));
    });

    return rows.join('\n');
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportSessionHistory() {
    console.log('📚 Exporting session history...');
    alert('Session history export is not implemented yet.');
}

async function updateWhitelistStatus() {
    if (!currentTab) return;

    try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;

        // Check whitelist
        const storage = await browser.storage.local.get(['whitelistedDomains']);
        const whitelistedDomains = storage.whitelistedDomains || [];

        const isWhitelisted = whitelistedDomains.some(d => {
            if (d.startsWith('*.')) {
                const baseDomain = d.substring(2);
                return domain === baseDomain || domain.endsWith('.' + baseDomain);
            }
            return domain === d;
        });

        const whitelistBtn = document.getElementById('whitelistBtn');
        const domainInfo = document.getElementById('currentDomain');

        if (isWhitelisted) {
            whitelistBtn.textContent = 'Remove from Whitelist';
            whitelistBtn.className = 'btn btn-small btn-success';
            domainInfo.style.color = '#95a5a6';
            updateStatus('warning', 'Scanner disabled for this domain');
        } else {
            whitelistBtn.textContent = 'Add to Whitelist';
            whitelistBtn.className = 'btn btn-small';
            domainInfo.style.color = '';
            updateStatus('active', 'Scanner ready');
        }

    } catch (error) {
        console.error('❌ Error updating whitelist status:', error);
    }
}

async function updateWhitelistInfo() {
    try {
        const storage = await browser.storage.local.get(['whitelistedDomains']);
        const whitelistedDomains = storage.whitelistedDomains || [];
        document.getElementById('whitelistCount').textContent = whitelistedDomains.length;
    } catch (error) {
        console.error('❌ Error loading whitelist info:', error);
        document.getElementById('whitelistCount').textContent = '0';
    }
}

function updateStatus(type, message) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot) statusDot.className = `status-dot ${type}`;
    if (statusText) statusText.textContent = message;

    console.log(`📊 Status: ${type} - ${message}`);
}

console.log('🎯 FerretWatch popup script loaded');
