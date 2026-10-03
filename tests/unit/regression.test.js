/**
 * Regression tests for the maintained FerretWatch modules.
 * Legacy pattern, utility, and mock-scanner suites stay on disk and run with --legacy.
 */

const fs = require('fs');
const path = require('path');
const framework = require('../framework.js');
const TestFramework = framework.TestFramework;
const Assert = framework.Assert;

const contracts = require('../../utils/contracts.js');
const patterns = require('../../config/patterns.js');
const context = require('../../utils/context.js');
const { ProgressiveScanner } = require('../../utils/scanner.js');

global.window = global;
global.FerretWatchContracts = contracts;
global.patternValidator = patterns.patternValidator;
global.ContextUtils = context;
global.StorageUtils = {
    getSetting(key, fallback) {
        if (key === 'maxFindings') return 50;
        if (key === 'scanningMode') return 'progressive';
        if (key === 'debugMode') return false;
        if (key === 'scanDelay') return 0;
        if (key === 'enableDebounce') return false;
        return fallback;
    },
    isCategoryEnabled() { return true; },
    isBucketScanningEnabled() { return false; },
    isProviderEnabled() { return true; },
    getBucketScanningSettings() {
        return { enabled: false, testPublicAccess: false, maxConcurrentTests: 1, testTimeout: 1000 };
    }
};

const testFramework = new TestFramework();
const GITHUB = 'ghp_' + 'a'.repeat(32) + 'test';
const AWS = 'AKIA1234567890ABCDEF';
const STRIPE = 'sk_test_' + 'a'.repeat(24);

function installScannerSettings(overrides) {
    const bucket = {
        enabled: true,
        testPublicAccess: false,
        maxConcurrentTests: 1,
        testTimeout: 1000,
        ...(overrides || {})
    };
    global.StorageUtils.isBucketScanningEnabled = () => bucket.enabled;
    global.StorageUtils.getBucketScanningSettings = () => bucket;
}

testFramework.test('runner result keeps the original failure, counts, and timing', async () => {
    const nested = new TestFramework();
    nested.test('deliberate failure', () => {
        Assert.equal(1, 2, 'expected mismatch');
    });
    const results = await nested.runAll();
    Assert.equal(results.failed, 1, 'failed count');
    Assert.equal(results.passed, 0, 'passed count');
    Assert.equal(results.failures.length, 1, 'failure retained');
    Assert.match(results.failures[0].error, /expected mismatch/, 'original message');
    Assert.true(results.executionTime >= 0, 'timing present');
});

testFramework.test('exit code is nonzero when a suite failed', () => {
    const runnerPath = path.join(__dirname, '../test-runner.js');
    const source = fs.readFileSync(runnerPath, 'utf8');
    Assert.match(source, /getExitCode\(\)/, 'runner exposes exit code');
    const { TestRunner } = require('../test-runner.js');
    const runner = new TestRunner();
    runner.results.overall = { failed: 1, passed: 0, total: 1 };
    Assert.equal(runner.getExitCode(), 1, 'nonzero on failure');
    runner.results.overall.failed = 0;
    Assert.equal(runner.getExitCode(), 0, 'zero on success');
});

testFramework.test('stripe test-mode key is detected and a placeholder is not', () => {
    const stripe = { category: 'payment', riskLevel: 'high' };
    Assert.true(patterns.patternValidator.isValidSecret(STRIPE, stripe), 'substring test is not a placeholder');
    Assert.false(patterns.patternValidator.isValidSecret('YOUR_API_KEY', stripe), 'placeholder prefix');
    Assert.false(patterns.patternValidator.isValidSecret('example_key', { category: 'github' }), 'example token');
});

testFramework.test('progressive scan attributes visible, attribute, script, and response secrets', async () => {
    installScannerSettings({ enabled: false });
    const scanner = new ProgressiveScanner();
    const all = patterns.patternManager.getAllPatterns();
    const html = `<html><body>
        <p>${AWS}</p>
        <a href="https://example.com/?token=${GITHUB}">link</a>
        <script>const token = "${GITHUB.replace('ghp_', 'ghs_')}";</script>
    </body></html>`;
    const findings = await scanner.progressiveScan(html, all, { sourceUrl: 'https://example.com/app' });
    const byValue = new Map(findings.map((finding) => [finding.value, finding]));
    Assert.true(byValue.has(AWS), 'visible aws key');
    Assert.equal(byValue.get(AWS).sourceKind, 'visible', 'visible source');
    Assert.true(findings.some((finding) => finding.value.indexOf(GITHUB) !== -1), 'attribute token');
    Assert.equal(
        findings.find((finding) => finding.value.indexOf(GITHUB) !== -1).sourceKind,
        'attribute',
        'attribute source'
    );
    const scriptToken = GITHUB.replace('ghp_', 'ghs_');
    Assert.true(byValue.has(scriptToken), 'inline script token');
    Assert.equal(byValue.get(scriptToken).sourceKind, 'script', 'script source');

    const repeated = await scanner.progressiveScan(html, all, { sourceUrl: 'https://example.com/app' });
    const awsCount = repeated.filter((finding) => finding.value === AWS).length;
    Assert.equal(awsCount, 1, 'one finding across scan phases');

    const json = await scanner.progressiveScan(JSON.stringify({ key: STRIPE }), all, {
        sourceKind: 'response',
        sourceUrl: 'https://example.com/api'
    });
    Assert.true(json.some((finding) => finding.value === STRIPE), 'json response secret');
    Assert.equal(json.find((finding) => finding.value === STRIPE).sourceKind, 'response', 'response source');
    Assert.equal(json.find((finding) => finding.value === STRIPE).sourceUrl, 'https://example.com/api', 'response url');
});

testFramework.test('a short time budget still scans later patterns', async () => {
    installScannerSettings({ enabled: false });
    const scanner = new ProgressiveScanner();
    const mongo = 'mongodb://username:password@cluster.mongodb.net/myapp';
    const aws = 'AKIAIOSFODNN7EXAMPLE';
    const bucket = 'https://github-cloud.s3.amazonaws.com/object';
    const findings = await scanner.progressiveScan(
        `${aws}\n${mongo}\n${bucket}`,
        patterns.patternManager.getAllPatterns(),
        { sourceKind: 'response', sourceUrl: 'https://example.com/readme', scanTimeMs: -1 }
    );
    Assert.true(findings.some((finding) => finding.value === mongo), 'mongodb pattern still runs');
    Assert.true(findings.some((finding) => finding.value === aws), 'aws pattern still runs');
    Assert.true(findings.some((finding) => String(finding.value).includes('github-cloud')), 'later bucket pattern still runs');
    Assert.equal(scanner.lastScanState, 'success', 'pausing for time is not a truncated scan');
});

testFramework.test('low and medium patterns are not dropped from the complete scan', async () => {
    installScannerSettings({ enabled: false });
    const scanner = new ProgressiveScanner();
    const sendgrid = 'SG.' + 'a'.repeat(22) + '.' + 'b'.repeat(43);
    const findings = await scanner.progressiveScan(sendgrid, patterns.patternManager.getAllPatterns(), {
        sourceKind: 'response',
        sourceUrl: 'https://example.com/body'
    });
    Assert.true(findings.some((finding) => finding.value === sendgrid), 'medium sendgrid pattern');
    Assert.true(findings.some((finding) => finding.riskLevel === 'high'), 'sendgrid risk kept');
});

testFramework.test('response tap forwards original bytes and bounds inspection', () => {
    const tap = new contracts.ResponseTap({ contentType: 'application/json', byteLimit: 8 });
    const chunk = new TextEncoder().encode('0123456789abcdef');
    const forwarded = tap.write(chunk);
    Assert.equal(forwarded.byteLength, chunk.byteLength, 'original chunk returned');
    const done = tap.finish();
    Assert.equal(done.forwardedBytes, chunk.byteLength, 'all bytes forwarded');
    Assert.equal(done.text, '01234567', 'inspection prefix');
    Assert.equal(done.state, 'truncated', 'truncated state');
    Assert.true(done.closed, 'filter closed');

    const binary = new contracts.ResponseTap({ contentType: 'application/octet-stream', byteLimit: 8 });
    binary.write(chunk);
    const binaryDone = binary.finish();
    Assert.equal(binaryDone.state, 'unavailable', 'binary not scanned');
    Assert.equal(binaryDone.text, '', 'binary body not retained');
    Assert.equal(binaryDone.forwardedBytes, chunk.byteLength, 'binary still forwarded');
});

testFramework.test('tab budget stops retention without pretending the transfer failed', () => {
    const budget = new contracts.CaptureBudget({ ...contracts.CAPTURE_LIMITS, bytesPerTab: 4 });
    const first = budget.retain('abcdef');
    Assert.equal(first.text, 'abcd', 'kept prefix');
    Assert.equal(first.state, 'truncated', 'marked truncated');
    const second = budget.retain('zzzz');
    Assert.equal(second.text, '', 'later capture omitted');
    Assert.equal(second.reason, 'tab-budget', 'reason recorded');
});

testFramework.test('finding store dedupes, dismisses for this document, and drops stale reports', () => {
    const store = new contracts.FindingStore();
    const generation = store.generation(1);
    const finding = { id: 'f1', value: 'secret', type: 'token', sourceUrl: 'https://a', sourceKind: 'visible' };
    const first = store.report(1, generation, [finding], 'success');
    const second = store.report(1, generation, [finding], 'success');
    Assert.equal(first.added.length, 1, 'first report is new');
    Assert.equal(second.added.length, 0, 'repeat is not new');
    Assert.equal(store.list(1, false).length, 1, 'count stays one');
    Assert.true(store.dismiss(1, 'f1'), 'dismissed');
    Assert.equal(store.list(1, false).length, 0, 'popup hides dismissed');
    Assert.equal(store.list(1, true).length, 1, 'export keeps dismissed');
    Assert.true(store.list(1, true)[0].dismissed, 'dismiss flag');
    const next = store.beginDocument(1);
    Assert.equal(store.report(1, generation, [finding], 'success').accepted, false, 'old generation dropped');
    Assert.equal(store.report(1, next, [{ ...finding, id: 'f2' }], 'success').accepted, true, 'new document accepted');
    store.close(1);
    Assert.equal(store.state(1), 'unavailable', 'closed tab is unavailable');
});

testFramework.test('settings migration keeps user choices and ignores invented categories', () => {
    const migrated = contracts.migrateStoredSettings({
        settings: { maxFindings: 7, enabledCategories: { aws: false, slack: false } },
        userSettings: { debugMode: true, whitelistedDomains: ['example.com'] },
        debugMode: false
    });
    Assert.equal(migrated.maxFindings, 7, 'settings value kept');
    Assert.equal(migrated.debugMode, false, 'canonical settings wins');
    Assert.equal(migrated.whitelistedDomains.length, 0, 'legacy whitelist does not override canonical');
    Assert.false(migrated.enabledCategories.aws, 'aws choice kept');
    Assert.equal(migrated.enabledCategories.slack, undefined, 'unknown category dropped');
    Assert.true(migrated.enabledCategories.github, 'real category defaulted');
    Assert.false(migrated.diagnostics.pageInterceptor, 'page wrapper stays off');
});

testFramework.test('temporary pause matches only the exact host', () => {
    Assert.true(contracts.hostPaused('github.com', ['github.com']), 'paused host');
    Assert.false(contracts.hostPaused('gist.github.com', ['github.com']), 'subdomain stays active');
    Assert.false(contracts.hostPaused('github.com', []), 'empty pause list');
});

testFramework.test('whitelist matches exact hosts and subdomains', () => {
    Assert.true(contracts.hostMatchesWhitelist('example.com', ['example.com']), 'exact host');
    Assert.false(contracts.hostMatchesWhitelist('sub.example.com', ['example.com']), 'exact does not include subdomain');
    Assert.true(contracts.hostMatchesWhitelist('sub.example.com', ['*.example.com']), 'subdomain wildcard');
    Assert.true(contracts.hostMatchesWhitelist('example.com', ['*.example.com']), 'wildcard base host');
    Assert.false(contracts.hostMatchesWhitelist('example.com.evil', ['*.example.com']), 'suffix boundary');
});

testFramework.test('content scripts cannot choose another tab', () => {
    const origin = 'moz-extension://ferretwatch/';
    const pageSender = { url: 'https://evil.example/app', tab: { id: 7 } };
    const popupSender = { url: origin + 'popup/popup.html' };
    Assert.equal(contracts.authorizedTabId({ type: 'EXPORT_FINDINGS', tabId: 3 }, pageSender, origin), 7, 'page sender stays on its tab');
    Assert.equal(contracts.authorizedTabId({ type: 'EXPORT_FINDINGS', tabId: 3 }, { url: 'https://evil.example/' }, origin), null, 'page without a tab is refused');
    Assert.equal(contracts.authorizedTabId({ type: 'GET_FINDINGS', tabId: 3 }, popupSender, origin), 3, 'popup may name a tab');
    Assert.equal(contracts.authorizedTabId({ type: 'REPLAY_REQUEST', data: { sourceTabId: 9 } }, popupSender, origin), 9, 'explorer replay tab');
    Assert.false(contracts.isExtensionSender(pageSender, origin), 'web page is not the extension');
    Assert.true(contracts.isExtensionSender(popupSender, origin), 'popup is the extension');
});

testFramework.test('bridge messages are bounded and cannot carry unknown actions', () => {
    Assert.equal(contracts.validateBridgeMessage({ type: 'FERRETWATCH_API_CALL', data: { url: '/a' } }).ok, true, 'known call');
    Assert.equal(contracts.validateBridgeMessage({ type: 'RESCAN', data: {} }).ok, false, 'privileged action rejected');
    const huge = { type: 'FERRETWATCH_API_RESPONSE', data: { body: 'x'.repeat(contracts.CAPTURE_LIMITS.bridgeMessageBytes) } };
    Assert.equal(contracts.validateBridgeMessage(huge).ok, false, 'oversized rejected');
    Assert.equal(contracts.messageName({ action: 'RESCAN' }), 'RESCAN', 'action alias');
});

testFramework.test('concurrent requests keep their own headers', () => {
    const log = new contracts.RequestLog();
    log.observe({ requestId: 'a', tabId: 1, method: 'GET', url: 'https://example.com/api', headers: { a: '1' } });
    log.observe({ requestId: 'b', tabId: 2, method: 'GET', url: 'https://example.com/api', headers: { b: '2' } });
    log.complete({ requestId: 'a', status: 200, responseBody: 'one', duration: 5 });
    log.complete({ requestId: 'b', status: 201, responseBody: 'two', duration: 9 });
    const first = log.forTab(1)[0];
    const second = log.forTab(2)[0];
    Assert.equal(first.headers.a, '1', 'tab one headers');
    Assert.equal(second.status, 201, 'tab two status');
    Assert.equal(first.responseBody, 'one', 'tab one body');
    const relative = contracts.normalizeRequestUrl('/v1/items', 'https://example.com/app');
    Assert.equal(relative, 'https://example.com/v1/items', 'relative url');
    Assert.equal(contracts.groupEndpoints(log.forTab(1).concat(log.forTab(2))).size, 1, 'display group');
});

testFramework.test('bucket status is not inferred from a failed probe', async () => {
    Assert.equal(contracts.classifyBucketAccess({ accessible: false, error: 'No test URLs available', untested: true }), 'untested', 'untested');
    Assert.equal(contracts.classifyBucketAccess({ accessible: false, statusCode: 403 }), 'access_denied', 'denied');
    Assert.equal(contracts.classifyBucketAccess({ accessible: null, error: 'CORS' }), 'network_failure', 'cors');
    Assert.equal(contracts.classifyBucketAccess({ listingEnabled: true, accessible: true }), 'public_listing', 'listing');
    Assert.equal(contracts.classifyBucketAccess({ timeout: true }), 'timeout', 'timeout');
    Assert.equal(contracts.classifyBucketAccess({ validationFailed: true }), 'parse_failure', 'parse');

    installScannerSettings({ enabled: true, testPublicAccess: false });
    const scanner = new ProgressiveScanner();
    let probes = 0;
    scanner.bucketTester = { testBucketAccess() { probes += 1; return { accessible: true }; } };
    scanner._bucketInit = Promise.resolve();
    const input = [{
        value: 'bucket',
        type: 'AWS S3 Bucket',
        category: 'cloudStorage',
        provider: 'aws',
        riskLevel: 'low',
        fullUrl: 'https://example.s3.amazonaws.com/file'
    }];
    const kept = await scanner.scanCloudBuckets(input);
    Assert.equal(probes, 0, 'no probe when disabled');
    Assert.equal(kept[0].value, 'bucket', 'url retained');
    Assert.equal(kept[0].accessStatus, 'untested', 'not labeled secured');
});

testFramework.test('bucket enrichment waits for tester initialization and runs once', async () => {
    installScannerSettings({ enabled: true, testPublicAccess: true });
    const scanner = new ProgressiveScanner();
    let probes = 0;
    let release;
    scanner.bucketTester = null;
    scanner._bucketInit = new Promise((resolve) => { release = resolve; });
    const finding = {
        value: 'example-bucket',
        type: 'AWS S3 Bucket',
        category: 'cloudStorage',
        provider: 'aws',
        riskLevel: 'low'
    };
    global.BucketParser = {
        parseBucketUrl() {
            return { bucketName: 'example-bucket', provider: 'aws', testUrls: ['https://example-bucket.s3.amazonaws.com'] };
        }
    };
    const pending = scanner.scanCloudBuckets([finding]);
    Assert.equal(probes, 0, 'does not probe before init');
    scanner.bucketTester = {
        testBucketAccess() {
            probes += 1;
            return { accessible: true, listingEnabled: true, statusCode: 200 };
        }
    };
    release();
    const enriched = await pending;
    Assert.equal(probes, 1, 'one probe after init');
    Assert.equal(enriched[0].accessStatus, 'public_listing', 'listing classification');
    delete global.BucketParser;
});

testFramework.test('one page alert lists every finding from the README, including repeated sources', async () => {
    const vm = require('vm');
    const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
    const html = `<html><body><article>${readme}</article><script type="application/json">${JSON.stringify({ readme })}</script></body></html>`;
    const scanner = new ProgressiveScanner();
    const found = await scanner.progressiveScan(html, patterns.patternManager.getAllPatterns(), {
        sourceUrl: 'https://github.com/cybercyberlabs/ferretwatch'
    });
    Assert.equal(found.length, 2, 'trailing script escapes do not create a second mongo finding');
    Assert.ok(found.some((finding) => finding.value === 'mongodb://username:password@cluster.mongodb.net/myapp'), 'mongo value is trimmed');
    Assert.ok(found.some((finding) => finding.value === 'AKIAIOSFODNN7EXAMPLE'), 'aws key kept');
    Assert.false(found.some((finding) => /\\n/.test(finding.value)), 'no escaped newline remains in a value');

    const elements = [];
    function makeElement(tag) {
        const node = {
            tagName: tag, id: '', className: '', style: {}, children: [], parentNode: null, listeners: {},
            appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
            replaceChildren() { this.children.forEach((child) => { child.parentNode = null; }); this.children = []; },
            addEventListener(type, fn) { this.listeners[type] = fn; },
            remove() {
                if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
                this.parentNode = null;
            },
            set textContent(value) { this._text = String(value); },
            get textContent() { return this._text || ''; }
        };
        elements.push(node);
        return node;
    }
    const document = {
        body: makeElement('body'),
        head: makeElement('head'),
        createElement: makeElement,
        getElementById(id) { return elements.find((node) => node.id === id) || null; },
        querySelector(selector) {
            return elements.find((node) => selector === '.cyber-labs-credential-notification' &&
                String(node.className).includes('cyber-labs-credential-notification')) || null;
        },
        querySelectorAll(selector) {
            return elements.filter((node) => selector === '.cyber-labs-credential-notification' &&
                String(node.className).includes('cyber-labs-credential-notification'));
        }
    };
    const sandbox = { window: {}, document, setTimeout, clearTimeout, console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../content/notification-ui.js'), 'utf8'), sandbox, { filename: 'notification-ui.js' });
    const notes = sandbox.FerretWatchNotifications;
    notes.showRegularNotification([found[0]], [found[0]]);
    notes.showRegularNotification(found, [found[1]]);
    const popups = document.querySelectorAll('.cyber-labs-credential-notification');
    Assert.equal(popups.length, 1, 'second alert updates the same popup');
    const texts = [];
    (function walk(node) {
        if (node.textContent) texts.push(node.textContent);
        node.children.forEach(walk);
    })(popups[0]);
    Assert.ok(texts.some((text) => text.includes('2 issues found')), 'title counts every finding');
    Assert.equal(texts.filter((text) => text === 'MongoDB Connection String' || text === 'AWS Access Key ID').length, 2, 'both distinct findings stay listed');
    Assert.ok(texts.some((text) => text.includes('mongodb://username:password@cluster.mongodb.net/myapp')), 'alert shows the full match');
    popups[0].listeners.click();
    Assert.true(notes.isNotificationDismissed(), 'click dismisses the alert for this document');
    popups[0].remove();
    notes.showRegularNotification(found, found);
    const visible = document.querySelectorAll('.cyber-labs-credential-notification').filter((node) => node.parentNode);
    Assert.equal(visible.length, 0, 'dismissed alert does not return');
});

testFramework.test('page monitoring source does not wrap fetch for normal operation', () => {
    const index = fs.readFileSync(path.join(__dirname, '../../content/index.js'), 'utf8');
    Assert.match(index, /pageInterceptor !== true/, 'page wrapper is diagnostic only');
    Assert.match(index, /name === 'RESCAN'/, 'popup action is handled');
    const background = fs.readFileSync(path.join(__dirname, '../../background.js'), 'utf8');
    const monitor = fs.readFileSync(path.join(__dirname, '../../utils/response-monitor.js'), 'utf8');
    Assert.match(monitor, /filterResponseData/, 'firefox response filter');
    Assert.match(monitor, /filter\.write\(event\.data\)/, 'bytes forwarded before scan');
    Assert.false(background.includes('content.js'), 'removed content.js reinjection');
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework };
}
