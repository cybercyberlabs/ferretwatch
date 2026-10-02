/** Integration regressions using the actual manifest scripts and browser event boundary.
 * These mocks do not prove real Firefox/Cloudflare compatibility; see docs/monitoring-validation.md.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { TestFramework } = require('../framework.js');
const testFramework = new TestFramework();
const ROOT = path.resolve(__dirname, '../..');
const SECRET = 'ghp_' + 'a'.repeat(36);
const tick = () => new Promise(setImmediate);
function event() {
    return { listeners: [], addListener(fn, filter, extra) { this.listeners.push(fn); this.extra = extra; },
        emit(...args) { return this.listeners.map(fn => fn(...args)); } };
}

async function load(root = ROOT, initial = {}, worker = false) {
    const data = structuredClone(initial), filters = new Map(), notices = [], broadcasts = [], tabMessages = [], errors = [];
    const deadlines = new Map(); let timerId = 0;
    const api = {
        runtime: { id: 'test', getURL: p => 'moz-extension://test/' + p,
            onMessage: event(), onStartup: event(), onInstalled: event(),
            sendMessage: async message => { broadcasts.push(message); } },
        storage: { local: { get: async () => structuredClone(data), set: async values => {
            const changes = {};
            for (const [key, value] of Object.entries(values)) {
                if (JSON.stringify(data[key]) === JSON.stringify(value)) continue;
                changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
                data[key] = structuredClone(value);
            }
            if (Object.keys(changes).length) api.storage.onChanged.emit(changes, 'local');
        } }, onChanged: event() },
        tabs: { onRemoved: event(), onUpdated: event(), query: async () => [{ id: 1, url: 'https://site.invalid/' }],
            get: async id => ({ id, url: 'https://site.invalid/' }),
            sendMessage: async (id, message) => { tabMessages.push({ id, ...message }); } },
        browserAction: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
        notifications: { create: async value => { notices.push(value); return 'n'; }, clear: async () => {} },
        webRequest: { filterResponseData(id) {
            const filter = { writes: [], closed: false, disconnected: false,
                write(buffer) { this.writes.push(buffer); }, close() { this.closed = true; },
                disconnect() { this.disconnected = true; } };
            filters.set(String(id), filter); return filter;
        } }
    };
    for (const name of ['onBeforeRequest','onBeforeSendHeaders','onHeadersReceived','onCompleted','onErrorOccurred','onBeforeRedirect']) api.webRequest[name] = event();
    if (worker) delete api.webRequest.filterResponseData;
    const ctx = { browser: api, chrome: api, performance, AbortController, TextDecoder, TextEncoder, URL,
        Uint8Array, ArrayBuffer, console: { log() {}, debug() {}, warn() {}, error(...args) { errors.push(args.map(String).join(' ')); } },
        location: { href: 'moz-extension://test/background.html' }, addEventListener() {},
        setTimeout(fn, ms) { if (!ms) return setTimeout(fn, 0); const id = ++timerId; deadlines.set(id, fn); return id; },
        clearTimeout(id) { if (typeof id === 'number') deadlines.delete(id); else clearTimeout(id); } };
    if (!worker) ctx.window = ctx;
    ctx.self = ctx;
    vm.createContext(ctx);
    const evaluate = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
    ctx.importScripts = (...files) => files.forEach(evaluate);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    (worker ? [manifest.background.service_worker] : manifest.background.scripts).forEach(evaluate);
    const bg = vm.runInContext('backgroundService', ctx);
    assert.ok(bg, errors.join('\n'));
    await bg.ready;
    bg.beginDocument(1, 'https://site.invalid/');
    const h = { ctx, api, bg, filters, notices, broadcasts, tabMessages, errors, data, deadlines, manifest };
    h.flush = async () => {
        for (let i = 0; i < 500 && (bg.queuedScans || bg.pendingScans); i++) await new Promise(r => setTimeout(r, 2));
        assert.equal(bg.queuedScans + bg.pendingScans, 0, 'scans complete');
        await tick();
        assert.deepEqual(errors, [], 'no background errors');
    };
    h.message = async (message, sender = { url: 'moz-extension://test/popup/explorer-v2.html' }) => {
        let result; await bg.handleMessage(message, sender, value => { result = value; }); return result;
    };
    return h;
}
function request(h, id, overrides = {}) {
    const details = { requestId: String(id), tabId: 1, url: 'https://site.invalid/api/' + id,
        documentUrl: 'https://site.invalid/', method: 'GET', type: 'xmlhttprequest', statusCode: 200,
        requestHeaders: [{ name: 'X-Test', value: 'request' }],
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], ...overrides };
    h.api.webRequest.onBeforeRequest.emit(details);
    h.api.webRequest.onBeforeSendHeaders.emit(details);
    h.api.webRequest.onHeadersReceived.emit(details);
    const filter = h.filters.get(String(id));
    return { details, filter, finish(text = '') {
        if (filter && !filter.disconnected) {
            const bytes = typeof text === 'string' ? new TextEncoder().encode(text).buffer : text;
            filter.ondata({ data: bytes });
            if (!filter.disconnected) filter.onstop();
        }
        h.api.webRequest.onCompleted.emit(details);
    } };
}

testFramework.test('manifest background detects response secrets and notifies without settings stubs', async () => {
    const h = await load();
    const r = request(h, 'secret');
    const bytes = new TextEncoder().encode(JSON.stringify({ token: SECRET })).buffer;
    r.finish(bytes); await h.flush();
    assert.equal(h.bg.findingStore.list(1, false)[0].value, SECRET);
    assert.equal(h.notices.length, 1);
    assert.ok(h.manifest.permissions.includes('notifications'));
    assert.strictEqual(r.filter.writes[0], bytes, 'forward the identical original buffer');
    assert.ok(r.filter.closed);
    assert.ok(!h.api.webRequest.onBeforeSendHeaders.extra.includes('blocking'));
});

testFramework.test('Explorer receives live request IDs, bounded bodies, headers, status and invalidations', async () => {
    const h = await load();
    for (const id of ['one','two']) request(h, id, { method: 'POST',
        requestBody: { raw: [{ bytes: new TextEncoder().encode('hello').buffer }] } }).finish('{"ok":true}');
    await h.flush();
    const reply = await h.message({ type: 'GET_API_ENDPOINTS', tabId: 1 });
    assert.equal(reply.endpoints.length, 2);
    assert.deepEqual(Array.from(reply.endpoints, r => r.requestId), ['one','two']);
    assert.equal(reply.endpoints[0].headers['X-Test'], 'request');
    assert.equal(reply.endpoints[0].body, 'hello');
    assert.equal(reply.endpoints[0].response.status, 200);
    assert.equal(reply.endpoints[0].response.responseBody, '{"ok":true}');
    assert.ok(h.broadcasts.some(m => m.type === 'API_ENDPOINTS_UPDATED' && m.tabId === 1));
    assert.ok(h.broadcasts.every(m => !m.endpoint), 'invalidation does not broadcast captured secrets');
    const ownTab = await h.message({ type: 'GET_API_ENDPOINTS', tabId: 1 }, { tab: { id: 2 }, url: 'https://other.invalid/' });
    assert.equal(ownTab.endpoints.length, 0);
});

testFramework.test('monitoring continues after 1 MiB and retained history remains byte bounded', async () => {
    const h = await load();
    for (let i = 0; i < 9; i++) { request(h, i).finish(' '.repeat(128 * 1024)); await h.flush(); }
    request(h, 'late-secret').finish(SECRET); await h.flush();
    assert.equal(h.bg.findingStore.list(1, false)[0].value, SECRET);
    const bytes = h.bg.apiEndpoints.get(1).reduce((n, r) => n + new TextEncoder().encode(JSON.stringify(r)).length, 0);
    assert.ok(bytes <= h.ctx.FerretWatchContracts.CAPTURE_LIMITS.bytesPerTab);
    assert.equal(h.bg.requestLog.forTab(1).length, h.bg.apiEndpoints.get(1).length);
});

testFramework.test('rolling native endpoint history evicts old entries and keeps accepting requests', async () => {
    const h = await load();
    for (let i = 0; i < 250; i++) request(h, i, { responseHeaders: [{name:'Content-Type',value:'image/png'}] }).finish();
    assert.equal(h.bg.apiEndpoints.get(1).length, 200);
    assert.equal(h.bg.requestLog.forTab(1).length, 200);
    assert.ok(h.bg.requestLog.captures.has('249'));
    assert.ok(!h.bg.requestLog.captures.has('0'));
    assert.equal(h.bg.nativeMonitor.filters.size, 0);
});

testFramework.test('same-URL navigation rejects old responses, queued scans and content reports', async () => {
    const h = await load(); const old = h.bg.documentContext(1);
    const r = request(h, 'old'); r.filter.ondata({ data: new TextEncoder().encode(SECRET).buffer });
    request(h, 'queued').finish(SECRET);
    h.api.webRequest.onBeforeRequest.emit({ tabId: 1, type: 'main_frame', url: 'https://site.invalid/' });
    r.filter.onstop(); await h.flush();
    assert.ok(r.filter.disconnected);
    assert.equal(h.bg.findingStore.list(1, false).length, 0);
    assert.equal(h.bg.requestLog.forTab(1).length, 0);
    const stale = await h.message({ type: 'SCAN_REPORT', data: { context: old, findings: [{value:SECRET}], state:'success' } }, {tab:{id:1}});
    assert.equal(stale.accepted, false);
    request(h, 'new').finish(SECRET); await h.flush();
    assert.equal(h.bg.findingStore.list(1, false).length, 1);
});

testFramework.test('closing a tab cancels filters and queued scans without resurrecting stores', async () => {
    const h = await load(); const r = request(h, 'active'); request(h, 'queued').finish(SECRET);
    h.api.tabs.onRemoved.emit(1); r.filter.onstop(); await h.flush();
    assert.ok(r.filter.disconnected);
    assert.equal(h.bg.findingStore.state(1), 'unavailable');
    assert.ok(!h.bg.apiEndpoints.has(1));
    assert.equal(h.bg.requestLog.forTab(1).length, 0);
});

testFramework.test('whitelisting a page cancels third-party captures and unwhitelisting resumes automatically', async () => {
    const h = await load(); const r = request(h, 'active', {url:'https://cdn.invalid/app.js',type:'script'});
    const old = h.bg.documentContext(1);
    await h.api.storage.local.set({ settings: {...h.bg.settings, whitelistedDomains:['site.invalid']} }); await tick();
    assert.ok(r.filter.disconnected);
    assert.equal(h.bg.requestLog.forTab(1).length, 0);
    assert.equal(h.bg.findingStore.state(1), 'skipped');
    assert.ok(!h.bg.contextCurrent(1, old));
    assert.ok(!request(h, 'blocked', {url:'https://cdn.invalid/app.js'}).filter);
    assert.ok(h.tabMessages.some(m => m.type === 'SETTINGS_UPDATED' && m.context.policyVersion === h.bg.policyVersion));
    await h.api.storage.local.set({ settings:{...h.bg.settings, whitelistedDomains:[]} }); await tick();
    request(h, 'resumed').finish(SECRET); await h.flush();
    assert.equal(h.bg.findingStore.list(1, false).length, 1);
});

testFramework.test('resource whitelist and monitoring setting suppress capture without modifying requests', async () => {
    const h = await load();
    await h.api.storage.local.set({settings:{...h.bg.settings,whitelistedDomains:['cdn.invalid']}});
    assert.ok(!request(h, 'cdn', {url:'https://cdn.invalid/a.js'}).filter);
    await h.api.storage.local.set({settings:{...h.bg.settings,diagnostics:{...h.bg.settings.diagnostics,monitoring:false}}});
    assert.ok(!request(h, 'disabled').filter);
    assert.equal(h.bg.requestLog.forTab(1).length, 0);
});

testFramework.test('binary and event streams detach, oversized bodies forward before truncation, idle filters time out', async () => {
    const h = await load();
    for (const type of ['image/png','text/event-stream']) {
        const r = request(h, type, {responseHeaders:[{name:'Content-Type',value:type}]});
        assert.ok(r.filter.disconnected);
    }
    const large = request(h, 'large'); const bytes = new TextEncoder().encode(SECRET + ' '.repeat(300000)).buffer;
    large.finish(bytes); await h.flush();
    assert.strictEqual(large.filter.writes[0], bytes);
    assert.ok(large.filter.disconnected);
    assert.equal(h.bg.findingStore.state(1), 'truncated');
    assert.equal(h.bg.findingStore.list(1, false).length, 1);
    const idle = request(h, 'idle');
    h.bg.nativeMonitor.filters.get('idle').timer && h.deadlines.get(h.bg.nativeMonitor.filters.get('idle').timer)();
    assert.ok(idle.filter.disconnected);
    assert.equal(h.bg.nativeMonitor.filters.size, 0);
});

testFramework.test('capture exceptions detach the filter and preserve failed inspection state', async () => {
    const h = await load(); const r = request(h, 'broken');
    r.filter.ondata({data:new TextEncoder().encode(SECRET).buffer});
    h.api.webRequest.onErrorOccurred.emit({...r.details,error:'NS_ERROR_NET_RESET'});
    await h.flush();
    assert.ok(r.filter.disconnected);
    assert.equal(h.bg.findingStore.state(1), 'failed');
    assert.equal(h.bg.requestLog.captures.get('broken').response.error, 'NS_ERROR_NET_RESET');
});

testFramework.test('overload bounds open filters and queued scans and reports incomplete coverage', async () => {
    const h = await load();
    const open = Array.from({length:8}, (_,i) => request(h, 'open'+i));
    assert.equal(h.bg.nativeMonitor.filters.size, 4);
    assert.equal(h.bg.findingStore.state(1), 'truncated');
    for (const r of open) r.finish(SECRET);
    for (let i=0; i<10; i++) request(h,'queued'+i).finish(SECRET);
    assert.ok(h.bg.queuedScans <= 4);
    await h.flush();
    assert.equal(h.bg.findingStore.list(1, false).length, 4, 'one finding per captured source');
    assert.ok(h.bg.findingStore.list(1, false).every(f => f.value === SECRET));
    assert.equal(h.bg.findingStore.state(1), 'truncated');
});

testFramework.test('migrated settings remain authoritative after changes and background reload', async () => {
    const h = await load(ROOT, {userSettings:{debugMode:true,cloudBucketScanning:{testPublicAccess:true}},whitelistedDomains:['old.invalid']});
    assert.equal(h.bg.settings.debugMode, true);
    await h.api.storage.local.set({ settings:{...h.bg.settings, debugMode:false, whitelistedDomains:[], cloudBucketScanning:{testPublicAccess:false}} });
    const reloaded = await load(ROOT, h.data);
    assert.equal(reloaded.bg.settings.debugMode, false);
    assert.equal(reloaded.bg.settings.whitelistedDomains.length, 0);
    assert.equal(reloaded.bg.settings.cloudBucketScanning.testPublicAccess, false);
});

testFramework.test('content scan reports merge and respect background dismissal and document changes', async () => {
    const h = await load();
    const content = { ...h.ctx, location:{href:'https://site.invalid/',hostname:'site.invalid'},
        document:{documentElement:{innerHTML:SECRET}}, FerretWatchWhitelist:{isDomainWhitelisted:()=>false} };
    content.window = content; content.globalThis = content;
    content.browser = {...h.api,runtime:{sendMessage:message=>h.message(message,{tab:{id:1},url:'https://site.invalid/'})}};
    vm.createContext(content);
    // Load the real scanner manager with the actual background scan engine and settings.
    vm.runInContext(fs.readFileSync(path.join(ROOT,'content/scanner-manager.js'),'utf8'),content);
    const manager = content.FerretWatchScanner;
    manager.setScanner({}); manager.setDocumentContext(h.bg.documentContext(1));
    await manager.runScan();
    const finding = h.bg.findingStore.list(1,false)[0]; assert.ok(finding);
    await h.message({type:'DISMISS_FINDING',tabId:1,id:finding.id});
    assert.equal((await manager.runScan()).findings.length,0);
    const pending = manager.runScan(); manager.setDocumentContext(null);
    assert.equal((await pending).state,'unavailable');
});

testFramework.test('DOM observer retains multiple batches plus text and attribute mutations within a fixed bound', async () => {
    let callback, options, scheduled; const scans=[];
    const ctx={ TextEncoder,TextDecoder, FerretWatchContracts:require('../../utils/contracts.js'),
        MutationObserver:class { constructor(cb){callback=cb;} observe(root,opts){options=opts;} disconnect(){} },
        setTimeout(fn){scheduled=fn;return 1;}, clearTimeout(){scheduled=null;} };
    vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT,'content/dom-monitor.js'),'utf8'),ctx);
    const root={nodeType:1,closest:()=>null};
    const monitor=new ctx.FerretWatchDomMonitor(async(text,opts)=>scans.push({text,...opts}),root);
    callback([{type:'childList',target:root,addedNodes:[{nodeType:3,parentElement:root,textContent:SECRET}]}]);
    const first=scheduled;
    callback([{type:'characterData',target:{nodeType:3,parentElement:root,textContent:'updated-text'}},
        {type:'attributes',target:{...root,getAttribute:()=> 'attribute-secret'},attributeName:'data-token'}]);
    assert.strictEqual(scheduled,first,'continuous updates cannot postpone inspection');
    await scheduled();
    assert.ok(scans[0].text.includes(SECRET)); assert.ok(scans[0].text.includes('updated-text'));
    assert.ok(scans[0].text.includes('attribute-secret')); assert.equal(options.characterData,true); assert.equal(options.attributes,true);
    monitor.append('x'.repeat(400000)); assert.ok(monitor.bytes <= 256*1024);
    await monitor.flush(); assert.equal(scans[1].truncated,true);
    monitor.append('pending'); monitor.stop(); assert.equal(monitor.chunks.length,0);
});

testFramework.test('popup retains known findings when some scan sources are unavailable', async () => {
    const source = fs.readFileSync(path.join(ROOT, 'popup/popup.js'), 'utf8');
    const start = source.indexOf('async function loadCurrentFindings()');
    const end = source.indexOf('function displayFindings(', start);
    let displayed;
    const ctx = { console: { log() {} }, currentTab: { id: 1 }, updateStatus() {},
        displayFindings(findings) { displayed = findings; },
        browser: { runtime: { sendMessage: async () => ({state:'unavailable', findings:[{value:SECRET}]}) } } };
    vm.createContext(ctx);
    vm.runInContext(source.slice(start, end), ctx);
    await vm.runInContext('loadCurrentFindings()', ctx);
    assert.equal(displayed[0].value, SECRET);
});

module.exports = { testFramework, load, request, SECRET };
