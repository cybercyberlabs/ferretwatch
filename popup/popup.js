/**
 * Simple and reliable popup script for FerretWatch
 * Uses direct event handlers for maximum compatibility
 */

// Global variables
let currentTab = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initializePopup, 100);
});

async function initializePopup() {
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

        // Load and display current findings
        await loadCurrentFindings();

        // Update status
        updateStatus('active', 'Scanner ready');

    } catch (error) {
        console.error('❌ Popup initialization error:', error);
        updateStatus('error', 'Initialization failed');
    }
}

function setupButtonHandlers() {
    // Rescan button
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.onclick = function () {
            handleRescan();
        };
    }

    // API Explorer button
    const explorerBtn = document.getElementById('explorerBtn');
    if (explorerBtn) {
        explorerBtn.onclick = function () {
            openApiExplorer();
        };
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');

    if (settingsBtn) {
        settingsBtn.onclick = function () {
            showSettings();
        };
    }

    // Whitelist button
    const whitelistBtn = document.getElementById('whitelistBtn');
    if (whitelistBtn) {
        whitelistBtn.onclick = function () {
            handleWhitelist();
        };
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.onclick = function () {
            toggleExport();
        };
    }

    // Settings modal close button
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) {
        closeSettings.onclick = function () {
            hideSettings();
        };
    }

    // Save settings button (now just close)
    const saveSettings = document.getElementById('saveSettings');
    if (saveSettings) {
        saveSettings.onclick = function () {
            saveSettingsData();
        };
    }

    // Export dropdown options
    const exportJSON = document.getElementById('exportJSON');
    if (exportJSON) {
        exportJSON.onclick = function () {
            exportData('json');
        };
    }

    const exportCSV = document.getElementById('exportCSV');
    if (exportCSV) {
        exportCSV.onclick = function () {
            exportData('csv');
        };
    }

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.onclick = function () {
            handleFindingsFilter(this.dataset.filter);
        };
    });

    // Manage Whitelist button
    const manageWhitelist = document.getElementById('manageWhitelist');
    if (manageWhitelist) {
        manageWhitelist.onclick = function () {
            toggleWhitelistView();
        };
    }

    // Modal click-outside to close
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.onclick = function (e) {
            if (e.target === settingsModal) {
                hideSettings();
            }
        };
    }
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

                // Update findings display
                if (response.findings) {
                    displayFindings(response.findings);
                }
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

// Open API Explorer in a new tab
function openApiExplorer() {
    if (currentTab) {
        // Pass the target tabId in the URL - using new v2 explorer
        browser.tabs.create({
            url: `explorer-v2.html?tabId=${currentTab.id}`
        });
    } else {
        console.error('No active tab to scan');
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

async function loadSettingsData() {
    console.log('📖 Loading settings data...');

    // Load whitelist info
    updateWhitelistInfo();

    // Load debug mode setting
    try {
        const storage = await browser.storage.local.get(['debugMode']);
        const debugMode = storage.debugMode || false;
        const debugToggle = document.getElementById('debugModeToggle');
        if (debugToggle) {
            debugToggle.checked = debugMode;
            console.log('📖 Debug mode loaded:', debugMode);
        }
    } catch (error) {
        console.error('❌ Error loading debug mode setting:', error);
    }
}

async function saveSettingsData() {
    console.log('💾 Saving settings...');

    try {
        // Save debug mode setting
        const debugToggle = document.getElementById('debugModeToggle');
        if (debugToggle) {
            const debugMode = debugToggle.checked;
            await browser.storage.local.set({ debugMode });
            console.log('💾 Debug mode saved:', debugMode);
        }

        console.log('✅ Settings saved successfully');
    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }

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
    const dropdown = document.getElementById('exportOptions');
    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
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

        // Try to get findings from content script with multiple approaches
        let findings = [];

        // Method 1: Try to get via message
        try {
            console.log('📤 Trying method 1: message to content script');
            const response = await browser.tabs.sendMessage(currentTab.id, {
                action: 'getCurrentFindings'
            });
            if (response && response.success && Array.isArray(response.findings) && response.findings.length > 0) {
                findings = response.findings;
                console.log('✅ Method 1 success: Got', findings.length, 'findings');
            } else {
                console.log('⚠️ Method 1: No findings or invalid response');
            }
        } catch (error) {
            console.log('❌ Method 1 failed:', error.message);
        }

        // Method 2: Try via script injection if method 1 failed
        if (findings.length === 0) {
            try {
                console.log('📤 Trying method 2: script injection');
                const results = await browser.tabs.executeScript(currentTab.id, {
                    code: `
                        (function() {
                            console.log('🔍 Export: Checking for findings...');
                            
                            // Try multiple global variables
                            if (window.lastScanResults && Array.isArray(window.lastScanResults) && window.lastScanResults.length > 0) {
                                console.log('✅ Found lastScanResults:', window.lastScanResults.length);
                                return window.lastScanResults;
                            }
                            
                            if (window.FerretWatchDebug && typeof window.FerretWatchDebug.getLastScanResults === 'function') {
                                const results = window.FerretWatchDebug.getLastScanResults();
                                if (Array.isArray(results) && results.length > 0) {
                                    console.log('✅ Found via debug object:', results.length);
                                    return results;
                                }
                            }
                            
                            // Try to trigger a fresh scan
                            if (window.FerretWatchDebug && typeof window.FerretWatchDebug.scanCurrentPage === 'function') {
                                console.log('🔍 Triggering fresh scan...');
                                const scanResults = window.FerretWatchDebug.scanCurrentPage();
                                if (Array.isArray(scanResults)) {
                                    console.log('✅ Fresh scan results:', scanResults.length);
                                    return scanResults;
                                }
                            }
                            
                            console.log('❌ No findings found via any method');
                            return [];
                        })();
                    `
                });

                if (results && results[0] && Array.isArray(results[0]) && results[0].length > 0) {
                    findings = results[0];
                    console.log('✅ Method 2 success: Got', findings.length, 'findings');
                } else {
                    console.log('⚠️ Method 2: No findings found');
                }
            } catch (error) {
                console.log('❌ Method 2 failed:', error.message);
            }
        }

        // Method 3: Force a scan and try again
        if (findings.length === 0) {
            try {
                console.log('📤 Trying method 3: force scan then export');
                await browser.tabs.executeScript(currentTab.id, {
                    code: `
                        (async function() {
                            console.log('🔍 Force scan for export...');
                            if (window.FerretWatchDebug && typeof window.FerretWatchDebug.scanCurrentPage === 'function') {
                                try {
                                    const results = await window.FerretWatchDebug.scanCurrentPage();
                                    window.lastExportFindings = results;
                                    console.log('✅ Force scan complete:', results.length);
                                    return results;
                                } catch (error) {
                                    console.error('❌ Force scan error:', error);
                                    return [];
                                }
                            }
                            return [];
                        })();
                    `
                });

                // Wait a moment then try to get the results
                await new Promise(resolve => setTimeout(resolve, 1000));

                const results = await browser.tabs.executeScript(currentTab.id, {
                    code: `window.lastExportFindings || []`
                });

                if (results && results[0] && Array.isArray(results[0]) && results[0].length > 0) {
                    findings = results[0];
                    console.log('✅ Method 3 success: Got', findings.length, 'findings');
                }
            } catch (error) {
                console.log('❌ Method 3 failed:', error.message);
            }
        }

        // Create export data even if no findings (for debugging)
        const url = new URL(currentTab.url);
        const exportData = {
            timestamp: new Date().toISOString(),
            domain: url.hostname,
            url: currentTab.url,
            title: currentTab.title,
            scannerVersion: '2.2.0',
            findings: findings.map(f => ({
                type: f.type || 'Unknown',
                risk: f.riskLevel || f.risk || 'unknown',
                value: f.value || 'Unknown',
                context: f.context || '',
                position: f.position || 0,
                timestamp: f.timestamp || new Date().toISOString()
            })),
            summary: {
                total: findings.length,
                critical: findings.filter(f => (f.riskLevel || f.risk) === 'critical').length,
                high: findings.filter(f => (f.riskLevel || f.risk) === 'high').length,
                medium: findings.filter(f => (f.riskLevel || f.risk) === 'medium').length,
                low: findings.filter(f => (f.riskLevel || f.risk) === 'low').length
            },
            exportMethod: findings.length > 0 ? 'success' : 'no_findings',
            debugInfo: {
                tabId: currentTab.id,
                userAgent: navigator.userAgent,
                exportTime: Date.now()
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

        if (findings.length > 0) {
            updateStatus('active', `✅ Exported ${findings.length} findings`);
            console.log('✅ Export completed:', filename, 'with', findings.length, 'findings');
        } else {
            updateStatus('warning', `⚠️ Exported empty dataset - scan page first`);
            console.log('⚠️ Export completed with no findings. File created for debugging.');
        }

        setTimeout(() => updateStatus('active', 'Scanner ready'), 3000);

    } catch (error) {
        console.error('❌ Export error:', error);
        updateStatus('error', 'Export failed');
    }
}

function convertToCSV(data) {
    const headers = ['Domain', 'URL', 'Type', 'Risk', 'Value', 'Context', 'Timestamp'];
    const rows = [headers.join(',')];

    if (data.findings && data.findings.length > 0) {
        data.findings.forEach(finding => {
            const row = [
                `"${data.domain || ''}"`,
                `"${data.url || ''}"`,
                `"${finding.type || 'Unknown'}"`,
                `"${finding.risk || 'unknown'}"`,
                `"${finding.value || 'Unknown'}"`,
                `"${(finding.context || '').replace(/"/g, '""')}"`,
                `"${finding.timestamp || data.timestamp || new Date().toISOString()}"`
            ];
            rows.push(row.join(','));
        });
    } else {
        // Add a row indicating no findings
        const row = [
            `"${data.domain || ''}"`,
            `"${data.url || ''}"`,
            `"No findings"`,
            `"none"`,
            `"N/A"`,
            `"Page scanned but no credentials detected"`,
            `"${data.timestamp || new Date().toISOString()}"`
        ];
        rows.push(row.join(','));
    }

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
        const itemsHtml = whitelistedDomains.map((domain) => `
            <div class="whitelist-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                <span class="domain-name" style="font-family: monospace; color: #333;">${domain}</span>
                <button class="btn btn-tiny btn-danger remove-whitelist-btn" data-domain="${domain}" style="padding: 2px 8px; font-size: 11px;">Remove</button>
            </div>
        `).join('');

        whitelistList.innerHTML = itemsHtml;

        // Add event listeners to remove buttons
        whitelistList.querySelectorAll('.remove-whitelist-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                removeDomainFromWhitelist(this.dataset.domain);
            });
        });
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

// Bucket-specific helper functions
function createBucketInfoHtml(bucketInfo) {
    if (!bucketInfo) return '';

    const accessStatus = bucketInfo.accessible ? 'accessible' :
        bucketInfo.accessible === false ? 'denied' : 'unknown';
    const accessText = bucketInfo.accessible ? 'Public Access' :
        bucketInfo.accessible === false ? 'Access Denied' : 'Unknown Status';

    const providerAttr = bucketInfo.provider ? `data-provider="${escapeHtml(bucketInfo.provider)}"` : '';

    return `
        <div class="finding-bucket-info" ${providerAttr}>
            <div class="bucket-detail">
                <span class="bucket-detail-label">Provider:</span>
                <span class="bucket-detail-value">${escapeHtml(bucketInfo.provider || 'Unknown').toUpperCase()}</span>
            </div>
            <div class="bucket-detail">
                <span class="bucket-detail-label">Bucket:</span>
                <span class="bucket-detail-value">${escapeHtml(bucketInfo.bucketName || 'Unknown')}</span>
            </div>
            ${bucketInfo.region ? `
            <div class="bucket-detail">
                <span class="bucket-detail-label">Region:</span>
                <span class="bucket-detail-value">${escapeHtml(bucketInfo.region)}</span>
            </div>
            ` : ''}
            <div class="bucket-detail">
                <span class="bucket-detail-label">Status:</span>
                <span class="bucket-detail-value bucket-${accessStatus}">${accessText}</span>
            </div>
            ${bucketInfo.testResults && bucketInfo.testResults.statusCode ? `
            <div class="bucket-detail">
                <span class="bucket-detail-label">Response:</span>
                <span class="bucket-detail-value">${bucketInfo.testResults.statusCode} ${bucketInfo.testResults.responseType || ''}</span>
            </div>
            ` : ''}
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function maskSecret(value) {
    if (!value || value.length <= 8) return escapeHtml(value);

    // For bucket URLs, don't mask them as they're not secrets
    if (value.includes('s3.amazonaws.com') ||
        value.includes('storage.googleapis.com') ||
        value.includes('blob.core.windows.net') ||
        value.startsWith('s3://') ||
        value.startsWith('gs://')) {
        return escapeHtml(value);
    }

    // For other values, apply masking
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const masked = '*'.repeat(Math.min(value.length - 8, 20));
    return escapeHtml(start + masked + end);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log('✅ Copied to clipboard:', text.substring(0, 50) + '...');

        // Show temporary feedback
        const originalStatus = document.getElementById('statusText').textContent;
        updateStatus('active', '📋 Copied to clipboard');
        setTimeout(() => {
            updateStatus('active', originalStatus);
        }, 2000);
    } catch (error) {
        console.error('❌ Failed to copy to clipboard:', error);

        // Fallback: select text for manual copy
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        updateStatus('warning', '📋 Text selected - press Ctrl+C');
    }
}

async function dismissBucketFinding(bucketUrl) {
    try {
        console.log('❌ Dismissing bucket finding:', bucketUrl);

        if (!currentTab) {
            throw new Error('No active tab');
        }

        // Send message to content script to dismiss the finding
        const response = await browser.tabs.sendMessage(currentTab.id, {
            action: 'dismissFinding',
            value: bucketUrl,
            category: 'cloudStorage'
        });

        if (response && response.success) {
            console.log('✅ Bucket finding dismissed');
            updateStatus('active', 'Finding dismissed');

            // Refresh the findings display
            await loadCurrentFindings();
        } else {
            console.log('⚠️ Dismiss response unclear');
            updateStatus('warning', 'Dismiss completed');
        }

    } catch (error) {
        console.error('❌ Error dismissing bucket finding:', error);
        updateStatus('error', 'Failed to dismiss finding');
    }
}

// Make bucket functions globally accessible
window.copyToClipboard = copyToClipboard;
window.dismissBucketFinding = dismissBucketFinding;

// Global variable to store current findings for filtering
let currentFindings = [];
let currentFilter = 'all';

function handleFindingsFilter(filter) {
    console.log('🔍 Applying filter:', filter);

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    currentFilter = filter;
    displayFilteredFindings(currentFindings, filter);
}

function displayFilteredFindings(findings, filter = 'all') {
    let filteredFindings = findings;

    switch (filter) {
        case 'buckets':
            filteredFindings = findings.filter(f => f.category === 'cloudStorage');
            break;
        case 'other':
            filteredFindings = findings.filter(f => f.category !== 'cloudStorage');
            break;
        case 'high-risk':
            filteredFindings = findings.filter(f =>
                f.riskLevel === 'critical' || f.riskLevel === 'high' ||
                (f.category === 'cloudStorage' && f.bucketInfo && f.bucketInfo.accessible === true)
            );
            break;
        case 'all':
        default:
            filteredFindings = findings;
            break;
    }

    console.log(`🔍 Filter "${filter}": ${filteredFindings.length}/${findings.length} findings`);
    displayFindingsInternal(filteredFindings, findings.length);
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

async function loadCurrentFindings() {
    console.log('📋 Loading current findings...');

    if (!currentTab) {
        console.log('❌ No current tab available');
        return;
    }

    try {
        // Try to get findings from content script
        const response = await browser.tabs.sendMessage(currentTab.id, {
            action: 'getCurrentFindings'
        });

        if (response && response.success && Array.isArray(response.findings)) {
            console.log(`✅ Loaded ${response.findings.length} findings`);
            displayFindings(response.findings);
        } else {
            console.log('⚠️ No findings available or invalid response');
            displayFindings([]);
        }
    } catch (error) {
        console.log('❌ Failed to load findings:', error.message);
        displayFindings([]);
    }
}

function displayFindings(findings) {
    console.log('🖼️ Displaying findings:', findings.length);

    // Store findings globally for filtering
    currentFindings = findings;

    const findingsSection = document.getElementById('findingsSection');
    const findingsFilters = document.getElementById('findingsFilters');

    if (!findingsSection) {
        console.error('❌ Findings section not found');
        return;
    }

    if (findings.length === 0) {
        findingsSection.style.display = 'none';
        return;
    }

    // Show findings section
    findingsSection.style.display = 'block';

    // Show/hide filters based on findings diversity
    const bucketFindings = findings.filter(f => f.category === 'cloudStorage');
    const otherFindings = findings.filter(f => f.category !== 'cloudStorage');
    const hasMultipleTypes = bucketFindings.length > 0 && otherFindings.length > 0;

    if (findingsFilters) {
        findingsFilters.style.display = hasMultipleTypes || findings.length > 3 ? 'flex' : 'none';
    }

    // Display with current filter
    displayFilteredFindings(findings, currentFilter);
}

function displayFindingsInternal(findings, totalCount = null) {
    const findingsCount = document.getElementById('findingsCount');
    const findingsList = document.getElementById('findingsList');

    if (!findingsCount || !findingsList) {
        console.error('❌ Findings display elements not found');
        return;
    }

    // Separate bucket findings from other findings
    const bucketFindings = findings.filter(f => f.category === 'cloudStorage');
    const otherFindings = findings.filter(f => f.category !== 'cloudStorage');

    // Update count with breakdown
    const bucketCount = bucketFindings.length;
    const otherCount = otherFindings.length;
    const displayCount = findings.length;
    const total = totalCount || displayCount;

    if (totalCount && displayCount < totalCount) {
        // Showing filtered results
        if (bucketCount > 0 && otherCount > 0) {
            findingsCount.textContent = `${displayCount}/${total} (${bucketCount} buckets, ${otherCount} other)`;
        } else if (bucketCount > 0) {
            findingsCount.textContent = `${displayCount}/${total} bucket${displayCount === 1 ? '' : 's'}`;
        } else {
            findingsCount.textContent = `${displayCount}/${total}`;
        }
    } else {
        // Showing all results
        if (bucketCount > 0 && otherCount > 0) {
            findingsCount.textContent = `${displayCount} (${bucketCount} buckets, ${otherCount} other)`;
        } else if (bucketCount > 0) {
            findingsCount.textContent = `${displayCount} bucket${displayCount === 1 ? '' : 's'}`;
        } else {
            findingsCount.textContent = displayCount;
        }
    }

    // Clear existing findings
    findingsList.innerHTML = '';

    if (findings.length === 0) {
        findingsList.innerHTML = '<div class="no-findings">No findings match the current filter</div>';
        return;
    }

    // Sort findings: bucket findings first (by risk level), then other findings
    const sortedFindings = [
        ...sortFindingsByRisk(bucketFindings),
        ...sortFindingsByRisk(otherFindings)
    ];

    // Add section headers if we have both types and not filtering
    if (bucketCount > 0 && otherCount > 0 && currentFilter === 'all') {
        // Add bucket findings section
        if (bucketCount > 0) {
            const bucketHeader = createSectionHeader('Cloud Storage Buckets', bucketCount);
            findingsList.appendChild(bucketHeader);

            sortFindingsByRisk(bucketFindings).forEach(finding => {
                const findingElement = createFindingElement(finding);
                findingsList.appendChild(findingElement);
            });
        }

        // Add other findings section
        if (otherCount > 0) {
            const otherHeader = createSectionHeader('Other Security Issues', otherCount);
            findingsList.appendChild(otherHeader);

            sortFindingsByRisk(otherFindings).forEach(finding => {
                const findingElement = createFindingElement(finding);
                findingsList.appendChild(findingElement);
            });
        }
    } else {
        // Just display all findings sorted by risk
        sortedFindings.forEach(finding => {
            const findingElement = createFindingElement(finding);
            findingsList.appendChild(findingElement);
        });
    }
}

function groupFindingsByType(findings) {
    const groups = {};

    findings.forEach(finding => {
        const type = finding.type || 'Unknown';
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(finding);
    });

    return groups;
}

function sortFindingsByRisk(findings) {
    const riskOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };

    return findings.sort((a, b) => {
        const aRisk = riskOrder[a.riskLevel] !== undefined ? riskOrder[a.riskLevel] : 4;
        const bRisk = riskOrder[b.riskLevel] !== undefined ? riskOrder[b.riskLevel] : 4;

        if (aRisk !== bRisk) {
            return aRisk - bRisk;
        }

        // Secondary sort by type
        const aType = a.type || 'Unknown';
        const bType = b.type || 'Unknown';
        return aType.localeCompare(bType);
    });
}

function createSectionHeader(title, count) {
    const header = document.createElement('div');
    header.className = 'findings-section-header';
    header.innerHTML = `
        <h5 class="section-title">${escapeHtml(title)}</h5>
        <span class="section-count">${count}</span>
    `;
    return header;
}

function createFindingElement(finding) {
    const div = document.createElement('div');
    div.className = 'finding-item';

    const isBucketFinding = finding.category === 'cloudStorage' && finding.bucketInfo;

    // Add data attributes for styling
    if (isBucketFinding) {
        div.setAttribute('data-category', 'cloudStorage');
        if (finding.bucketInfo.provider) {
            div.setAttribute('data-provider', finding.bucketInfo.provider);
        }
    }

    div.innerHTML = `
        <div class="finding-header">
            <div class="finding-type">${escapeHtml(finding.type || 'Unknown')}</div>
            <div class="finding-risk ${finding.riskLevel || 'medium'}">${finding.riskLevel || 'medium'}</div>
        </div>
        <div class="finding-value">${maskSecret(finding.value || 'Unknown')}</div>
        ${isBucketFinding ? createBucketInfoHtml(finding.bucketInfo) : ''}
        <div class="finding-actions">
            <button class="finding-action-btn copy" data-value="${escapeHtml(finding.value || '')}">
                📋 Copy
            </button>
            ${isBucketFinding && finding.bucketInfo.testUrl ?
            `<button class="finding-action-btn test-url" data-value="${escapeHtml(finding.bucketInfo.testUrl || '')}">
                    🔗 Test URL
                </button>` : ''}
            ${isBucketFinding ?
            `<button class="finding-action-btn dismiss" data-value="${escapeHtml(finding.value || '')}">
                    ❌ Dismiss
                </button>` : ''}
        </div>
    `;

    // Add event listeners to the buttons
    const copyBtn = div.querySelector('.finding-action-btn.copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            copyToClipboard(this.dataset.value);
        });
    }

    const testUrlBtn = div.querySelector('.finding-action-btn.test-url');
    if (testUrlBtn) {
        testUrlBtn.addEventListener('click', function() {
            copyToClipboard(this.dataset.value);
        });
    }

    const dismissBtn = div.querySelector('.finding-action-btn.dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', function() {
            dismissBucketFinding(this.dataset.value);
        });
    }

    return div;
}

console.log('🎯 FerretWatch popup script loaded');
