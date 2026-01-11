# API Explorer Enhancement Roadmap

## Quick Wins (High Impact, Low Effort)

### 1. Add Response Viewer with Syntax Highlighting
**Effort:** Medium | **Impact:** High

**Current:** Plain text in small output box
**Improved:** Formatted JSON/XML/HTML with syntax highlighting

```javascript
// In explorer.js
function displayResponse(body, contentType) {
    const viewer = document.getElementById('response-viewer');

    // Auto-detect or use content-type
    if (contentType.includes('json') || isJSON(body)) {
        viewer.innerHTML = highlightJSON(JSON.parse(body));
    } else if (contentType.includes('xml')) {
        viewer.innerHTML = highlightXML(body);
    } else if (contentType.includes('html')) {
        viewer.innerHTML = highlightHTML(body);
    } else {
        viewer.textContent = body;
    }
}
```

**Files to modify:**
- `popup/explorer.html` - Add better response viewer
- `popup/explorer.js` - Add formatting logic
- `popup/explorer.css` - Add syntax highlighting styles

---

### 2. Add "Copy as cURL" Button
**Effort:** Low | **Impact:** High

**Benefit:** Developers love cURL commands for testing

```javascript
function generateCurlCommand(endpoint) {
    let curl = `curl -X ${endpoint.method} '${endpoint.url}'`;

    // Add headers
    if (endpoint.headers) {
        for (const [key, value] of Object.entries(endpoint.headers)) {
            curl += ` \\\n  -H '${key}: ${value}'`;
        }
    }

    // Add body
    if (endpoint.body) {
        const body = typeof endpoint.body === 'string'
            ? endpoint.body
            : JSON.stringify(endpoint.body);
        curl += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
    }

    return curl;
}
```

**UI Addition:**
```html
<button id="btn-copy-curl" class="btn secondary">
    <span class="icon">📋</span> Copy as cURL
</button>
```

---

### 3. Show Request/Response Timing
**Effort:** Low | **Impact:** Medium

**Current:** No timing information
**Improved:** Show request duration and breakdown

```javascript
async function replayRequest() {
    const timing = {
        start: performance.now(),
        dns: null,
        connect: null,
        request: null,
        response: null,
        total: null
    };

    // ... execute request ...

    timing.total = performance.now() - timing.start;

    logAnalysis(`⏱️ Request completed in ${timing.total.toFixed(2)}ms`, 'info');
}
```

---

### 4. Add Request History
**Effort:** Medium | **Impact:** High

**Benefit:** Track what you've tested, compare results

```javascript
// Store in memory or local storage
const requestHistory = [];

function addToHistory(endpoint, response, timestamp) {
    requestHistory.push({
        id: Date.now(),
        endpoint,
        response,
        timestamp: timestamp || new Date().toISOString()
    });

    updateHistoryView();
}

function updateHistoryView() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = requestHistory.map(entry => `
        <div class="history-item" data-id="${entry.id}">
            <span class="timestamp">${new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span class="method">${entry.endpoint.method}</span>
            <span class="status" class="status-${Math.floor(entry.response.status / 100)}xx">
                ${entry.response.status}
            </span>
        </div>
    `).join('');
}
```

---

### 5. Editable Headers Before Replay
**Effort:** Medium | **Impact:** High

**Use Case:** Test with different auth tokens, modify content-type

```html
<div class="header-editor">
    <h4>Request Headers <button id="add-header">+ Add</button></h4>
    <div id="headers-list">
        <!-- Dynamically populated -->
    </div>
</div>
```

```javascript
function createHeaderEditor(headers) {
    const container = document.getElementById('headers-list');
    container.innerHTML = '';

    for (const [key, value] of Object.entries(headers)) {
        const row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML = `
            <input type="text" class="header-key" value="${key}">
            <input type="text" class="header-value" value="${value}">
            <button class="remove-header">❌</button>
        `;
        container.appendChild(row);
    }
}

function getEditedHeaders() {
    const headers = {};
    document.querySelectorAll('.header-row').forEach(row => {
        const key = row.querySelector('.header-key').value.trim();
        const value = row.querySelector('.header-value').value.trim();
        if (key) headers[key] = value;
    });
    return headers;
}
```

---

## Medium Priority Enhancements

### 6. Response Comparison Tool
**Effort:** High | **Impact:** Medium

Compare responses between:
- Original vs Replayed
- Before auth removal vs After
- Different header configurations

```javascript
function compareResponses(original, modified) {
    return {
        statusChanged: original.status !== modified.status,
        bodyChanged: original.body !== modified.body,
        headerDiff: diffHeaders(original.headers, modified.headers),
        sizeDiff: modified.body.length - original.body.length
    };
}
```

---

### 7. Save API Collections
**Effort:** High | **Impact:** Medium

```javascript
async function saveCollection() {
    const collection = {
        name: prompt('Collection name:'),
        timestamp: Date.now(),
        endpoints: apiEndpoints.map(ep => ({
            ...ep,
            notes: '',
            tags: []
        }))
    };

    await browser.storage.local.set({
        [`collection_${collection.timestamp}`]: collection
    });
}
```

---

### 8. Export to Postman/Insomnia
**Effort:** High | **Impact:** Medium

```javascript
function exportToPostman() {
    const collection = {
        info: {
            name: `FerretWatch - ${new URL(currentTab.url).hostname}`,
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: apiEndpoints.map(ep => ({
            name: `${ep.method} ${new URL(ep.url).pathname}`,
            request: {
                method: ep.method,
                header: Object.entries(ep.headers || {}).map(([key, value]) => ({
                    key, value
                })),
                url: {
                    raw: ep.url,
                    protocol: new URL(ep.url).protocol.replace(':', ''),
                    host: new URL(ep.url).hostname.split('.'),
                    path: new URL(ep.url).pathname.split('/').filter(Boolean)
                },
                body: ep.body ? {
                    mode: 'raw',
                    raw: typeof ep.body === 'string' ? ep.body : JSON.stringify(ep.body)
                } : undefined
            }
        }))
    };

    downloadJSON(collection, `ferretwatch-${Date.now()}.postman_collection.json`);
}
```

---

### 9. Automated Security Test Templates
**Effort:** Very High | **Impact:** High

Pre-built security tests:
- ✅ Broken Authentication
- ✅ SQL Injection patterns
- ✅ XSS in parameters
- ✅ IDOR testing
- ✅ Rate limiting check

```javascript
const securityTests = {
    sqlInjection: {
        name: 'SQL Injection Test',
        payloads: ["' OR '1'='1", "admin'--", "' UNION SELECT NULL--"],
        async test(endpoint) {
            for (const payload of this.payloads) {
                // Inject into URL params, headers, body
                const results = await testPayload(endpoint, payload);
                if (results.vulnerable) return results;
            }
            return { vulnerable: false };
        }
    },

    brokenAuth: {
        name: 'Broken Authentication',
        async test(endpoint) {
            // Already implemented!
            const withAuth = await sendRequest(endpoint);
            const withoutAuth = await sendRequest({
                ...endpoint,
                headers: removeAuthHeaders(endpoint.headers)
            });

            return {
                vulnerable: withoutAuth.status === 200,
                details: {
                    withAuth: withAuth.status,
                    withoutAuth: withoutAuth.status
                }
            };
        }
    }
};
```

---

### 10. Request Body Editor
**Effort:** Medium | **Impact:** Medium

Edit JSON body before replaying:

```html
<div class="body-editor">
    <h4>Request Body
        <select id="body-mode">
            <option value="json">JSON</option>
            <option value="form">Form Data</option>
            <option value="raw">Raw</option>
        </select>
    </h4>
    <textarea id="body-content" rows="10"></textarea>
    <button id="format-body">Format JSON</button>
    <button id="validate-body">Validate</button>
</div>
```

---

## UI/UX Improvements

### 11. Better Error Messages
**Effort:** Low | **Impact:** High

```javascript
const ERROR_MESSAGES = {
    CSP_BLOCKED: {
        title: '🚫 CSP Restriction',
        message: 'The target website blocks script injection. Using background fetch mode (cookies may not be included).',
        action: 'Learn More',
        link: 'https://docs.ferretwatch.com/csp-issues'
    },
    CORS_FAILED: {
        title: '🌐 CORS Error',
        message: 'Cross-origin request blocked. The API may not allow requests from browser extensions.',
        suggestion: 'Try testing with the API\'s actual domain as the origin.'
    },
    NETWORK_ERROR: {
        title: '⚠️ Network Error',
        message: 'Failed to connect to the server.',
        suggestions: [
            'Check if the server is running',
            'Verify the URL is correct',
            'Check your internet connection'
        ]
    }
};

function showErrorModal(errorType, details) {
    const error = ERROR_MESSAGES[errorType];
    const modal = document.getElementById('error-modal');
    modal.querySelector('.title').textContent = error.title;
    modal.querySelector('.message').textContent = error.message;

    if (error.suggestions) {
        const list = modal.querySelector('.suggestions');
        list.innerHTML = error.suggestions.map(s => `<li>${s}</li>`).join('');
    }

    modal.style.display = 'flex';
}
```

---

### 12. Loading States & Progress
**Effort:** Low | **Impact:** Medium

```javascript
function showLoading(message) {
    const loader = document.getElementById('loader');
    loader.querySelector('.message').textContent = message;
    loader.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loader').style.display = 'none';
}

// Usage
async function replayRequest() {
    showLoading('Replaying request...');
    try {
        const response = await sendProxyRequest(...);
        logAnalysis('✅ Success', 'success');
    } catch (error) {
        logAnalysis('❌ Failed', 'failure');
    } finally {
        hideLoading();
    }
}
```

---

### 13. Keyboard Shortcuts
**Effort:** Low | **Impact:** Medium

```javascript
document.addEventListener('keydown', (e) => {
    // Ctrl+R / Cmd+R - Replay request
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        replayRequest();
    }

    // Ctrl+T / Cmd+T - Test auth
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        testBrokenAuth();
    }

    // Ctrl+C / Cmd+C - Copy as cURL (when focused on request)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !window.getSelection().toString()) {
        e.preventDefault();
        copyCurlCommand();
    }
});
```

---

## Implementation Priority

### Sprint 1: Critical Fixes ✅
- [x] Fix CSP violation
- [x] Fix inline onclick handlers

### Sprint 2: Quick Wins (2-3 days)
- [ ] Response syntax highlighting
- [ ] Copy as cURL
- [ ] Request timing display
- [ ] Better error messages

### Sprint 3: Core Features (1 week)
- [ ] Editable headers
- [ ] Request history
- [ ] Response comparison
- [ ] Request body editor

### Sprint 4: Advanced Features (2 weeks)
- [ ] Save/load collections
- [ ] Export to Postman
- [ ] Automated security tests
- [ ] Bulk endpoint testing

---

## Technical Considerations

### Performance
- Use virtual scrolling for large endpoint lists
- Lazy load response bodies > 1MB
- Debounce header/body editing

### Security
- Sanitize all displayed content (XSS prevention)
- Warn before modifying POST/PUT/DELETE
- Don't log sensitive data automatically
- Add option to redact auth headers in exports

### Accessibility
- Keyboard navigation for all actions
- Screen reader friendly labels
- High contrast mode support
- Focus management in modals

### Testing
- Unit tests for formatting functions
- Integration tests for request flow
- Manual testing on popular sites:
  - GitHub API
  - Twitter API
  - REST Countries API
  - JSONPlaceholder

---

## Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1** | 1 week | CSP fix, basic UI improvements |
| **Phase 2** | 2 weeks | Response viewer, cURL export, timing |
| **Phase 3** | 3 weeks | Headers/body editor, history |
| **Phase 4** | 4 weeks | Collections, Postman export |
| **Phase 5** | 2 weeks | Security test automation |

**Total:** ~3 months for full feature set

---

## Resources Needed

- **Libraries:**
  - Syntax highlighter: highlight.js or prism.js (~50KB)
  - JSON diff: jsondiffpatch (~30KB)
  - Optional: Monaco Editor for advanced editing (~2MB)

- **Documentation:**
  - User guide for API Explorer
  - Video tutorial
  - API security testing best practices

- **Testing:**
  - Test suite for proxy functionality
  - Browser compatibility matrix
  - Performance benchmarks

---

## Success Metrics

- ✅ Zero CSP violations
- ✅ < 2s response time for UI interactions
- ✅ 95%+ user satisfaction
- ✅ < 50KB additional bundle size for core features
- ✅ Works on top 100 websites

---

**Next Steps:**
1. Get user feedback on priority
2. Create detailed specs for Sprint 2
3. Set up testing infrastructure
4. Begin implementation

For questions or suggestions, open an issue on GitHub!
