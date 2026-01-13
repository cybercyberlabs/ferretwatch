/**
 * FerretWatch API Explorer v2
 * Network tab-style API inspection tool with request replay
 */

(function() {
    'use strict';

    // State
    let requests = new Map(); // Map<requestId, requestData>
    let selectedRequestId = null;
    let targetTabId = null;
    let filterText = '';
    let showLive = true;
    let showStatic = true;
    let currentRawBody = null; // Store raw body for formatting

    // API references
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // DOM elements
    const elements = {
        targetUrl: document.getElementById('target-url'),
        filterInput: document.getElementById('filter-input'),
        filterLive: document.getElementById('filter-live'),
        filterStatic: document.getElementById('filter-static'),
        btnScanPage: document.getElementById('btn-scan-page'),
        btnClear: document.getElementById('btn-clear'),
        requestCount: document.getElementById('request-count'),
        requestTbody: document.getElementById('request-tbody'),
        requestTableContainer: document.querySelector('.request-table-container'),
        resizer: document.getElementById('resizer'),
        detailPanel: document.getElementById('detail-panel'),
        detailContent: document.getElementById('detail-content'),
        detailMethod: document.getElementById('detail-method'),
        detailUrl: document.getElementById('detail-url'),
        btnSendRequest: document.getElementById('btn-send-request'),
        requestHeadersEditor: document.getElementById('request-headers-editor'),
        responseHeadersDisplay: document.getElementById('response-headers-display'),
        responseStatusBadge: document.getElementById('response-status-badge'),
        requestBodyEditor: document.getElementById('request-body-editor'),
        responseMeta: document.getElementById('response-meta'),
        responseBodyDisplay: document.getElementById('response-body-display'),
        previewContainer: document.getElementById('preview-container'),
        curlDisplay: document.getElementById('curl-display'),
        replayResultsDisplay: document.getElementById('replay-results-display'),
        btnCopyCurl: document.getElementById('btn-copy-curl'),
        btnFormatJson: document.getElementById('btn-format-json'),
        btnCopyResponse: document.getElementById('btn-copy-response'),
        btnAddHeader: document.getElementById('btn-add-header'),
        replayRemoveAuth: document.getElementById('replay-remove-auth'),
        replayModifyParams: document.getElementById('replay-modify-params'),
        bodyTypeRadios: document.querySelectorAll('input[name="body-type"]')
    };

    // Initialize
    async function init() {
        console.log('[Explorer v2] Initializing...');

        // Get target tab ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        targetTabId = parseInt(urlParams.get('tabId'));

        if (!targetTabId) {
            console.error('[Explorer v2] No tabId provided');
            elements.targetUrl.textContent = 'No target tab specified';
            return;
        }

        // Get target tab info
        try {
            const tab = await api.tabs.get(targetTabId);
            elements.targetUrl.textContent = tab.url;
            console.log('[Explorer v2] Monitoring tab:', tab.url);
        } catch (error) {
            console.error('[Explorer v2] Error getting tab:', error);
            elements.targetUrl.textContent = 'Error loading tab';
        }

        // Load existing endpoints
        await loadEndpoints();

        // Set up event listeners
        setupEventListeners();

        // Set up tab switching
        setupTabs();

        // Set up message listener for real-time updates
        api.runtime.onMessage.addListener((message) => {
            if (message.type === 'NEW_API_ENDPOINT' && message.tabId === targetTabId) {
                addOrUpdateRequest(message.endpoint);
            }
        });

        console.log('[Explorer v2] Initialization complete');
    }

    // Load existing endpoints from background
    async function loadEndpoints() {
        try {
            const response = await api.runtime.sendMessage({
                type: 'GET_API_ENDPOINTS',
                tabId: targetTabId
            });

            if (response && response.endpoints) {
                console.log(`[Explorer v2] Loaded ${response.endpoints.length} endpoints`);
                response.endpoints.forEach(endpoint => addOrUpdateRequest(endpoint));
                updateRequestCount();
            }
        } catch (error) {
            console.error('[Explorer v2] Error loading endpoints:', error);
        }
    }

    // Add or update a request in the table
    function addOrUpdateRequest(endpoint) {
        // Generate unique ID for this request
        const requestId = `${endpoint.method}-${endpoint.url}-${endpoint.timestamp || Date.now()}`;

        // Determine if this is a live or static endpoint
        const source = endpoint.response ? 'live' : (endpoint.source === 'live' ? 'live' : 'static');

        const requestData = {
            id: requestId,
            source: source,
            method: endpoint.method || 'GET',
            url: endpoint.url,
            origin: endpoint.origin || null, // Store origin for URL resolution during replay
            status: endpoint.response?.status || endpoint.status || null,
            statusText: endpoint.response?.statusText || endpoint.statusText || '',
            type: endpoint.type || 'fetch',
            duration: endpoint.response?.duration || endpoint.duration || null,
            size: endpoint.response?.responseSize || endpoint.responseSize || null,
            timestamp: endpoint.timestamp || Date.now(),
            requestHeaders: endpoint.headers || {},
            requestBody: endpoint.body || null,
            responseHeaders: endpoint.response?.responseHeaders || endpoint.responseHeaders || {},
            responseBody: endpoint.response?.responseBody || endpoint.responseBody || '',
            error: endpoint.response?.error || endpoint.error || null
        };

        requests.set(requestId, requestData);
        renderRequestRow(requestData);
        updateRequestCount();
    }

    // Render a request row in the table
    function renderRequestRow(request) {
        // Check if row already exists
        let row = document.querySelector(`tr[data-request-id="${request.id}"]`);

        const isNewRow = !row;

        if (!row) {
            // Remove empty row if it exists
            const emptyRow = elements.requestTbody.querySelector('.empty-row');
            if (emptyRow) emptyRow.remove();

            row = document.createElement('tr');
            row.dataset.requestId = request.id;
            elements.requestTbody.appendChild(row);
        }

        // Apply filters
        const matchesFilter = !filterText || request.url.toLowerCase().includes(filterText.toLowerCase());
        const matchesSourceFilter = (request.source === 'live' && showLive) || (request.source === 'static' && showStatic);
        row.style.display = (matchesFilter && matchesSourceFilter) ? '' : 'none';

        // Build row content
        const statusClass = request.status ? `status-${Math.floor(request.status / 100)}xx` : 'status-pending';
        row.innerHTML = `
            <td><span class="source-badge ${request.source}">${request.source.toUpperCase()}</span></td>
            <td><span class="method-badge method-${request.method}">${request.method}</span></td>
            <td class="url-cell" title="${request.url}">${request.url}</td>
            <td><span class="${statusClass}">${request.status || '---'}</span></td>
            <td>${request.type}</td>
            <td>${request.duration ? `${request.duration}ms` : '---'}</td>
            <td>${request.size ? formatBytes(request.size) : '---'}</td>
        `;

        // Attach click listener after setting innerHTML (only for new rows)
        if (isNewRow) {
            row.addEventListener('click', () => selectRequest(request.id));
        }

        if (selectedRequestId === request.id) {
            row.classList.add('selected');
        }
    }

    // Select a request and show details
    function selectRequest(requestId) {
        selectedRequestId = requestId;

        // Update row selection
        document.querySelectorAll('#request-tbody tr').forEach(row => {
            row.classList.toggle('selected', row.dataset.requestId === requestId);
        });

        // Show detail panel
        document.querySelector('.detail-placeholder').style.display = 'none';
        elements.detailContent.classList.remove('hidden');

        // Load request details
        const request = requests.get(requestId);
        if (request) {
            renderRequestDetails(request);
        }
    }

    // Render request details in the detail panel
    function renderRequestDetails(request) {
        // Update method and URL
        elements.detailMethod.value = request.method;
        elements.detailUrl.value = request.url;

        // Render request headers
        renderRequestHeaders(request.requestHeaders);

        // Render request body
        renderRequestBody(request.requestBody);

        // Render response headers
        renderResponseHeaders(request.responseHeaders, request.status, request.statusText);

        // Render response body
        renderResponseBody(request.responseBody, request.status, request.duration, request.size);

        // Render preview
        renderPreview(request.responseBody, request.responseHeaders);

        // Update cURL command
        updateCurlCommand(request);
    }

    // Render request headers (editable)
    function renderRequestHeaders(headers) {
        elements.requestHeadersEditor.innerHTML = '';

        Object.entries(headers).forEach(([key, value]) => {
            addHeaderRow(key, value);
        });
    }

    // Add a header row (editable)
    function addHeaderRow(key = '', value = '') {
        const row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML = `
            <input type="text" class="header-key" placeholder="Header name" value="${escapeHtml(key)}">
            <input type="text" class="header-value" placeholder="Header value" value="${escapeHtml(value)}">
            <button class="btn-remove-header">✕</button>
        `;

        row.querySelector('.btn-remove-header').addEventListener('click', () => row.remove());
        elements.requestHeadersEditor.appendChild(row);
    }

    // Render request body (editable)
    function renderRequestBody(body) {
        // Store raw body for formatting
        currentRawBody = body;

        if (!body || body === '[FormData]' || body === '[Blob]' || body.startsWith('[')) {
            elements.requestBodyEditor.value = body || '';
            document.getElementById('body-heading')?.classList.remove('hidden');
            elements.requestBodyEditor.classList.remove('hidden');

            // Set radio to "none"
            const noneRadio = document.querySelector('input[name="body-type"][value="none"]');
            if (noneRadio) noneRadio.checked = true;
        } else {
            // Show body with raw text initially
            elements.requestBodyEditor.value = body;
            document.getElementById('body-heading')?.classList.remove('hidden');
            elements.requestBodyEditor.classList.remove('hidden');

            // Auto-detect and set the appropriate radio button
            try {
                JSON.parse(body);
                const jsonRadio = document.querySelector('input[name="body-type"][value="json"]');
                if (jsonRadio) {
                    jsonRadio.checked = true;
                    // Apply JSON formatting immediately
                    applyBodyFormat('json');
                }
            } catch (e) {
                // Not JSON, set to text
                const textRadio = document.querySelector('input[name="body-type"][value="text"]');
                if (textRadio) textRadio.checked = true;
            }
        }
    }

    // Apply body formatting based on selected type
    function applyBodyFormat(formatType) {
        if (!currentRawBody) {
            return;
        }

        switch (formatType) {
            case 'none':
                elements.requestBodyEditor.value = '';
                elements.requestBodyEditor.style.display = 'none';
                break;

            case 'json':
                try {
                    const parsed = JSON.parse(currentRawBody);
                    elements.requestBodyEditor.value = JSON.stringify(parsed, null, 2);
                    elements.requestBodyEditor.style.display = 'block';
                } catch (e) {
                    elements.requestBodyEditor.value = currentRawBody;
                    elements.requestBodyEditor.style.display = 'block';
                    showToast('Invalid JSON - showing as text');
                }
                break;

            case 'text':
                elements.requestBodyEditor.value = currentRawBody;
                elements.requestBodyEditor.style.display = 'block';
                break;

            case 'form':
                try {
                    // Try to parse as URL-encoded form data
                    const params = new URLSearchParams(currentRawBody);
                    const formatted = [];
                    for (const [key, value] of params.entries()) {
                        formatted.push(`${key}: ${value}`);
                    }
                    elements.requestBodyEditor.value = formatted.join('\n');
                    elements.requestBodyEditor.style.display = 'block';
                } catch (e) {
                    // If parsing fails, try to parse as JSON object
                    try {
                        const parsed = JSON.parse(currentRawBody);
                        const formatted = Object.entries(parsed).map(([key, value]) => `${key}: ${value}`);
                        elements.requestBodyEditor.value = formatted.join('\n');
                        elements.requestBodyEditor.style.display = 'block';
                    } catch (e2) {
                        elements.requestBodyEditor.value = currentRawBody;
                        elements.requestBodyEditor.style.display = 'block';
                        showToast('Could not parse as form data - showing as text');
                    }
                }
                break;

            default:
                elements.requestBodyEditor.value = currentRawBody;
                elements.requestBodyEditor.style.display = 'block';
        }
    }

    // Render response headers (read-only)
    function renderResponseHeaders(headers, status, statusText) {
        if (!headers || Object.keys(headers).length === 0) {
            elements.responseHeadersDisplay.innerHTML = '<div class="placeholder">No response captured</div>';
            elements.responseStatusBadge.textContent = '';
            return;
        }

        const statusClass = status ? `status-${Math.floor(status / 100)}xx` : '';
        elements.responseStatusBadge.textContent = status ? `${status} ${statusText}` : '';
        elements.responseStatusBadge.className = `badge ${statusClass}`;

        let html = '';
        Object.entries(headers).forEach(([key, value]) => {
            html += `
                <div class="header-item">
                    <span class="header-name">${escapeHtml(key)}:</span>
                    <span class="header-value">${escapeHtml(value)}</span>
                </div>
            `;
        });
        elements.responseHeadersDisplay.innerHTML = html;
    }

    // Render response body
    function renderResponseBody(body, status, duration, size) {
        if (!body) {
            elements.responseMeta.innerHTML = '<div class="placeholder">No response captured</div>';
            elements.responseBodyDisplay.textContent = '';
            return;
        }

        // Show meta info
        const statusClass = status ? `status-${Math.floor(status / 100)}xx` : '';
        elements.responseMeta.innerHTML = `
            <span class="${statusClass}"><strong>Status:</strong> ${status || 'N/A'}</span>
            <span><strong>Time:</strong> ${duration ? `${duration}ms` : 'N/A'}</span>
            <span><strong>Size:</strong> ${size ? formatBytes(size) : 'N/A'}</span>
        `;

        // Show response body
        elements.responseBodyDisplay.textContent = body;
    }

    // Render preview (for HTML/JSON responses)
    function renderPreview(body, headers) {
        if (!body) {
            elements.previewContainer.innerHTML = '<div class="placeholder">No response available</div>';
            return;
        }

        const contentType = headers['content-type'] || headers['Content-Type'] || '';

        if (contentType.includes('application/json')) {
            try {
                const parsed = JSON.parse(body);
                elements.previewContainer.innerHTML = `<pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
            } catch (e) {
                elements.previewContainer.innerHTML = '<div class="placeholder">Invalid JSON</div>';
            }
        } else if (contentType.includes('text/html')) {
            // Create sandbox iframe for HTML preview
            elements.previewContainer.innerHTML = '<iframe sandbox style="width:100%;height:100%;border:none;background:white;"></iframe>';
            const iframe = elements.previewContainer.querySelector('iframe');
            iframe.contentDocument.write(body);
            iframe.contentDocument.close();
        } else {
            elements.previewContainer.innerHTML = '<div class="placeholder">Preview not available for this content type</div>';
        }
    }

    // Update cURL command
    function updateCurlCommand(request) {
        let curl = `curl '${request.url}' \\\n`;
        curl += `  -X ${request.method} \\\n`;

        // Add headers
        Object.entries(request.requestHeaders).forEach(([key, value]) => {
            // Skip if removing auth
            if (elements.replayRemoveAuth.checked &&
                (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie')) {
                return;
            }
            curl += `  -H '${key}: ${value}' \\\n`;
        });

        // Add body if present
        if (request.requestBody && typeof request.requestBody === 'string') {
            curl += `  -d '${request.requestBody.replace(/'/g, "'\\''")}' \\\n`;
        }

        curl = curl.slice(0, -3); // Remove trailing ' \\\n'
        elements.curlDisplay.textContent = curl;
    }

    // Scan page for static endpoints
    async function scanPageForEndpoints() {
        console.log('[Explorer v2] Starting page scan...');

        if (!targetTabId) {
            showToast('No target tab specified');
            return;
        }

        // Update button state
        const originalText = elements.btnScanPage.innerHTML;
        elements.btnScanPage.innerHTML = '<span class="icon">⏳</span> Scanning...';
        elements.btnScanPage.disabled = true;

        try {
            const response = await api.runtime.sendMessage({
                type: 'SCAN_UNUSED_ENDPOINTS',
                tabId: targetTabId
            });

            if (response.success) {
                const endpoints = response.discovered || [];
                console.log(`[Explorer v2] Scan complete: ${endpoints.length} endpoints found`);

                // Add each endpoint to the table
                endpoints.forEach(endpoint => {
                    addOrUpdateRequest({
                        ...endpoint,
                        source: 'static',
                        timestamp: Date.now()
                    });
                });

                showToast(`Found ${endpoints.length} endpoints from static analysis`);
            } else {
                console.error('[Explorer v2] Scan failed:', response.error);
                showToast(`Scan failed: ${response.error}`);
            }
        } catch (error) {
            console.error('[Explorer v2] Error scanning page:', error);
            showToast(`Error: ${error.message}`);
        } finally {
            // Restore button state
            elements.btnScanPage.innerHTML = originalText;
            elements.btnScanPage.disabled = false;
        }
    }

    // Send/replay request
    async function sendRequest() {
        if (!selectedRequestId) return;

        const request = requests.get(selectedRequestId);
        if (!request) return;

        // Get current values from UI
        const method = elements.detailMethod.value;
        const url = elements.detailUrl.value;
        const body = elements.requestBodyEditor.value;

        // Collect headers from editor
        const headers = {};
        document.querySelectorAll('#request-headers-editor .header-row').forEach(row => {
            const key = row.querySelector('.header-key').value.trim();
            const value = row.querySelector('.header-value').value.trim();
            if (key) headers[key] = value;
        });

        // Show loading
        elements.replayResultsDisplay.innerHTML = '<div class="placeholder">Sending request...</div>';

        try {
            // Send request via background script
            const response = await api.runtime.sendMessage({
                type: 'REPLAY_REQUEST',
                data: {
                    method,
                    url,
                    origin: request.origin, // Pass origin for URL resolution
                    headers,
                    body: body || null
                }
            });

            if (response.success) {
                // Display results
                elements.replayResultsDisplay.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <strong>Status:</strong> <span class="status-${Math.floor(response.status / 100)}xx">${response.status} ${response.statusText}</span><br>
                        <strong>Time:</strong> ${response.duration}ms<br>
                        <strong>Size:</strong> ${formatBytes(response.body.length)}
                    </div>
                    <h4>Response Headers:</h4>
                    <pre class="code-block">${JSON.stringify(response.headers, null, 2)}</pre>
                    <h4>Response Body:</h4>
                    <pre class="code-block">${escapeHtml(response.body)}</pre>
                `;

                // Update response tab with new data
                renderResponseHeaders(response.headers, response.status, response.statusText);
                renderResponseBody(response.body, response.status, response.duration, response.body.length);
            } else {
                elements.replayResultsDisplay.innerHTML = `
                    <div style="color: var(--error);">
                        <strong>Error:</strong> ${escapeHtml(response.error)}
                    </div>
                `;
            }
        } catch (error) {
            console.error('[Explorer v2] Error replaying request:', error);
            elements.replayResultsDisplay.innerHTML = `
                <div style="color: var(--error);">
                    <strong>Error:</strong> ${escapeHtml(error.message)}
                </div>
            `;
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Filter input
        elements.filterInput.addEventListener('input', (e) => {
            filterText = e.target.value;
            renderAllRequests();
        });

        // Filter checkboxes
        elements.filterLive.addEventListener('change', (e) => {
            showLive = e.target.checked;
            renderAllRequests();
        });

        elements.filterStatic.addEventListener('change', (e) => {
            showStatic = e.target.checked;
            renderAllRequests();
        });

        // Resizer for adjusting panel heights
        let isResizing = false;
        let startY = 0;
        let startTableHeight = 0;
        let startDetailHeight = 0;

        elements.resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;

            // Get current heights
            startTableHeight = elements.requestTableContainer.offsetHeight;
            startDetailHeight = elements.detailPanel.offsetHeight;

            // Switch both panels to explicit heights to prevent collapse
            elements.requestTableContainer.style.flex = 'none';
            elements.requestTableContainer.style.height = `${startTableHeight}px`;
            elements.detailPanel.style.flex = 'none';
            elements.detailPanel.style.height = `${startDetailHeight}px`;
            elements.detailPanel.style.minHeight = 'unset';
            elements.detailPanel.style.maxHeight = 'unset';

            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            const newTableHeight = startTableHeight + deltaY;
            const newDetailHeight = startDetailHeight - deltaY;

            // Set minimum heights
            const minTableHeight = 150;
            const minDetailHeight = 250;

            // Only resize if both panels stay above their minimums
            if (newTableHeight >= minTableHeight && newDetailHeight >= minDetailHeight) {
                elements.requestTableContainer.style.height = `${newTableHeight}px`;
                elements.detailPanel.style.height = `${newDetailHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Scan page button
        elements.btnScanPage.addEventListener('click', scanPageForEndpoints);

        // Clear button
        elements.btnClear.addEventListener('click', async () => {
            if (confirm('Clear all captured requests?')) {
                requests.clear();
                elements.requestTbody.innerHTML = '<tr class="empty-row"><td colspan="7" class="empty-cell"><div class="empty-state"><span class="icon">🔍</span><p>No requests captured yet</p><small>API calls will appear here as they\'re made</small></div></td></tr>';
                updateRequestCount();

                // Clear in background
                await api.runtime.sendMessage({
                    type: 'CLEAR_API_ENDPOINTS',
                    tabId: targetTabId
                });
            }
        });

        // Send request button
        elements.btnSendRequest.addEventListener('click', sendRequest);

        // Copy cURL button
        elements.btnCopyCurl.addEventListener('click', () => {
            navigator.clipboard.writeText(elements.curlDisplay.textContent);
            showToast('cURL copied to clipboard');
        });

        // Format JSON button
        elements.btnFormatJson.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(elements.responseBodyDisplay.textContent);
                elements.responseBodyDisplay.textContent = JSON.stringify(parsed, null, 2);
            } catch (e) {
                showToast('Invalid JSON');
            }
        });

        // Copy response button
        elements.btnCopyResponse.addEventListener('click', () => {
            navigator.clipboard.writeText(elements.responseBodyDisplay.textContent);
            showToast('Response copied to clipboard');
        });

        // Add header button
        elements.btnAddHeader.addEventListener('click', () => {
            addHeaderRow();
        });

        // Body type radio buttons
        elements.bodyTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                applyBodyFormat(e.target.value);
            });
        });

        // cURL update on checkbox change
        elements.replayRemoveAuth.addEventListener('change', () => {
            if (selectedRequestId) {
                const request = requests.get(selectedRequestId);
                if (request) updateCurlCommand(request);
            }
        });
    }

    // Set up tab switching
    function setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Update active button
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update active pane
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
                });
            });
        });
    }

    // Render all requests (apply filters)
    function renderAllRequests() {
        requests.forEach(request => renderRequestRow(request));
    }

    // Update request count
    function updateRequestCount() {
        elements.requestCount.textContent = `${requests.size} request${requests.size !== 1 ? 's' : ''}`;
    }

    // Utility: Format bytes
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Utility: Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility: Show toast notification
    function showToast(message) {
        // Simple toast - could be enhanced
        console.log('[Toast]', message);
        alert(message);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
