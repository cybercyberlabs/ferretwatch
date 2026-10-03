/**
 * Shared FerretWatch contracts: limits, settings, findings, messages, and
 * response-tap behavior. Loaded by the extension and by Node regression tests.
 */

const CAPTURE_LIMITS = {
    bytesPerResponse: 256 * 1024,
    bytesPerTab: 1024 * 1024,
    endpointsPerTab: 200,
    pendingScans: 4,
    scanTimeMs: 250,
    requestBodyBytes: 32 * 1024,
    matchesPerPattern: 200,
    bridgeMessageBytes: 280 * 1024,
    captureTimeMs: 5000,
    domQueueBytes: 256 * 1024,
    findingsPerTab: 1000
};

const PATTERN_CATEGORIES = ['aws', 'github', 'database', 'payment', 'messaging', 'email', 'cloudStorage', 'supabase'];

const SCAN_STATES = ['pending', 'success', 'skipped', 'truncated', 'unavailable', 'failed'];

const ACTIONS = {
    RESCAN: 'RESCAN',
    GET_FINDINGS: 'GET_FINDINGS',
    DISMISS_FINDING: 'DISMISS_FINDING',
    EXPORT_FINDINGS: 'EXPORT_FINDINGS',
    SCAN_REPORT: 'SCAN_REPORT',
    SETTINGS_UPDATED: 'SETTINGS_UPDATED'
};

const BRIDGE_TYPES = new Set(['FERRETWATCH_API_CALL', 'FERRETWATCH_API_RESPONSE']);

function defaultSettings() {
    const enabledCategories = {};
    PATTERN_CATEGORIES.forEach((category) => {
        enabledCategories[category] = true;
    });
    return {
        enabledCategories,
        scanningMode: 'progressive',
        scanDelay: 500,
        enableDebounce: true,
        showNotifications: true,
        enableNotifications: true,
        notificationDuration: 8000,
        notificationPosition: 'top-right',
        playSound: false,
        entropyThreshold: 3.5,
        minimumSecretLength: 10,
        enableContextFiltering: true,
        whitelistedDomains: [],
        maxFindings: 50,
        enableHighlighting: false,
        debugMode: false,
        cloudBucketScanning: {
            enabled: true,
            providers: {
                aws: true,
                gcp: true,
                azure: true,
                digitalocean: true,
                alibaba: true
            },
            testTimeout: 5000,
            maxConcurrentTests: 3,
            testPublicAccess: true
        },
        diagnostics: {
            monitoring: true,
            responseFilter: true,
            pageInterceptor: false,
            scanning: true
        }
    };
}

function mergeSettings(base, overlay) {
    if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
        return base;
    }
    const out = { ...base };
    Object.keys(overlay).forEach((key) => {
        const value = overlay[key];
        if (value === undefined) {
            return;
        }
        if (value && typeof value === 'object' && !Array.isArray(value) &&
            base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            out[key] = mergeSettings(base[key], value);
        } else {
            out[key] = value;
        }
    });
    return out;
}

function migrateStoredSettings(stored) {
    const raw = stored && typeof stored === 'object' ? stored : {};
    const defaults = defaultSettings();
    // A canonical settings object is authoritative, including empty/false values.
    // Read legacy keys only when no canonical object has been written yet.
    const canonical = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings);
    let merged = mergeSettings(defaults, canonical ? raw.settings : raw.userSettings);
    if (!canonical) {
        if (Array.isArray(raw.whitelistedDomains) && !raw.userSettings?.whitelistedDomains) {
            merged.whitelistedDomains = raw.whitelistedDomains.slice();
        }
        if (typeof raw.debugMode === 'boolean' && raw.userSettings?.debugMode === undefined) {
            merged.debugMode = raw.debugMode;
        }
    }
    const categories = {};
    PATTERN_CATEGORIES.forEach((category) => {
        const existing = merged.enabledCategories && merged.enabledCategories[category];
        categories[category] = existing === undefined ? true : !!existing;
    });
    merged.enabledCategories = categories;
    merged.diagnostics = mergeSettings(defaults.diagnostics, merged.diagnostics);
    if (!Array.isArray(merged.whitelistedDomains)) {
        merged.whitelistedDomains = [];
    }
    return merged;
}

function hostMatchesWhitelist(hostname, entries) {
    if (!hostname || !Array.isArray(entries)) {
        return false;
    }
    const host = String(hostname).toLowerCase();
    return entries.some((entry) => {
        if (!entry || typeof entry !== 'string') {
            return false;
        }
        const pattern = entry.toLowerCase().trim();
        if (!pattern) {
            return false;
        }
        if (pattern.startsWith('*.')) {
            const base = pattern.slice(2);
            return host === base || host.endsWith('.' + base);
        }
        return host === pattern;
    });
}

function hostPaused(hostname, pausedHosts) {
    if (!hostname || !pausedHosts) {
        return false;
    }
    const host = String(hostname).toLowerCase();
    return [...pausedHosts].some((entry) => String(entry || '').toLowerCase() === host);
}

function findingId(finding) {
    const raw = [
        finding.patternId || finding.type || '',
        finding.value || '',
        finding.sourceUrl || '',
        finding.sourceKind || ''
    ].join('\n');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = Math.imul(31, hash) + raw.charCodeAt(i) | 0;
    }
    return 'f_' + (hash >>> 0).toString(16);
}

class FindingStore {
    constructor() {
        this.tabs = new Map();
    }

    ensure(tabId) {
        if (!this.tabs.has(tabId)) {
            this.tabs.set(tabId, { generation: 1, findings: new Map(), state: 'pending' });
        }
        return this.tabs.get(tabId);
    }

    beginDocument(tabId) {
        const tab = this.ensure(tabId);
        tab.generation += 1;
        tab.findings = new Map();
        tab.state = 'pending';
        return tab.generation;
    }

    generation(tabId) {
        return this.ensure(tabId).generation;
    }

    state(tabId) {
        const tab = this.tabs.get(tabId);
        return tab ? tab.state : 'unavailable';
    }

    report(tabId, generation, findings, state) {
        const tab = this.ensure(tabId);
        if (generation != null && generation !== tab.generation) {
            return {
                accepted: false,
                reason: 'stale',
                state: tab.state,
                findings: this.list(tabId, false),
                added: []
            };
        }
        const added = [];
        let limited = false;
        (findings || []).forEach((finding) => {
            const id = finding.id || findingId(finding);
            const existing = tab.findings.get(id);
            if (!existing && tab.findings.size >= CAPTURE_LIMITS.findingsPerTab) {
                limited = true;
                return;
            }
            if (!existing) {
                added.push(id);
            }
            tab.findings.set(id, {
                ...finding,
                id,
                dismissed: existing ? existing.dismissed : !!finding.dismissed
            });
        });
        const incomplete = ['failed', 'truncated', 'unavailable'];
        const nextState = limited ? 'truncated' : (state || 'success');
        tab.state = incomplete.find(value => value === tab.state || value === nextState) || nextState;
        return {
            accepted: true,
            state: tab.state,
            findings: this.list(tabId, false),
            added
        };
    }

    dismiss(tabId, id) {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return false;
        }
        let finding = tab.findings.get(id);
        if (!finding) {
            finding = [...tab.findings.values()].find((item) => item.value === id);
        }
        if (!finding) {
            return false;
        }
        finding.dismissed = true;
        return true;
    }

    list(tabId, includeDismissed) {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return [];
        }
        return [...tab.findings.values()].filter((finding) => includeDismissed || !finding.dismissed);
    }

    close(tabId) {
        this.tabs.delete(tabId);
    }
}

function messageName(message) {
    if (!message || typeof message !== 'object') {
        return '';
    }
    return message.type || message.action || '';
}

function scanResponse(state, findings, error) {
    return {
        state: state || 'failed',
        findings: Array.isArray(findings) ? findings : [],
        error: error || null
    };
}

function isScannableContentType(contentType) {
    if (!contentType || typeof contentType !== 'string') {
        return false;
    }
    const value = contentType.toLowerCase();
    return value.startsWith('text/') ||
        value.includes('json') ||
        value.includes('javascript') ||
        value.includes('xml') ||
        value.includes('graphql');
}

function toUint8Array(chunk) {
    if (chunk instanceof Uint8Array) {
        return chunk;
    }
    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }
    if (typeof chunk === 'string') {
        return new TextEncoder().encode(chunk);
    }
    return new Uint8Array(0);
}

class ResponseTap {
    constructor(options) {
        const opts = options || {};
        this.byteLimit = opts.byteLimit || CAPTURE_LIMITS.bytesPerResponse;
        this.contentType = opts.contentType || '';
        this.scannable = isScannableContentType(this.contentType);
        this.inspected = [];
        this.inspectedBytes = 0;
        this.forwardedBytes = 0;
        this.truncated = false;
        this.closed = false;
        this.errored = false;
    }

    write(chunk) {
        const bytes = toUint8Array(chunk);
        this.forwardedBytes += bytes.byteLength;
        if (this.scannable && this.inspectedBytes < this.byteLimit) {
            const room = this.byteLimit - this.inspectedBytes;
            const slice = bytes.slice(0, room);
            this.inspected.push(slice);
            this.inspectedBytes += slice.byteLength;
            if (slice.byteLength < bytes.byteLength) {
                this.truncated = true;
            }
        } else if (this.scannable && bytes.byteLength > 0) {
            this.truncated = true;
        }
        return bytes;
    }

    finish() {
        this.closed = true;
        return this.snapshot();
    }

    fail() {
        this.closed = true;
        this.errored = true;
        return this.snapshot();
    }

    snapshot() {
        let text = '';
        if (this.scannable && this.inspected.length) {
            const merged = new Uint8Array(this.inspectedBytes);
            let offset = 0;
            this.inspected.forEach((chunk) => {
                merged.set(chunk, offset);
                offset += chunk.byteLength;
            });
            text = new TextDecoder().decode(merged);
        }
        let state = 'success';
        if (this.errored) {
            state = 'failed';
        } else if (!this.scannable) {
            state = 'unavailable';
        } else if (this.truncated) {
            state = 'truncated';
        }
        return {
            text,
            state,
            forwardedBytes: this.forwardedBytes,
            truncated: this.truncated,
            closed: this.closed
        };
    }
}

class CaptureBudget {
    constructor(limits) {
        this.limits = limits || CAPTURE_LIMITS;
        this.bytesRetained = 0;
        this.endpointCount = 0;
        this.pending = 0;
    }

    retain(text) {
        const value = text == null ? '' : String(text);
        const room = this.limits.bytesPerTab - this.bytesRetained;
        if (room <= 0) {
            return { text: '', state: 'truncated', omitted: true, reason: 'tab-budget' };
        }
        const kept = value.slice(0, room);
        this.bytesRetained += kept.length;
        const truncated = kept.length < value.length;
        return {
            text: kept,
            state: truncated ? 'truncated' : 'success',
            omitted: truncated,
            reason: truncated ? 'tab-budget' : null
        };
    }

    tryEndpoint() {
        if (this.endpointCount >= this.limits.endpointsPerTab) {
            return false;
        }
        this.endpointCount += 1;
        return true;
    }

    tryPending() {
        if (this.pending >= this.limits.pendingScans) {
            return false;
        }
        this.pending += 1;
        return true;
    }

    finishPending() {
        this.pending = Math.max(0, this.pending - 1);
    }

    reset() {
        this.bytesRetained = 0;
        this.endpointCount = 0;
        this.pending = 0;
    }
}

function classifyBucketAccess(testResult) {
    if (!testResult || testResult.skipped || testResult.untested) {
        return 'untested';
    }
    if (testResult.validationFailed || testResult.parseError) {
        return 'parse_failure';
    }
    if (testResult.timeout) {
        return 'timeout';
    }
    const error = (testResult.error || '').toLowerCase();
    if (testResult.cors || error.includes('cors') || error.includes('network') || error.includes('failed to fetch')) {
        return 'network_failure';
    }
    if (testResult.listingEnabled === true) {
        return 'public_listing';
    }
    if (testResult.accessible === true) {
        return 'accessible_object';
    }
    if (testResult.statusCode === 401 || testResult.statusCode === 403) {
        return 'access_denied';
    }
    if (testResult.accessible === null || testResult.failed) {
        return 'network_failure';
    }
    if (testResult.accessible === false && testResult.statusCode) {
        return 'access_denied';
    }
    return 'untested';
}

function normalizeRequestUrl(url, base) {
    try {
        return new URL(url, base || undefined).href;
    } catch (error) {
        return null;
    }
}

class RequestLog {
    constructor() {
        this.captures = new Map();
    }

    observe(fields) {
        const id = String(fields.requestId);
        const prev = this.captures.get(id) || {};
        const next = {
            ...prev,
            requestId: id,
            tabId: fields.tabId != null ? fields.tabId : prev.tabId,
            generation: fields.generation != null ? fields.generation : prev.generation,
            method: String(fields.method || prev.method || 'GET').toUpperCase(),
            url: fields.url || prev.url,
            headers: fields.headers || prev.headers || {},
            body: fields.body !== undefined ? fields.body : prev.body
        };
        this.captures.set(id, next);
        return next;
    }

    complete(fields) {
        const capture = this.captures.get(String(fields.requestId));
        if (!capture) {
            return null;
        }
        if (fields.status != null) {
            capture.status = fields.status;
        }
        if (fields.responseBody !== undefined) {
            capture.responseBody = fields.responseBody;
        }
        if (fields.duration != null) {
            capture.duration = fields.duration;
        }
        return capture;
    }

    forTab(tabId) {
        return [...this.captures.values()].filter((capture) => capture.tabId === tabId);
    }

    dropTab(tabId) {
        [...this.captures.keys()].forEach((id) => {
            if (this.captures.get(id).tabId === tabId) {
                this.captures.delete(id);
            }
        });
    }
}

function groupEndpoints(captures) {
    const groups = new Map();
    captures.forEach((capture) => {
        const key = capture.method + ' ' + capture.url;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(capture);
    });
    return groups;
}

function maskSecret(value) {
    if (value == null) {
        return '';
    }
    const text = String(value);
    if (text.length <= 8) {
        return '••••';
    }
    return text.slice(0, 4) + '••••' + text.slice(-2);
}

function maskContext(context, secret) {
    if (!context) {
        return '';
    }
    if (!secret) {
        return String(context);
    }
    return String(context).split(String(secret)).join(maskSecret(secret));
}

function validateBridgeMessage(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, reason: 'shape' };
    }
    if (!BRIDGE_TYPES.has(data.type)) {
        return { ok: false, reason: 'type' };
    }
    let size = 0;
    try {
        size = JSON.stringify(data).length;
    } catch (error) {
        return { ok: false, reason: 'unserializable' };
    }
    if (size > CAPTURE_LIMITS.bridgeMessageBytes) {
        return { ok: false, reason: 'size' };
    }
    if (!data.data || typeof data.data !== 'object') {
        return { ok: false, reason: 'payload' };
    }
    return { ok: true, message: data };
}

function requestedTabId(message) {
    if (!message || typeof message !== 'object') {
        return null;
    }
    const candidates = [
        message.tabId,
        message.data && message.data.tabId,
        message.data && message.data.sourceTabId
    ];
    for (let i = 0; i < candidates.length; i++) {
        const value = candidates[i];
        if (value == null || value === '') {
            continue;
        }
        const id = Number(value);
        if (Number.isInteger(id) && id >= 0) {
            return id;
        }
    }
    return null;
}

function isExtensionSender(sender, extensionOrigin) {
    const url = sender && typeof sender.url === 'string' ? sender.url : '';
    return !!(extensionOrigin && url.startsWith(extensionOrigin));
}

function authorizedTabId(message, sender, extensionOrigin) {
    const ownTab = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
    if (isExtensionSender(sender, extensionOrigin)) {
        const requested = requestedTabId(message);
        return requested != null ? requested : ownTab;
    }
    return ownTab;
}

function boundText(text, limit) {
    const value = text == null ? '' : String(text);
    const max = limit == null ? CAPTURE_LIMITS.requestBodyBytes : limit;
    if (value.length <= max) {
        return { text: value, truncated: false };
    }
    return { text: value.slice(0, max), truncated: true };
}

const FerretWatchContracts = {
    CAPTURE_LIMITS,
    PATTERN_CATEGORIES,
    SCAN_STATES,
    ACTIONS,
    defaultSettings,
    mergeSettings,
    migrateStoredSettings,
    hostMatchesWhitelist,
    hostPaused,
    findingId,
    FindingStore,
    messageName,
    scanResponse,
    isScannableContentType,
    ResponseTap,
    CaptureBudget,
    classifyBucketAccess,
    normalizeRequestUrl,
    RequestLog,
    groupEndpoints,
    maskSecret,
    maskContext,
    validateBridgeMessage,
    requestedTabId,
    isExtensionSender,
    authorizedTabId,
    boundText
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FerretWatchContracts;
}

if (typeof globalThis !== 'undefined') {
    globalThis.FerretWatchContracts = FerretWatchContracts;
}
if (typeof window !== 'undefined') {
    window.FerretWatchContracts = FerretWatchContracts;
}
