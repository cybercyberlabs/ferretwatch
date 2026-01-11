/**
 * FerretWatch API Explorer Logic
 */

let apiEndpoints = [];
let unusedEndpoints = [];
let currentTabId = null;
let currentEndpoint = null;
let activeTab = 'called'; // 'called' or 'unused'

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
    document.getElementById('btn-scan-unused').addEventListener('click', scanUnusedEndpoints);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
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
                bodyEl.value = JSON.stringify(json, null, 2);
            } catch {
                bodyEl.value = currentEndpoint.body;
            }
        } else {
            bodyEl.value = JSON.stringify(currentEndpoint.body, null, 2);
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

    // Get the URL from the input field (may be edited)
    const url = document.getElementById('detail-url').value;

    // Get the body from the textarea (may be edited)
    const bodyEl = document.getElementById('detail-body');
    const body = bodyEl.value || currentEndpoint.body;

    // Generate and display curl command
    const curlCommand = generateCurlCommand(url, currentEndpoint.method, currentEndpoint.headers, body);
    displayCurlCommand(curlCommand);

    try {
        const start = Date.now();

        const response = await sendProxyRequest(
            url,
            currentEndpoint.method,
            currentEndpoint.headers,
            body
        );

        const duration = Date.now() - start;
        logAnalysis(`Status: ${response.status} ${response.statusText} (${duration}ms)`, response.status >= 200 && response.status < 300 ? 'success' : 'failure');

        // Display Content-Type if available
        const contentType = response.headers?.['content-type'] || 'Not specified';
        logAnalysis(`Content-Type: ${contentType}`, 'info');

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
            header.style.cssText = 'padding: 8px; background: #4a5568; cursor: pointer; font-weight: bold; color: #e2e8f0; user-select: none; display: flex; justify-content: space-between; align-items: center;';

            const bodyLabel = document.createElement('span');
            bodyLabel.textContent = `📄 Response Body (${response.body.length} bytes) - Click to toggle`;

            const contentTypeLabel = document.createElement('span');
            contentTypeLabel.style.cssText = 'font-size: 11px; font-weight: normal; opacity: 0.8;';
            contentTypeLabel.textContent = contentType;

            header.appendChild(bodyLabel);
            header.appendChild(contentTypeLabel);

            const bodyContent = document.createElement('pre');
            bodyContent.style.cssText = 'margin: 0; padding: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; word-wrap: break-word; font-family: "Courier New", monospace; font-size: 12px; display: none; background: #1a202c; color: #e2e8f0; line-height: 1.5;';
            bodyContent.textContent = formattedBody;

            // Toggle visibility on click
            let isExpanded = false;
            header.onclick = () => {
                isExpanded = !isExpanded;
                bodyContent.style.display = isExpanded ? 'block' : 'none';
                bodyLabel.textContent = `📄 Response Body (${response.body.length} bytes) - Click to ${isExpanded ? 'collapse' : 'expand'}`;
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

    // Generate and display curl command for the unauthenticated request
    const curlCommand = generateCurlCommand(currentEndpoint.url, currentEndpoint.method, cleanHeaders, currentEndpoint.body);
    displayCurlCommand(curlCommand);

    try {
        logAnalysis('Sending unauthenticated request...', 'info');

        const response = await sendProxyRequest(
            currentEndpoint.url,
            currentEndpoint.method,
            cleanHeaders,
            currentEndpoint.body
        );

        logAnalysis(`Response Status: ${response.status}`, 'info');

        // Check Content-Type header if available
        const contentType = response.headers?.['content-type']?.toLowerCase() || '';
        if (contentType) {
            logAnalysis(`Content-Type: ${contentType}`, 'info');
        }

        // Analyze response for actual vulnerability vs redirect
        if (response.status >= 200 && response.status < 300) {
            let isVulnerable = false;
            let redirectDetected = false;

            // First check: Content-Type header (most reliable)
            const isHTMLContentType = contentType.includes('text/html');
            const isJSONContentType = contentType.includes('application/json') ||
                                       contentType.includes('application/javascript');

            // Check if response is a redirect/login page (HTML content)
            if (response.body) {
                const bodyLower = response.body.toLowerCase();

                // Check for HTML login indicators
                const loginIndicators = [
                    '<form',
                    'login',
                    'signin',
                    'sign-in',
                    'authenticate',
                    'unauthorized',
                    'please log in',
                    'session expired',
                    'access denied'
                ];

                const isHTMLBody = bodyLower.includes('<!doctype html') ||
                                   bodyLower.includes('<html') ||
                                   bodyLower.includes('<body');

                const hasLoginIndicators = loginIndicators.some(indicator =>
                    bodyLower.includes(indicator)
                );

                // Determine if this is a login redirect or actual data
                const isHTML = isHTMLContentType || isHTMLBody;

                if (isHTML && hasLoginIndicators) {
                    // HTML with login indicators = proper auth enforcement
                    redirectDetected = true;
                    logAnalysis('✅ Server returned HTML login page (proper auth enforcement)', 'success');
                    logAnalysis('The 200 status is misleading - this is NOT a vulnerability', 'info');
                } else if (isHTML && !hasLoginIndicators) {
                    // HTML without login indicators - could be public page or error
                    logAnalysis('⚠️ Server returned HTML page. May be a public page or custom error.', 'info');
                    logAnalysis('Review the response manually to confirm.', 'info');
                } else if (isJSONContentType || (!isHTML && bodyLower.startsWith('{'))) {
                    // JSON/API response without auth = likely vulnerable
                    isVulnerable = true;
                } else {
                    // Unknown content type
                    logAnalysis('Response content type is unclear. Review manually.', 'info');
                }
            } else {
                // Empty body with 200 - ambiguous
                logAnalysis('Response has no body. Unable to determine if vulnerable.', 'info');
            }

            if (isVulnerable) {
                const alert = document.createElement('div');
                alert.className = 'vulnerability-alert';
                alert.innerHTML = `⚠️ POTENTIAL VULNERABILITY: Endpoint returned API data (${response.status}) without authentication!`;
                document.getElementById('analysis-output').appendChild(alert);

                // Show body preview
                if (response.body && response.body.length < 500) {
                    logAnalysis(`Response preview: ${response.body}`, 'failure');
                } else if (response.body) {
                    logAnalysis(`Response preview: ${response.body.substring(0, 500)}...`, 'failure');
                }
            }
        } else if (response.status === 401 || response.status === 403) {
            logAnalysis('✅ Endpoint properly protected (401/403 returned).', 'success');
        } else if (response.status >= 300 && response.status < 400) {
            logAnalysis('✅ Endpoint redirects without auth (likely protected).', 'success');
            logAnalysis(`Redirect response received`, 'info');
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
 * Generate cURL command for a request
 * @param {string} url - Request URL
 * @param {string} method - HTTP method
 * @param {object} headers - Request headers
 * @param {string|object} body - Request body
 * @returns {string} cURL command
 */
function generateCurlCommand(url, method, headers, body) {
    // Auto-correct method if body is present but method is GET
    // GET requests cannot have bodies per HTTP spec
    if (body && method.toUpperCase() === 'GET') {
        console.warn(`[cURL] GET request with body detected - auto-correcting to POST`);
        method = 'POST';
    }

    let curl = `curl -X ${method} '${url}'`;

    // Add headers
    if (headers) {
        for (const [key, value] of Object.entries(headers)) {
            // Escape single quotes in header values
            const escapedValue = String(value).replace(/'/g, "'\\''");
            curl += ` \\\n  -H '${key}: ${escapedValue}'`;
        }
    }

    // Add body if present (excluding GET/HEAD which shouldn't have bodies)
    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        // Escape single quotes in body
        const escapedBody = bodyStr.replace(/'/g, "'\\''");
        curl += ` \\\n  -d '${escapedBody}'`;
    }

    return curl;
}

/**
 * Display cURL command in the analysis output
 * @param {string} curlCommand - The cURL command to display
 */
function displayCurlCommand(curlCommand) {
    const output = document.getElementById('analysis-output');
    const curlDiv = document.createElement('div');
    curlDiv.className = 'curl-display';
    curlDiv.style.cssText = 'margin-bottom: 10px; border: 1px solid #4a5568; border-radius: 4px; background: #2d3748;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #4a5568; cursor: pointer; font-weight: bold; color: #e2e8f0; user-select: none; display: flex; justify-content: space-between; align-items: center;';

    const label = document.createElement('span');
    label.textContent = '📤 Request (cURL) - Click to toggle';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = 'padding: 4px 8px; background: rgba(99, 102, 241, 0.3); border: 1px solid rgba(99, 102, 241, 0.5); border-radius: 4px; color: #e2e8f0; font-size: 11px; cursor: pointer;';
    copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(curlCommand).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    };

    header.appendChild(label);
    header.appendChild(copyBtn);

    const curlContent = document.createElement('pre');
    curlContent.style.cssText = 'margin: 0; padding: 12px; max-height: 300px; overflow: auto; white-space: pre-wrap; word-wrap: break-word; font-family: "Courier New", monospace; font-size: 11px; display: none; background: #1a202c; color: #a5f3fc; line-height: 1.5;';
    curlContent.textContent = curlCommand;

    // Toggle visibility on header click
    let isExpanded = false;
    header.onclick = (e) => {
        if (e.target === copyBtn) return; // Don't toggle if clicking copy button
        isExpanded = !isExpanded;
        curlContent.style.display = isExpanded ? 'block' : 'none';
        label.textContent = `📤 Request (cURL) - Click to ${isExpanded ? 'collapse' : 'expand'}`;
    };

    curlDiv.appendChild(header);
    curlDiv.appendChild(curlContent);
    output.appendChild(curlDiv);
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

    const curl = generateCurlCommand(url, method, headers, body);

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

/**
 * Switch between Called, Unused, and Vulns tabs
 */
function switchTab(tabName) {
    activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    if (tabName === 'called') {
        document.getElementById('called-tab').classList.add('active');
    } else if (tabName === 'unused') {
        document.getElementById('unused-tab').classList.add('active');
    } else if (tabName === 'vulns') {
        document.getElementById('vulns-tab').classList.add('active');
    }
}

/**
 * Scan page for unused endpoints
 */
async function scanUnusedEndpoints() {
    if (!currentTabId) {
        alert('Error: No target tab specified');
        return;
    }

    const btn = document.getElementById('btn-scan-unused');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="icon">⏳</span> Scanning...';
    btn.disabled = true;

    try {
        console.log('[Explorer] Requesting unused endpoint scan for tab', currentTabId);

        const response = await browser.runtime.sendMessage({
            type: 'SCAN_UNUSED_ENDPOINTS',
            tabId: currentTabId
        });

        console.log('[Explorer] Scan response:', response);

        if (!response || !response.success) {
            throw new Error(response?.error || 'Scan failed');
        }

        // Store unused endpoints
        unusedEndpoints = response.unused || [];

        // Update UI
        renderUnusedEndpoints(unusedEndpoints);
        displayScanStats(response.stats);

        // Update badge count
        document.getElementById('unused-count').textContent = unusedEndpoints.length;

        // Hide scan prompt, show results
        document.querySelector('.scan-prompt').classList.add('hidden');
        document.getElementById('unused-list').classList.remove('hidden');
        document.getElementById('scan-stats').classList.remove('hidden');

    } catch (error) {
        console.error('[Explorer] Scan failed:', error);
        alert('Scan failed: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * Render unused endpoints in the list
 */
function renderUnusedEndpoints(endpoints) {
    const list = document.getElementById('unused-list');
    list.innerHTML = '';

    if (endpoints.length === 0) {
        list.innerHTML = '<div class="empty-state">✅ All discovered endpoints are being used!</div>';
        return;
    }

    // Sort by confidence (highest first)
    const sorted = [...endpoints].sort((a, b) => b.confidence - a.confidence);

    sorted.forEach((ep, index) => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.dataset.index = index;

        // URL display
        const urlContainer = document.createElement('div');
        urlContainer.className = 'url-container';

        const url = document.createElement('span');
        url.className = 'url-truncate';
        url.textContent = ep.url;
        url.title = ep.url;

        // Confidence badge
        const confidenceBadge = document.createElement('span');
        confidenceBadge.className = 'confidence-badge';
        let confidenceLevel = 'low';
        if (ep.confidence >= 0.7) {
            confidenceLevel = 'high';
        } else if (ep.confidence >= 0.4) {
            confidenceLevel = 'medium';
        }
        confidenceBadge.classList.add(`confidence-${confidenceLevel}`);
        confidenceBadge.textContent = `${Math.round(ep.confidence * 100)}% confidence`;

        // Method badge (if detected)
        if (ep.method && ep.method !== 'GET') {
            const methodBadge = document.createElement('span');
            methodBadge.className = `method-tag method-${ep.method}`;
            methodBadge.textContent = ep.method;
            methodBadge.style.fontSize = '9px';
            methodBadge.style.marginLeft = '8px';
            urlContainer.insertBefore(methodBadge, urlContainer.firstChild);
        }

        // Additional info
        const info = document.createElement('div');
        info.className = 'endpoint-info';
        info.innerHTML = `<span>Pattern: ${ep.pattern}</span>`;
        if (ep.scriptOrigin) {
            const scriptOriginHost = new URL(ep.scriptOrigin).hostname;
            info.innerHTML += `<span>Origin: ${scriptOriginHost}</span>`;
        }
        if (ep.method) {
            info.innerHTML += `<span>Method: ${ep.method}</span>`;
        }
        if (ep.payload) {
            const payloadStr = typeof ep.payload === 'object' ? JSON.stringify(ep.payload) : ep.payload;
            info.innerHTML += `<span>Payload: ${payloadStr.substring(0, 50)}${payloadStr.length > 50 ? '...' : ''}</span>`;
        }
        if (ep.context) {
            info.innerHTML += `<span>Context: ${ep.context.substring(0, 60)}...</span>`;
        }

        urlContainer.appendChild(url);
        urlContainer.appendChild(confidenceBadge);
        urlContainer.appendChild(info);

        item.appendChild(urlContainer);

        // Click handler to select and test
        item.addEventListener('click', function() {
            selectUnusedEndpoint(parseInt(this.dataset.index));
        });

        list.appendChild(item);
    });
}

/**
 * Display scan statistics
 */
function displayScanStats(stats) {
    const statsDiv = document.getElementById('scan-stats');
    statsDiv.innerHTML = `
        <div class="scan-stats-left">
            <div class="scan-stats-item">
                <span class="scan-stats-label">Discovered</span>
                <span class="scan-stats-value">${stats.totalDiscovered || 0}</span>
            </div>
            <div class="scan-stats-item">
                <span class="scan-stats-label">Called</span>
                <span class="scan-stats-value">${stats.totalUsed || 0}</span>
            </div>
            <div class="scan-stats-item">
                <span class="scan-stats-label">Unused</span>
                <span class="scan-stats-value">${stats.totalUnused || 0}</span>
            </div>
        </div>
    `;
}

/**
 * Select an unused endpoint for testing
 */
function selectUnusedEndpoint(index) {
    const endpoint = unusedEndpoints[index];

    // Highlight sidebar item
    document.querySelectorAll('#unused-list .endpoint-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
    });

    // Create endpoint object with detected method and payload
    let detectedMethod = endpoint.method || 'GET';
    const detectedBody = endpoint.payload ? JSON.stringify(endpoint.payload, null, 2) : null;

    // IMPORTANT: If there's a body but method is GET, auto-correct to POST
    // GET requests cannot have a body, so this is likely a misdetection
    if (detectedBody && detectedMethod.toUpperCase() === 'GET') {
        console.log(`[Explorer] Auto-correcting method from GET to POST for endpoint with body: ${endpoint.url}`);
        detectedMethod = 'POST';
    }

    // Use resolvedUrl if available (handles cross-origin scripts), otherwise use original url
    const targetUrl = endpoint.resolvedUrl || endpoint.url;

    currentEndpoint = {
        method: detectedMethod,
        url: targetUrl,
        headers: detectedBody ? { 'Content-Type': 'application/json' } : {},
        body: detectedBody,
        isUnused: true,
        scriptOrigin: endpoint.scriptOrigin
    };

    // Show detail view
    document.getElementById('default-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');

    // Populate details
    const methodBadge = document.getElementById('detail-method');
    methodBadge.textContent = detectedMethod;
    methodBadge.className = `method-badge method-${detectedMethod}`;

    document.getElementById('detail-url').value = targetUrl;

    // Headers
    const headersText = detectedBody ? JSON.stringify({ 'Content-Type': 'application/json' }, null, 2) : '{}';
    document.getElementById('detail-headers').textContent = headersText;

    // Body section
    if (detectedBody) {
        document.getElementById('body-heading').classList.remove('hidden');
        document.getElementById('detail-body').classList.remove('hidden');
        document.getElementById('detail-body').value = detectedBody;
    } else {
        document.getElementById('body-heading').classList.add('hidden');
        document.getElementById('detail-body').classList.add('hidden');
    }

    // Show info in analysis output
    const output = document.getElementById('analysis-output');
    let payloadInfo = '';
    if (endpoint.payload) {
        if (endpoint.payload.type) {
            payloadInfo = `<div class="result-info">Payload Type: ${endpoint.payload.type} - ${endpoint.payload.note || ''}</div>`;
        } else {
            const payloadPreview = JSON.stringify(endpoint.payload).substring(0, 100);
            payloadInfo = `<div class="result-info">Detected Payload: ${payloadPreview}${JSON.stringify(endpoint.payload).length > 100 ? '...' : ''}</div>`;
        }
    }

    let scriptOriginInfo = '';
    if (endpoint.scriptOrigin) {
        try {
            const scriptOriginHost = new URL(endpoint.scriptOrigin).hostname;
            scriptOriginInfo = `<div class="result-info">📜 Script Origin: ${scriptOriginHost}</div>`;
        } catch (e) {
            // Invalid URL
        }
    }

    let resolvedUrlInfo = '';
    if (endpoint.resolvedUrl && endpoint.resolvedUrl !== endpoint.url) {
        resolvedUrlInfo = `<div class="result-info">🔗 Original: ${endpoint.url}</div><div class="result-info">🔗 Resolved: ${endpoint.resolvedUrl}</div>`;
    }

    output.innerHTML = `
        <div class="result-info">🔍 Unused Endpoint Detected</div>
        <div class="result-info">Confidence: ${Math.round(endpoint.confidence * 100)}%</div>
        <div class="result-info">Method: ${detectedMethod}</div>
        <div class="result-info">Pattern: ${endpoint.pattern}</div>
        ${scriptOriginInfo}
        ${resolvedUrlInfo}
        ${payloadInfo}
        ${endpoint.context ? `<div class="result-info">Context: ${endpoint.context}</div>` : ''}
        <div style="margin-top: 20px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-radius: 4px; color: var(--text-secondary);">
            💡 This endpoint was found in ${endpoint.scriptOrigin ? 'a script from <strong>' + new URL(endpoint.scriptOrigin).hostname + '</strong>' : 'the page source'} but hasn't been called yet. The method and payload were ${endpoint.method && endpoint.payload ? '<strong>detected from code</strong>' : 'inferred'}. Use the "Replay Request" button to test it.
        </div>
    `;
}

/**
 * Run automated security scan on all endpoints
 */
let vulnerabilities = [];
let isScanning = false;

async function runAutoScanAll() {
    if (!currentTabId) {
        alert('Error: No target tab specified');
        return;
    }

    if (apiEndpoints.length === 0) {
        alert('No endpoints to scan. Discover some endpoints first.');
        return;
    }

    if (isScanning) {
        alert('Scan already in progress');
        return;
    }

    isScanning = true;
    vulnerabilities = [];

    const btn = document.getElementById('btn-run-auto-scan');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="icon">⏳</span> Scanning...';
    btn.disabled = true;

    // Show progress
    const prompt = document.getElementById('vuln-prompt');
    prompt.innerHTML = `
        <div class="scan-progress">
            <div class="icon">🤖</div>
            <p>Running automated security tests...</p>
            <div class="progress-bar">
                <div class="progress-fill" id="scan-progress-fill" style="width: 0%"></div>
            </div>
            <p id="scan-status">Initializing...</p>
        </div>
    `;

    try {
        const total = apiEndpoints.length;
        let completed = 0;

        for (const endpoint of apiEndpoints) {
            completed++;
            const progress = Math.round((completed / total) * 100);

            document.getElementById('scan-progress-fill').style.width = `${progress}%`;
            document.getElementById('scan-status').textContent = `Testing ${completed}/${total}: ${endpoint.url}`;

            // Test this endpoint
            const vulns = await testEndpointSecurity(endpoint);
            vulnerabilities.push(...vulns);
        }

        // Update UI
        renderVulnerabilities(vulnerabilities);
        displayVulnStats(vulnerabilities);

        // Update badge count
        document.getElementById('vulns-count').textContent = vulnerabilities.length;

        // Hide prompt, show results
        prompt.classList.add('hidden');
        document.getElementById('vuln-list').classList.remove('hidden');
        document.getElementById('vuln-stats').classList.remove('hidden');

        if (vulnerabilities.length > 0) {
            // Switch to vulns tab to show results
            switchTab('vulns');

            // Show notification
            alert(`⚠️ Auto Scan Complete!\n\nFound ${vulnerabilities.length} potential vulnerabilities.\nReview them in the Vulns tab.`);
        } else {
            alert(`✅ Auto Scan Complete!\n\nNo vulnerabilities found. All endpoints appear to be properly secured.`);
        }

    } catch (error) {
        console.error('[AutoScan] Scan failed:', error);
        alert('Auto scan failed: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        isScanning = false;
    }
}

/**
 * Run automated security scan on the current endpoint only
 */
async function runAutoScanCurrent() {
    if (!currentEndpoint) {
        alert('No endpoint selected');
        return;
    }

    if (isScanning) {
        alert('Scan already in progress');
        return;
    }

    isScanning = true;

    const btn = document.getElementById('btn-auto-scan');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="icon">⏳</span> Scanning...';
    btn.disabled = true;

    logAnalysis('Running automated security tests on this endpoint...', 'info');

    try {
        // Get the URL from the input field (may be edited)
        const url = document.getElementById('detail-url').value;

        // Create endpoint object with current values
        const endpointToTest = {
            ...currentEndpoint,
            url: url
        };

        // Test this endpoint
        const vulns = await testEndpointSecurity(endpointToTest);

        if (vulns.length > 0) {
            logAnalysis(`⚠️ Found ${vulns.length} potential ${vulns.length === 1 ? 'vulnerability' : 'vulnerabilities'}:`, 'failure');

            vulns.forEach((vuln, index) => {
                logAnalysis(`\n${index + 1}. ${vuln.title} [${vuln.severity}]`, 'failure');
                logAnalysis(`   Type: ${vuln.type.replace('_', ' ')}`, 'info');
                logAnalysis(`   ${vuln.description}`, 'info');
                if (vuln.evidence) {
                    logAnalysis(`   Evidence: ${JSON.stringify(vuln.evidence, null, 2)}`, 'info');
                }
            });

            // Add vulnerabilities to global list
            vulnerabilities.push(...vulns);
            document.getElementById('vulns-count').textContent = vulnerabilities.length;

            logAnalysis('\n💡 View all vulnerabilities in the "Vulns" tab', 'info');
        } else {
            logAnalysis('✅ No vulnerabilities found! This endpoint appears to be properly secured.', 'success');
        }

    } catch (error) {
        console.error('[AutoScan] Scan failed:', error);
        logAnalysis(`Scan failed: ${error.message}`, 'failure');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        isScanning = false;
    }
}

/**
 * Test an individual endpoint for security vulnerabilities
 * @param {Object} endpoint - Endpoint to test
 * @returns {Promise<Array>} Array of vulnerabilities found
 */
async function testEndpointSecurity(endpoint) {
    const vulns = [];

    try {
        // Test 1: Broken Authentication
        const authVuln = await testBrokenAuthAuto(endpoint);
        if (authVuln) vulns.push(authVuln);

        // Test 2: IDOR
        const idorVulns = await testIDORAuto(endpoint);
        vulns.push(...idorVulns);

        // Test 3: Method Bypass
        const methodVulns = await testMethodBypassAuto(endpoint);
        vulns.push(...methodVulns);

    } catch (error) {
        console.debug('[AutoScan] Error testing endpoint:', endpoint.url, error);
    }

    return vulns;
}

/**
 * Test endpoint for broken authentication (automated)
 */
async function testBrokenAuthAuto(endpoint) {
    try {
        const authHeaders = ['authorization', 'x-api-key', 'token', 'access-token', 'cookie', 'session'];
        const cleanHeaders = {};
        let hasAuth = false;

        for (const [key, value] of Object.entries(endpoint.headers || {})) {
            if (!authHeaders.includes(key.toLowerCase())) {
                cleanHeaders[key] = value;
            } else {
                hasAuth = true;
            }
        }

        if (!hasAuth) return null;

        const response = await sendProxyRequest(endpoint.url, endpoint.method, cleanHeaders, endpoint.body);

        if (response.status >= 200 && response.status < 300) {
            const contentType = response.headers?.['content-type']?.toLowerCase() || '';
            const isHTML = contentType.includes('text/html');
            const bodyLower = (response.body || '').toLowerCase();
            const loginIndicators = ['<form', 'login', 'signin', 'authenticate'];
            const hasLoginIndicators = loginIndicators.some(ind => bodyLower.includes(ind));

            if (isHTML && hasLoginIndicators) return null;

            const isJSON = contentType.includes('application/json') || (!isHTML && bodyLower.startsWith('{'));

            if (isJSON) {
                return {
                    type: 'BROKEN_AUTHENTICATION',
                    severity: 'HIGH',
                    endpoint: endpoint.url,
                    method: endpoint.method,
                    title: 'Broken Authentication',
                    description: `Endpoint accessible without authentication`,
                    evidence: {
                        status: response.status,
                        bodyPreview: response.body ? response.body.substring(0, 200) : ''
                    }
                };
            }
        }
    } catch (error) {
        console.debug('[AutoScan] Auth test failed:', error);
    }

    return null;
}

/**
 * Test endpoint for IDOR (automated)
 */
async function testIDORAuto(endpoint) {
    const vulns = [];

    try {
        const ids = extractIDsFromURL(endpoint.url);

        for (const idInfo of ids) {
            const testUrl = generateIDTestURL(endpoint.url, idInfo);
            if (!testUrl) continue;

            try {
                const response = await sendProxyRequest(testUrl, endpoint.method, endpoint.headers, endpoint.body);

                if (response.status >= 200 && response.status < 300) {
                    const contentType = response.headers?.['content-type']?.toLowerCase() || '';
                    const isJSON = contentType.includes('application/json');

                    if (isJSON && response.body) {
                        vulns.push({
                            type: 'IDOR',
                            severity: 'HIGH',
                            endpoint: endpoint.url,
                            method: endpoint.method,
                            title: 'Insecure Direct Object Reference',
                            description: `ID manipulation from ${idInfo.value} to ${idInfo.testValue} succeeded`,
                            evidence: {
                                originalUrl: endpoint.url,
                                testUrl: testUrl
                            }
                        });
                        break; // Only report one IDOR per endpoint
                    }
                }
            } catch (error) {
                continue;
            }
        }
    } catch (error) {
        console.debug('[AutoScan] IDOR test failed:', error);
    }

    return vulns;
}

/**
 * Test endpoint for method bypass (automated)
 */
async function testMethodBypassAuto(endpoint) {
    const vulns = [];

    try {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        const originalMethod = endpoint.method.toUpperCase();
        const authHeaders = ['authorization', 'x-api-key', 'token', 'access-token', 'cookie', 'session'];

        for (const method of methods) {
            if (method === originalMethod) continue;

            try {
                const cleanHeaders = {};
                for (const [key, value] of Object.entries(endpoint.headers || {})) {
                    if (!authHeaders.includes(key.toLowerCase())) {
                        cleanHeaders[key] = value;
                    }
                }

                const response = await sendProxyRequest(endpoint.url, method, cleanHeaders, null);

                if (response.status >= 200 && response.status < 300) {
                    const contentType = response.headers?.['content-type']?.toLowerCase() || '';
                    const isJSON = contentType.includes('application/json');

                    if (isJSON && response.body) {
                        vulns.push({
                            type: 'METHOD_BYPASS',
                            severity: 'MEDIUM',
                            endpoint: endpoint.url,
                            method: method,
                            title: 'Method-Based Access Control Bypass',
                            description: `Endpoint accessible via ${method} without authentication`,
                            evidence: {
                                originalMethod: originalMethod,
                                bypassMethod: method
                            }
                        });
                        break; // Only report one method bypass per endpoint
                    }
                }
            } catch (error) {
                continue;
            }
        }
    } catch (error) {
        console.debug('[AutoScan] Method test failed:', error);
    }

    return vulns;
}

/**
 * Helper: Extract IDs from URL
 */
function extractIDsFromURL(url) {
    const ids = [];
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

        pathParts.forEach((part, index) => {
            // Numeric ID
            if (/^\d+$/.test(part)) {
                ids.push({
                    type: 'numeric',
                    value: part,
                    position: index,
                    testValue: (parseInt(part) + 1).toString()
                });
            }
            // Template variables: ${id}, :id, {id}
            else if (/^[\$:]\{?[a-zA-Z_][a-zA-Z0-9_]*\}?$/.test(part) || /^\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(part)) {
                // These are template variables - try replacing with numeric values
                ids.push({
                    type: 'template-var',
                    value: part,
                    position: index,
                    testValue: '1',  // Try ID 1
                    testValue2: '2'  // Also try ID 2
                });
            }
        });

        // Also check query parameters for IDs
        const params = urlObj.searchParams;
        const queryIds = [];
        for (const [key, value] of params.entries()) {
            // Numeric query param that looks like an ID
            if (/^\d+$/.test(value) && (key.toLowerCase().includes('id') || key.toLowerCase().includes('user'))) {
                queryIds.push({
                    type: 'query-param',
                    key: key,
                    value: value,
                    testValue: (parseInt(value) + 1).toString()
                });
            }
        }

        ids.push(...queryIds);
    } catch (error) {
        console.debug('[AutoScan] ID extraction failed:', error);
    }
    return ids;
}

/**
 * Helper: Generate test URL with manipulated ID
 */
function generateIDTestURL(originalUrl, idInfo) {
    try {
        const urlObj = new URL(originalUrl);
        const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
        pathParts[idInfo.position] = idInfo.testValue;
        urlObj.pathname = '/' + pathParts.join('/');
        return urlObj.toString();
    } catch (error) {
        return null;
    }
}

/**
 * Render vulnerabilities in the list
 */
function renderVulnerabilities(vulns) {
    const list = document.getElementById('vuln-list');
    list.innerHTML = '';

    if (vulns.length === 0) {
        list.innerHTML = '<div class="empty-state">✅ No vulnerabilities found!</div>';
        return;
    }

    vulns.forEach((vuln, index) => {
        const item = document.createElement('div');
        item.className = 'vuln-item';
        item.dataset.index = index;

        const header = document.createElement('div');
        header.className = 'vuln-header';

        const severityBadge = document.createElement('span');
        severityBadge.className = `severity-badge severity-${vuln.severity}`;
        severityBadge.textContent = vuln.severity;

        const typeSpan = document.createElement('span');
        typeSpan.className = 'vuln-type';
        typeSpan.textContent = vuln.type.replace('_', ' ');

        header.appendChild(severityBadge);
        header.appendChild(typeSpan);

        const title = document.createElement('div');
        title.className = 'vuln-title';
        title.textContent = vuln.title;

        const endpointDiv = document.createElement('div');
        endpointDiv.className = 'vuln-endpoint';
        endpointDiv.textContent = `${vuln.method} ${vuln.endpoint}`;
        endpointDiv.title = `${vuln.method} ${vuln.endpoint}`;

        item.appendChild(header);
        item.appendChild(title);
        item.appendChild(endpointDiv);

        item.addEventListener('click', function() {
            selectVulnerability(parseInt(this.dataset.index));
        });

        list.appendChild(item);
    });
}

/**
 * Display vulnerability statistics
 */
function displayVulnStats(vulns) {
    const statsDiv = document.getElementById('vuln-stats');
    const high = vulns.filter(v => v.severity === 'HIGH').length;
    const medium = vulns.filter(v => v.severity === 'MEDIUM').length;
    const low = vulns.filter(v => v.severity === 'LOW').length;

    statsDiv.innerHTML = `
        <div class="scan-stats-left">
            <div class="scan-stats-item">
                <span class="scan-stats-label">Total</span>
                <span class="scan-stats-value">${vulns.length}</span>
            </div>
            <div class="scan-stats-item">
                <span class="scan-stats-label">High</span>
                <span class="scan-stats-value" style="color: var(--method-delete);">${high}</span>
            </div>
            <div class="scan-stats-item">
                <span class="scan-stats-label">Medium</span>
                <span class="scan-stats-value" style="color: var(--method-post);">${medium}</span>
            </div>
            <div class="scan-stats-item">
                <span class="scan-stats-label">Low</span>
                <span class="scan-stats-value">${low}</span>
            </div>
        </div>
    `;
}

/**
 * Select a vulnerability for viewing details
 */
function selectVulnerability(index) {
    const vuln = vulnerabilities[index];

    // Highlight sidebar item
    document.querySelectorAll('#vuln-list .vuln-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
    });

    // Show vulnerability details in analysis output
    document.getElementById('default-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');

    const output = document.getElementById('analysis-output');
    output.innerHTML = `
        <div class="vuln-header" style="margin-bottom: 16px;">
            <span class="severity-badge severity-${vuln.severity}">${vuln.severity}</span>
            <span class="vuln-type">${vuln.type.replace('_', ' ')}</span>
        </div>
        <h3 style="margin-top: 0; color: var(--text-primary);">${vuln.title}</h3>
        <div class="result-info">Endpoint: ${vuln.method} ${vuln.endpoint}</div>
        <div class="result-info" style="margin-top: 12px; margin-bottom: 12px;">${vuln.description}</div>

        <h4 style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-top: 20px;">Evidence</h4>
        <pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; font-size: 11px; overflow-x: auto;">${JSON.stringify(vuln.evidence, null, 2)}</pre>

        ${vuln.remediation ? `<h4 style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; margin-top: 20px;">Remediation</h4><div class="result-info">${vuln.remediation}</div>` : ''}
    `;
}

// Add event listeners for auto scan
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-run-auto-scan')?.addEventListener('click', runAutoScanAll);
    document.getElementById('btn-auto-scan')?.addEventListener('click', runAutoScanCurrent);
});

// polyfill for browser namespace if chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    window.browser = window.chrome;
}
