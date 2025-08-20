/**
 * Simplified popup script for FerretWatch
 * Works with the simplified content script
 */

document.addEventListener('DOMContentLoaded', async function() {
    await initializePopup();
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
        
        // Simple status update
        updateStatus('active', 'Scanner ready');
        displayEmptyResults();
        
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
    
    // Settings button - show simple alert for now
    document.getElementById('settingsBtn').addEventListener('click', () => {
        showSettingsInfo();
    });
    
    // Highlight button - disabled for simplified version
    document.getElementById('highlightBtn').addEventListener('click', () => {
        alert('Highlighting feature not available in this simplified version. Check browser console for detailed findings.');
    });
    
    // Whitelist button - disabled for simplified version  
    document.getElementById('whitelistBtn').addEventListener('click', () => {
        alert('Whitelist feature not available in this simplified version.');
    });
    
    // Export buttons - disabled for simplified version
    document.getElementById('exportBtn').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Export features not available in this simplified version. Check browser console for detailed findings.');
    });
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
        browser.tabs.create({ 
            url: 'https://github.com/cybercyberlabs' 
        });
    });
}

function showSettingsInfo() {
    const settingsInfo = `
FerretWatch Settings:

This is a simplified version of the scanner. 
To customize detection patterns, edit the DETECTION_PATTERNS array in content.js.

Current features:
✅ Automatic page scanning
✅ Smart notification system  
✅ Console logging with masked values
✅ Manual rescanning

Advanced features like highlighting, export, and whitelist 
are available in the full version.

Check the browser console (F12) for detailed scan results.
    `;
    
    alert(settingsInfo);
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
        
        // Try to send rescan message to content script
        try {
            const response = await browser.tabs.sendMessage(currentTab.id, { 
                action: 'rescan' 
            });
            
            if (response && response.success) {
                updateStatus('active', 'Rescan complete - check console for results');
                updateSimpleResults(response.findings?.length || 0);
            } else {
                updateStatus('warning', 'Rescan completed - check console');
                updateSimpleResults(0);
            }
        } catch (error) {
            // If content script communication fails, just reload the content script
            console.log('Direct messaging failed, attempting script reload...');
            
            try {
                // Inject and execute a simple rescan
                await browser.tabs.executeScript(currentTab.id, {
                    code: `
                        if (typeof scanForCredentials === 'function') {
                            const results = scanForCredentials();
                            console.log('🔄 Manual rescan completed');
                            results.length;
                        } else {
                            console.log('🔄 Reloading scanner...');
                            window.location.reload();
                            0;
                        }
                    `
                });
                
                updateStatus('active', 'Rescan initiated - check console');
                updateSimpleResults('?');
                
            } catch (scriptError) {
                console.error('Script execution failed:', scriptError);
                updateStatus('warning', 'Please refresh the page and try again');
                updateSimpleResults('Error');
            }
        }
        
    } catch (error) {
        console.error('Rescan error:', error);
        updateStatus('error', 'Rescan failed - try refreshing the page');
    } finally {
        // Restore button after delay
        setTimeout(() => {
            rescanBtn.innerHTML = originalText;
            rescanBtn.disabled = false;
        }, 2000);
    }
}

function updateSimpleResults(findingsCount) {
    document.getElementById('findingsCount').textContent = findingsCount;
    document.getElementById('riskLevel').textContent = findingsCount > 0 ? 'Check Console' : 'None';
    document.getElementById('scanTime').textContent = 'N/A';
}

function displayEmptyResults() {
    document.getElementById('findingsCount').textContent = '-';
    document.getElementById('riskLevel').textContent = '-';
    document.getElementById('scanTime').textContent = '-';
    document.getElementById('findingsList').style.display = 'none';
}

function updateStatus(type, message) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = `status-dot ${type}`;
    statusText.textContent = message;
}
