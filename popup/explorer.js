/**
 * FerretWatch API Explorer Logic
 */

let apiEndpoints = [];
let currentTabId = null;
let currentEndpoint = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Determine current tab ID (passed in URL or query background for active tab)
    // For now, we'll try to find the active tab in the window that opened this
    // But since this is opened in a new tab, we need to know which tab we are scanning.
    // Ideally, the popup passes the tabID in the URL hash or query param.

    const urlParams = new URLSearchParams(window.location.search);
    const tabIdParam = urlParams.get('tabId');

    if (tabIdParam) {
        currentTabId = parseInt(tabIdParam);
        await init(currentTabId);
    } else {
        // Fallback: Query for active tab (might be self if focused, so careful)
        // Actually, we want the *previous* active tab or the one the user came from.
        // Simplified: The popup MUST pass the tab ID.
        document.querySelector('.empty-state').textContent = 'Error: No target tab specified.';
    }

    // Event Listeners
    document.getElementById('endpoint-filter').addEventListener('input', filterEndpoints);
    document.getElementById('btn-clear-all').addEventListener('click', clearAllEndpoints);
    document.getElementById('btn-replay').addEventListener('click', replayRequest);
    document.getElementById('btn-copy-curl').addEventListener('click', copyAsCurl);
    document.getElementById('btn-test-auth').addEventListener('click', testBrokenAuth);
});

// Listen for new API endpoints from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEW_API_ENDPOINT' && message.tabId === currentTabId) {
        // Add new endpoint to the list
        const exists = apiEndpoints.some(e => e.method === message.endpoint.method && e.url === message.endpoint.url);
        if (!exists) {
            apiEndpoints.push(message.endpoint);
            renderEndpoints(apiEndpoints);

            // Visual notification - briefly highlight the count
            const countElement = document.getElementById('endpoint-count');
            countElement.style.animation = 'pulse 0.5s';
            setTimeout(() => {
                countElement.style.animation = '';
            }, 500);
        }
    }
});

async function init(tabId) {
    try {
        const tab = await browser.tabs.get(tabId);
        document.getElementById('target-url').textContent = tab.url;

        // Fetch endpoints from background
        const response = await browser.runtime.sendMessage({
            type: 'GET_API_ENDPOINTS',
            tabId: tabId
        });

        if (response && response.endpoints) {
            apiEndpoints = response.endpoints;
            renderEndpoints(apiEndpoints);
        }

    } catch (e) {
        console.error('Initialization failed:', e);
        document.getElementById('target-url').textContent = 'Connection Error';
    }
}

function renderEndpoints(endpoints) {
    const list = document.getElementById('endpoint-list');
    list.innerHTML = '';

    document.getElementById('endpoint-count').textContent = endpoints.length;

    if (endpoints.length === 0) {
        list.innerHTML = '<div class="empty-state">No API calls detected yet. Interact with the page to trigger requests.</div>';
        return;
    }

    endpoints.forEach((ep, index) => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.dataset.index = index;

        const method = document.createElement('span');
        method.className = `method-tag method-${ep.method.toUpperCase()}`;
        method.textContent = ep.method;

        const urlContainer = document.createElement('div');
        urlContainer.className = 'url-container';

        const url = document.createElement('span');
        url.className = 'url-truncate';
        // Clean URL for display - show path only
        let domain = '';
        try {
            const urlObj = new URL(ep.url);
            url.textContent = urlObj.pathname + urlObj.search;
            url.title = ep.url;
            domain = urlObj.hostname;
        } catch {
            url.textContent = ep.url;
        }

        const domainSpan = document.createElement('span');
        domainSpan.className = 'endpoint-domain';
        domainSpan.textContent = domain || 'Unknown domain';
        domainSpan.title = domain;

        const timestamp = document.createElement('span');
        timestamp.className = 'endpoint-timestamp';
        if (ep.timestamp) {
            const date = new Date(ep.timestamp);
            timestamp.textContent = date.toLocaleTimeString();
            timestamp.title = date.toLocaleString();
        } else {
            timestamp.textContent = 'Unknown';
        }

        urlContainer.appendChild(url);
        urlContainer.appendChild(domainSpan);
        urlContainer.appendChild(timestamp);

        item.appendChild(method);
        item.appendChild(urlContainer);

        // Add click event listener
        item.addEventListener('click', function() {
            selectEndpoint(parseInt(this.dataset.index));
        });

        list.appendChild(item);
    });
}

function selectEndpoint(index) {
    currentEndpoint = apiEndpoints[index];

    // Highlight sidebar item
    document.querySelectorAll('.endpoint-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
    });

    // Show detail view
    document.getElementById('default-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');

    // Populate details
    const methodBadge = document.getElementById('detail-method');
    methodBadge.textContent = currentEndpoint.method;
    methodBadge.className = `method-badge method-${currentEndpoint.method}`; // Reset class

    document.getElementById('detail-url').value = currentEndpoint.url;

    // Format headers
    const headersText = currentEndpoint.headers ? JSON.stringify(currentEndpoint.headers, null, 2) : '{}';
    document.getElementById('detail-headers').textContent = headersText;

    // Format Body
    if (currentEndpoint.body) {
        document.getElementById('body-heading').classList.remove('hidden');
        const bodyEl = document.getElementById('detail-body');
        bodyEl.classList.remove('hidden');

        if (typeof currentEndpoint.body === 'string') {
            try {
                // Try to prettify JSON body
                const json = JSON.parse(currentEndpoint.body);
                bodyEl.textContent = JSON.stringify(json, null, 2);
            } catch {
                bodyEl.textContent = currentEndpoint.body;
            }
        } else {
            bodyEl.textContent = JSON.stringify(currentEndpoint.body, null, 2);
        }
    } else {
        document.getElementById('body-heading').classList.add('hidden');
        document.getElementById('detail-body').classList.add('hidden');
    }

    // Clear analysis
    document.getElementById('analysis-output').innerHTML = '<div class="placeholder">Select an action above to test this endpoint.</div>';
}

function filterEndpoints(e) {
    const term = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.endpoint-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

function logAnalysis(message, type = 'info') {
    const output = document.getElementById('analysis-output');
    if (output.querySelector('.placeholder')) output.innerHTML = '';

    const div = document.createElement('div');
    div.className = `result-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
}

async function sendProxyRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        console.log('[Explorer] Sending PROXY_REQUEST:', { url, method, tabId: currentTabId });

        browser.runtime.sendMessage({
            type: 'PROXY_REQUEST',
            tabId: currentTabId, // Explicitly target the tab we are inspecting
            data: {
                url,
                method,
                headers,
                body
            }
        }, response => {
            console.log('[Explorer] Received response:', response);

            if (browser.runtime.lastError) {
                console.error('[Explorer] Runtime error:', browser.runtime.lastError);
                reject(new Error(browser.runtime.lastError.message));
            } else if (!response) {
                console.error('[Explorer] No response received');
                reject(new Error('No response from background script'));
            } else if (response.error) {
                console.error('[Explorer] Response contains error:', response.error);
                reject(new Error(response.error));
            } else if (response.success) {
                console.log('[Explorer] Success response:', response);
                resolve(response);
            } else {
                console.error('[Explorer] Unknown response format:', response);
                reject(new Error('Unknown proxy error - check background console'));
            }
        });
    });
}

async function replayRequest() {
    if (!currentEndpoint) return;

    logAnalysis('Replaying request (via Background Proxy)...', 'info');

    try {
        const start = Date.now();

        // Get the URL from the input field (may be edited)
        const url = document.getElementById('detail-url').value;

        const response = await sendProxyRequest(
            url,
            currentEndpoint.method,
            currentEndpoint.headers,
            currentEndpoint.body
        );

        const duration = Date.now() - start;
        logAnalysis(`Status: ${response.status} ${response.statusText} (${duration}ms)`, response.status >= 200 && response.status < 300 ? 'success' : 'failure');

        // Display full response body
        if (response.body && response.body.length > 0) {
            // Try to format JSON
            let formattedBody = response.body;
            try {
                const jsonObj = JSON.parse(response.body);
                formattedBody = JSON.stringify(jsonObj, null, 2);
            } catch (e) {
                // Not JSON, use as-is
            }

            // Create expandable response viewer
            const output = document.getElementById('analysis-output');
            const responseDiv = document.createElement('div');
            responseDiv.className = 'response-body';
            responseDiv.style.cssText = 'margin-top: 10px; border: 1px solid #4a5568; border-radius: 4px; background: #2d3748;';

            const header = document.createElement('div');
            header.style.cssText = 'padding: 8px; background: #4a5568; cursor: pointer; font-weight: bold; color: #e2e8f0; user-select: none;';
            header.textContent = `📄 Response Body (${response.body.length} bytes) - Click to toggle`;

            const bodyContent = document.createElement('pre');
            bodyContent.style.cssText = 'margin: 0; padding: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; word-wrap: break-word; font-family: "Courier New", monospace; font-size: 12px; display: none; background: #1a202c; color: #e2e8f0; line-height: 1.5;';
            bodyContent.textContent = formattedBody;

            // Toggle visibility on click
            let isExpanded = false;
            header.onclick = () => {
                isExpanded = !isExpanded;
                bodyContent.style.display = isExpanded ? 'block' : 'none';
                header.textContent = `📄 Response Body (${response.body.length} bytes) - Click to ${isExpanded ? 'collapse' : 'expand'}`;
            };

            responseDiv.appendChild(header);
            responseDiv.appendChild(bodyContent);
            output.appendChild(responseDiv);
        }

    } catch (e) {
        logAnalysis(`Error: ${e.message}`, 'failure');
    }
}

async function testBrokenAuth() {
    if (!currentEndpoint) return;

    logAnalysis('Starting Broken Authentication Test (via Proxy)...', 'info');

    // 1. Identify Auth Headers
    const headers = currentEndpoint.headers || {};
    const authHeaders = ['authorization', 'x-api-key', 'token', 'access-token', 'cookie', 'session'];

    const cleanHeaders = {};
    let foundAuth = false;

    for (const [key, value] of Object.entries(headers)) {
        if (!authHeaders.includes(key.toLowerCase())) {
            cleanHeaders[key] = value;
        } else {
            foundAuth = true;
            logAnalysis(`Removing auth header: ${key}`, 'info');
        }
    }

    if (!foundAuth) {
        logAnalysis('No obvious authentication headers found. Test may be inconclusive.', 'info');
    }

    try {
        logAnalysis('Sending unauthenticated request...', 'info');

        const response = await sendProxyRequest(
            currentEndpoint.url,
            currentEndpoint.method,
            cleanHeaders,
            currentEndpoint.body
        );

        logAnalysis(`Response Status: ${response.status}`, 'info');

        if (response.status >= 200 && response.status < 300) {
            const alert = document.createElement('div');
            alert.className = 'vulnerability-alert';
            alert.innerHTML = `⚠️ POTENTIAL VULNERABILITY: Endpoint accessible without authentication! (${response.status})`;
            document.getElementById('analysis-output').appendChild(alert);
        } else if (response.status === 401 || response.status === 403) {
            logAnalysis('✅ Endpoint appears protected (401/403 returned).', 'success');
        } else {
            logAnalysis(`Received ${response.status}. Verify manually.`, 'info');
        }

    } catch (e) {
        logAnalysis(`Request failed: ${e.message}`, 'failure');
    }
}


/**
 * Clear all discovered endpoints
 */
function clearAllEndpoints() {
    if (!confirm('Are you sure you want to clear all discovered endpoints?')) {
        return;
    }

    // Clear local list
    apiEndpoints = [];
    renderEndpoints(apiEndpoints);

    // Clear from background script
    browser.runtime.sendMessage({
        type: 'CLEAR_API_ENDPOINTS',
        tabId: currentTabId
    });

    // Hide detail view and show default view
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('default-view').classList.remove('hidden');
    currentEndpoint = null;

    // Clear analysis output
    const output = document.getElementById('analysis-output');
    if (output) {
        output.innerHTML = '<div class="placeholder">Select an action above to test this endpoint.</div>';
    }
}

/**
 * Copy current request as cURL command
 */
function copyAsCurl() {
    if (!currentEndpoint) return;

    // Get the URL from the input field (may be edited)
    const url = document.getElementById('detail-url').value;
    const method = currentEndpoint.method;
    const headers = currentEndpoint.headers || {};
    const body = currentEndpoint.body;

    // Build cURL command
    let curl = `curl -X ${method} '${url}'`;

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
        // Escape single quotes in header values
        const escapedValue = value.replace(/'/g, "'\\''");
        curl += ` \\\n  -H '${key}: ${escapedValue}'`;
    }

    // Add body if present
    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        // Escape single quotes in body
        const escapedBody = bodyStr.replace(/'/g, "'\\''");
        curl += ` \\\n  -d '${escapedBody}'`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(curl).then(() => {
        // Visual feedback
        const btn = document.getElementById('btn-copy-curl');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="icon">✓</span> Copied!';
        btn.classList.add('success-flash');

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('success-flash');
        }, 2000);
    }).catch(err => {
        alert('Failed to copy to clipboard: ' + err.message);
    });
}

// polyfill for browser namespace if chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    window.browser = window.chrome;
}
