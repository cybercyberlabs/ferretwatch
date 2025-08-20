/**
 * FerretWatch Popup Script (Refactored for Manifest V3)
 *
 * This script handles the UI for the popup. It communicates with the
 * background script to get data and trigger actions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the popup
    init();

    // Set up event listeners
    document.getElementById('rescanBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'RESCAN_PAGE' });
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'flex';
    });

    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'none';
    });
    
    document.getElementById('saveSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'none';
    });

    document.getElementById('whitelistBtn').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'flex';
    });

    document.getElementById('confirmCancel').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
    });

    document.getElementById('confirmDomainOnly').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'ADD_TO_WHITELIST', data: { includeSubdomains: false } });
        document.getElementById('confirmModal').style.display = 'none';
    });

    document.getElementById('confirmIncludeSubdomains').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'ADD_TO_WHITELIST', data: { includeSubdomains: true } });
        document.getElementById('confirmModal').style.display = 'none';
    });

    document.getElementById('manageWhitelist').addEventListener('click', () => {
        const whitelistView = document.getElementById('whitelistView');
        whitelistView.style.display = whitelistView.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('exportJSON').addEventListener('click', () => exportData('json'));
    document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));
});

/**
 * Initializes the popup by getting the current state from the background script.
 */
async function init() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_POPUP_STATE' });
    if (response) {
        updateUI(response);
    }
}

/**
 * Updates the UI with data from the background script.
 * @param {object} state - The current state of the extension.
 */
function updateUI(state) {
    // Update domain info
    document.getElementById('currentDomain').textContent = state.currentDomain || 'N/A';

    // Update whitelist button
    const whitelistBtn = document.getElementById('whitelistBtn');
    if (state.isWhitelisted) {
        whitelistBtn.textContent = 'Remove from Whitelist';
        whitelistBtn.classList.add('btn-success');
    } else {
        whitelistBtn.textContent = 'Add to Whitelist';
        whitelistBtn.classList.remove('btn-success');
    }

    // Update whitelist view
    const whitelistList = document.getElementById('whitelistList');
    const whitelistCount = document.getElementById('whitelistCount');
    whitelistCount.textContent = state.whitelist.length;
    whitelistList.innerHTML = '';
    state.whitelist.forEach(domain => {
        const item = document.createElement('div');
        item.className = 'whitelist-item';
        item.innerHTML = `
            <span class="domain-name">${domain}</span>
            <button class="btn btn-tiny btn-danger remove-domain" data-domain="${domain}">Remove</button>
        `;
        whitelistList.appendChild(item);
    });

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-domain').forEach(button => {
        button.addEventListener('click', (e) => {
            const domain = e.target.dataset.domain;
            chrome.runtime.sendMessage({ type: 'REMOVE_FROM_WHITELIST', data: { domain } });
        });
    });
}

/**
 * Handles the export functionality.
 * @param {string} format - The format to export ('json' or 'csv').
 */
async function exportData(format) {
    const findings = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_FINDINGS' });
    if (!findings || findings.length === 0) {
        alert('No findings to export.');
        return;
    }

    const data = {
        timestamp: new Date().toISOString(),
        findings: findings
    };

    let content;
    if (format === 'json') {
        content = JSON.stringify(data, null, 2);
    } else {
        const headers = ['type', 'value', 'risk', 'context', 'timestamp', 'url', 'domain'];
        const rows = [headers.join(',')];
        findings.forEach(finding => {
            const row = headers.map(header => `"${(finding[header] || '').toString().replace(/"/g, '""')}"`);
            rows.push(row.join(','));
        });
        content = rows.join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ferretwatch-export-${new Date().toISOString()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_UI') {
        updateUI(message.data);
    }
});
