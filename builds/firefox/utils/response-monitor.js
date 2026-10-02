/** Native request observation. Page networking functions are never replaced. */
class NativeResponseMonitor {
    constructor(service, api) {
        this.service = service;
        this.api = api;
        this.filters = new Map();
        this.limits = FerretWatchContracts.CAPTURE_LIMITS;
        this.hasNavigationListener = false;
    }

    headers(list) {
        const result = Object.create(null);
        let left = this.limits.requestBodyBytes;
        for (const header of list || []) {
            if (left <= 0) break;
            const name = String(header.name || '').slice(0, 256);
            const value = String(header.value || '').slice(0, left);
            result[name] = value;
            left -= name.length + value.length;
        }
        return result;
    }

    body(requestBody) {
        if (!requestBody) return null;
        if (requestBody.raw) {
            let left = this.limits.requestBodyBytes;
            const decoder = new TextDecoder();
            let text = '';
            for (const part of requestBody.raw) {
                if (!part.bytes || left <= 0) continue;
                const bytes = new Uint8Array(part.bytes).subarray(0, left);
                left -= bytes.byteLength;
                text += decoder.decode(bytes, { stream: true });
            }
            return text + decoder.decode();
        }
        if (requestBody.formData) {
            const pairs = [];
            let left = this.limits.requestBodyBytes;
            for (const [key, values] of Object.entries(requestBody.formData)) {
                for (const value of values) {
                    if (left <= 0) break;
                    const pair = [String(key).slice(0, 256), String(value).slice(0, left)];
                    pairs.push(pair);
                    left -= pair[0].length + pair[1].length;
                }
                if (left <= 0) break;
            }
            return JSON.stringify(pairs).slice(0, this.limits.requestBodyBytes);
        }
        return null;
    }

    allowed(details) {
        const s = this.service;
        const pageUrl = s.pageUrls.get(details.tabId) || details.documentUrl || details.originUrl;
        return Number.isInteger(details.tabId) && details.tabId >= 0 && !!s.settings &&
            s.settings.diagnostics.monitoring !== false &&
            !s.isWhitelistedUrl(pageUrl) && !s.isWhitelistedUrl(details.url);
    }

    current(record) {
        return this.service.contextCurrent(record.tabId, record.context) && this.allowed(record);
    }

    retain(record) {
        // Keep a rolling, byte-bounded history. Eviction never prevents future scans.
        const s = this.service;
        const records = (s.apiEndpoints.get(record.tabId) || []).filter(r => r.requestId !== record.requestId);
        records.push(record);
        const size = r => new TextEncoder().encode(JSON.stringify(r)).byteLength;
        let bytes = records.reduce((total, r) => total + size(r), 0);
        while (records.length && (records.length > this.limits.endpointsPerTab || bytes > this.limits.bytesPerTab)) {
            const removed = records.shift();
            bytes -= size(removed);
            s.requestLog.captures.delete(removed.requestId);
        }
        s.apiEndpoints.set(record.tabId, records);
        if (records.includes(record)) s.requestLog.captures.set(record.requestId, record);
        s.notifyExplorerTabs(record.tabId);
    }

    start(details) {
        const s = this.service;
        if (details.tabId < 0) return;
        if (details.type === 'main_frame') {
            s.beginDocument(details.tabId, details.url);
            return;
        }
        if (!['xmlhttprequest', 'script', 'fetch'].includes(details.type) || !this.allowed(details)) return;
        const record = {
            requestId: String(details.requestId), tabId: details.tabId,
            context: s.documentContext(details.tabId),
            pageUrl: s.pageUrls.get(details.tabId) || details.documentUrl || details.originUrl,
            url: details.url, method: details.method, type: details.type,
            timestamp: Date.now(), source: 'live', headers: {}, body: this.body(details.requestBody),
            response: null
        };
        try { record.origin = new URL(record.pageUrl || record.url).origin; } catch (_) { record.origin = null; }
        this.retain(record);
        if (s.settings.diagnostics.responseFilter === false ||
            typeof this.api.webRequest.filterResponseData !== 'function') {
            record.inspection = 'unavailable';
            s.handleScanReport({ findings: [], state: 'unavailable', context: record.context }, record.tabId);
            return;
        }
        if (this.filters.size >= this.limits.pendingScans) {
            record.inspection = 'truncated';
            s.handleScanReport({ findings: [], state: 'truncated', context: record.context }, record.tabId);
            return;
        }
        // Attach before the optimized Firefox script cache is consulted.
        let filter;
        try { filter = this.api.webRequest.filterResponseData(details.requestId); }
        catch (_) {
            record.inspection = 'unavailable';
            s.handleScanReport({ findings: [], state: 'unavailable', context: record.context }, record.tabId);
            return;
        }
        const tap = new FerretWatchContracts.ResponseTap({ byteLimit: this.limits.bytesPerResponse });
        let finished = false;
        const entry = { record, filter, tap, timer: null, finish: null };
        const finish = (mode, state) => {
            if (finished) return;
            finished = true;
            clearTimeout(entry.timer);
            this.filters.delete(record.requestId);
            try { mode === 'close' ? filter.close() : filter.disconnect(); }
            catch (_) { try { filter.disconnect(); } catch (_) { /* browser already ended the stream */ } }
            if (state === 'cancelled' || !this.current(record)) { tap.inspected = []; return; }
            const snapshot = state === 'failed' ? tap.fail() : tap.finish();
            tap.inspected = []; // Release copied chunks once decoded.
            record.inspection = state || snapshot.state;
            record.response = { ...(record.response || {}), responseBody: snapshot.text,
                responseSize: snapshot.forwardedBytes, duration: Date.now() - record.timestamp,
                inspection: record.inspection };
            this.retain(record);
            if (snapshot.text) {
                // Yield after releasing the filter; scanning never gates response delivery.
                s.queueCapturedText(record.tabId, record.pageUrl, snapshot.text, {
                    context: record.context, url: record.url,
                    state: record.inspection, sourceKind: record.type === 'script' ? 'script' : 'response'
                });
            } else if (tap.scannable && record.inspection !== 'success') {
                s.handleScanReport({ findings: [], state: record.inspection, context: record.context }, record.tabId);
            }
        };
        entry.finish = finish;
        this.filters.set(record.requestId, entry);
        entry.timer = setTimeout(() => finish('disconnect', 'truncated'), this.limits.captureTimeMs);
        filter.ondata = event => {
            try {
                filter.write(event.data); // Forward the original bytes before copying or inspecting.
                if (!this.current(record)) { finish('disconnect', 'cancelled'); return; }
                tap.write(event.data);
                if (tap.inspectedBytes >= tap.byteLimit) finish('disconnect', 'truncated');
            } catch (_) { finish('disconnect', 'failed'); }
        };
        filter.onstop = () => finish('close');
        filter.onerror = () => finish('disconnect', 'failed');
    }

    sentHeaders(details) {
        const record = this.service.requestLog.captures.get(String(details.requestId));
        if (!record || !this.current(record)) return;
        record.headers = this.headers(details.requestHeaders);
        this.retain(record);
    }

    receivedHeaders(details) {
        const entry = this.filters.get(String(details.requestId));
        const record = entry?.record || this.service.requestLog.captures.get(String(details.requestId));
        if (!record || !this.current(record)) { entry?.finish('disconnect', 'cancelled'); return; }
        record.response = { ...(record.response || {}), status: details.statusCode,
            statusText: String(details.statusLine || ''), responseHeaders: this.headers(details.responseHeaders) };
        if (entry) {
            const type = this.service.headerContentType(details.responseHeaders);
            entry.tap.contentType = type;
            entry.tap.scannable = FerretWatchContracts.isScannableContentType(type) && !/^text\/event-stream/i.test(type);
            if (!entry.tap.scannable) entry.finish('disconnect', 'unavailable');
        }
        this.retain(record);
    }

    complete(details, failed = false) {
        const entry = this.filters.get(String(details.requestId));
        if (failed) entry?.finish('disconnect', 'failed');
        const record = this.service.requestLog.captures.get(String(details.requestId));
        if (!record || !this.current(record)) return;
        record.response = { ...(record.response || {}), status: details.statusCode || record.response?.status || 0,
            duration: Date.now() - record.timestamp, error: failed ? details.error : null };
        this.retain(record);
    }

    cancelTab(tabId) {
        for (const entry of [...this.filters.values()]) {
            if (entry.record.tabId === tabId) entry.finish('disconnect', 'cancelled');
        }
    }

    policyChanged() {
        for (const entry of [...this.filters.values()]) entry.finish('disconnect', 'cancelled');
        for (const [tabId, records] of this.service.apiEndpoints) {
            const kept = records.filter(record => this.allowed(record));
            this.service.apiEndpoints.set(tabId, kept);
            this.service.requestLog.dropTab(tabId);
            kept.forEach(record => this.service.requestLog.captures.set(record.requestId, record));
            this.service.notifyExplorerTabs(tabId);
        }
    }

    install() {
        const wr = this.api.webRequest;
        if (!wr?.onBeforeRequest) return;
        this.hasNavigationListener = true;
        // Firefox must finish attaching the filter before looking up script bytecode.
        // This hook returns no request modifications and performs no async work.
        const extra = typeof wr.filterResponseData === 'function' ? ['blocking', 'requestBody'] : ['requestBody'];
        wr.onBeforeRequest.addListener(d => this.start(d), { urls: ['<all_urls>'] }, extra);
        wr.onBeforeSendHeaders.addListener(d => this.sentHeaders(d), { urls: ['<all_urls>'] }, ['requestHeaders']);
        wr.onHeadersReceived.addListener(d => this.receivedHeaders(d), { urls: ['<all_urls>'] }, ['responseHeaders']);
        wr.onCompleted.addListener(d => this.complete(d), { urls: ['<all_urls>'] });
        wr.onErrorOccurred.addListener(d => this.complete(d, true), { urls: ['<all_urls>'] });
        wr.onBeforeRedirect.addListener(d => this.filters.get(String(d.requestId))?.finish('disconnect', 'cancelled'), { urls: ['<all_urls>'] });
    }
}

globalThis.NativeResponseMonitor = NativeResponseMonitor;
