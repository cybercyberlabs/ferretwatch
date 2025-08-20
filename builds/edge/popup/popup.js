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
    
    // Save settings button (now just close)
    const saveSettings = document.getElementById('saveSettings');
    if (saveSettings) {
        saveSettings.onclick = function() {
            console.log('💾 Save settings clicked!');
            saveSettingsData();
        };
        console.log('✅ Save settings button ready');
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
    
    // Manage Whitelist button
    const manageWhitelist = document.getElementById('manageWhitelist');
    if (manageWhitelist) {
        manageWhitelist.onclick = function() {
            console.log('📋 Manage whitelist clicked!');
            toggleWhitelistView();
        };
        console.log('✅ Manage whitelist button ready');
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
    console.log('🔧 Modal element found:', !!modal);
    
    if (modal) {
        console.log('🔧 Setting modal display to flex...');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        
        console.log('🔧 Adding modal-open class to body...');
        document.body.classList.add('modal-open');
        
        console.log('🔧 Loading settings data...');
        loadSettingsData();
        
        console.log('✅ Modal should now be visible');
    } else {
        console.error('❌ Settings modal not found in DOM!');
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
    
    // Load whitelist info
    updateWhitelistInfo();
}

function saveSettingsData() {
    console.log('💾 Closing settings...');
    hideSettings();
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
            if (response && response.success && response.findings) {
                findings = response.findings;
            }
        } catch (error) {
            console.log('Could not get findings from content script, trying fallback...');
            
            // Fallback: try to get findings via script injection
            try {
                const results = await browser.tabs.executeScript(currentTab.id, {
                    code: `
                        (function() {
                            // Try to get from global debug object
                            if (window.FerretWatchDebug && window.FerretWatchDebug.getLastScanResults) {
                                return window.FerretWatchDebug.getLastScanResults();
                            }
                            // Try to get from lastScanResults variable if exposed
                            if (typeof window.lastScanResults !== 'undefined' && Array.isArray(window.lastScanResults)) {
                                return window.lastScanResults;
                            }
                            return [];
                        })();
                    `
                });
                
                if (results && results[0] && Array.isArray(results[0])) {
                    findings = results[0];
                }
            } catch (fallbackError) {
                console.log('Fallback export method also failed');
            }
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
                risk: f.riskLevel || f.risk || 'unknown',  // Use riskLevel first, fall back to risk
                value: f.value || 'Unknown',
                context: f.context || '',
                position: f.position || 0
            })),
            summary: {
                total: findings.length,
                critical: findings.filter(f => (f.riskLevel || f.risk) === 'critical').length,
                high: findings.filter(f => (f.riskLevel || f.risk) === 'high').length,
                medium: findings.filter(f => (f.riskLevel || f.risk) === 'medium').length,
                low: findings.filter(f => (f.riskLevel || f.risk) === 'low').length
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

function toggleWhitelistView() {
    console.log('📋 Toggling whitelist view...');
    const whitelistView = document.getElementById('whitelistView');
    const manageButton = document.getElementById('manageWhitelist');
    
    if (whitelistView && manageButton) {
        const isVisible = whitelistView.style.display !== 'none';
        
        if (isVisible) {
            // Hide the whitelist
            whitelistView.style.display = 'none';
            manageButton.textContent = 'Manage Whitelist';
            console.log('📋 Whitelist view hidden');
        } else {
            // Show the whitelist
            whitelistView.style.display = 'block';
            manageButton.textContent = 'Hide Whitelist';
            displayWhitelistItems();
            console.log('📋 Whitelist view shown');
        }
    }
}

async function displayWhitelistItems() {
    console.log('📋 Loading whitelist items...');
    const whitelistList = document.getElementById('whitelistList');
    
    if (!whitelistList) {
        console.error('❌ Whitelist list element not found');
        return;
    }
    
    try {
        const storage = await browser.storage.local.get(['whitelistedDomains']);
        const whitelistedDomains = storage.whitelistedDomains || [];
        
        if (whitelistedDomains.length === 0) {
            whitelistList.innerHTML = '<p style="color: #666; font-style: italic; margin: 10px 0;">No domains whitelisted</p>';
            console.log('📋 No whitelisted domains found');
            return;
        }
        
        // Create HTML for each whitelisted domain
        const itemsHtml = whitelistedDomains.map((domain, index) => `
            <div class="whitelist-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                <span class="domain-name" style="font-family: monospace; color: #333;">${domain}</span>
                <button class="btn btn-tiny btn-danger" onclick="removeDomainFromWhitelist('${domain}')" style="padding: 2px 8px; font-size: 11px;">Remove</button>
            </div>
        `).join('');
        
        whitelistList.innerHTML = itemsHtml;
        console.log(`✅ Displayed ${whitelistedDomains.length} whitelisted domains`);
        
    } catch (error) {
        console.error('❌ Error loading whitelist items:', error);
        whitelistList.innerHTML = '<p style="color: #e74c3c; font-style: italic; margin: 10px 0;">Error loading whitelist</p>';
    }
}

async function removeDomainFromWhitelist(domain) {
    console.log('🗑️ Removing domain from whitelist:', domain);
    
    try {
        const storage = await browser.storage.local.get(['whitelistedDomains']);
        let whitelistedDomains = storage.whitelistedDomains || [];
        
        // Remove the domain
        const originalLength = whitelistedDomains.length;
        whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
        
        if (whitelistedDomains.length < originalLength) {
            // Save the updated list
            await browser.storage.local.set({ whitelistedDomains });
            
            // Refresh the display
            displayWhitelistItems();
            updateWhitelistInfo();
            updateWhitelistStatus();
            
            console.log('✅ Domain removed from whitelist:', domain);
            alert(`✅ Removed ${domain} from whitelist`);
        } else {
            console.log('⚠️ Domain not found in whitelist:', domain);
            alert(`Domain ${domain} was not found in whitelist`);
        }
        
    } catch (error) {
        console.error('❌ Error removing domain from whitelist:', error);
        alert('Error removing domain from whitelist: ' + error.message);
    }
}

// Make the remove function globally accessible for inline onclick handlers
window.removeDomainFromWhitelist = removeDomainFromWhitelist;

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
