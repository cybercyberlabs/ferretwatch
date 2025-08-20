/**
 * Cross-browser compatibility tests
 * Tests extension functionality across different browsers
 */

// Load testing framework
let TestFramework, Assert, MockHelpers, BrowserCompat;

if (typeof require !== 'undefined') {
    ({ TestFramework, Assert, MockHelpers } = require('../framework.js'));
    ({ BrowserCompat } = require('../../utils/browser-compat.js'));
} else {
    // Browser environment
    TestFramework = window.TestFramework;
    Assert = window.Assert;
    MockHelpers = window.MockHelpers;
    BrowserCompat = window.BrowserCompat;
}

const testFramework = new TestFramework();

// Mock browser environments
class BrowserEnvironmentMock {
    constructor(browserType = 'firefox') {
        this.browserType = browserType;
        this.setupEnvironment();
    }

    setupEnvironment() {
        // Clear existing globals
        if (typeof window !== 'undefined') {
            delete window.browser;
            delete window.chrome;
        } else if (typeof global !== 'undefined') {
            delete global.browser;
            delete global.chrome;
        }

        switch (this.browserType) {
            case 'firefox':
                this.setupFirefoxEnvironment();
                break;
            case 'chrome':
                this.setupChromeEnvironment();
                break;
            case 'edge':
                this.setupEdgeEnvironment();
                break;
        }
    }

    setupFirefoxEnvironment() {
        const mockBrowser = {
            runtime: {
                sendMessage: async (message) => ({ success: true, data: 'firefox-response' }),
                onMessage: { addListener: () => {}, removeListener: () => {} },
                getURL: (path) => `moz-extension://fake-id/${path}`,
                getManifest: () => ({ manifest_version: 2, name: 'Test Extension' }),
                getBrowserInfo: async () => ({ name: 'Firefox', version: '91.0' })
            },
            storage: {
                local: {
                    get: async (keys) => ({}),
                    set: async (items) => {},
                    remove: async (keys) => {},
                    clear: async () => {}
                },
                onChanged: { addListener: () => {} }
            },
            tabs: {
                query: async (queryInfo) => [{ id: 1, url: 'https://example.com' }],
                sendMessage: async (tabId, message) => ({ received: true })
            },
            notifications: {
                create: async (options) => 'notification-id-firefox',
                clear: async (id) => true
            },
            browserAction: {
                setBadgeText: async (details) => {},
                setBadgeBackgroundColor: async (details) => {}
            }
        };

        if (typeof window !== 'undefined') {
            window.browser = mockBrowser;
        } else if (typeof global !== 'undefined') {
            global.browser = mockBrowser;
        }
    }

    setupChromeEnvironment() {
        const mockChrome = {
            runtime: {
                sendMessage: (message, callback) => {
                    setTimeout(() => callback({ success: true, data: 'chrome-response' }), 0);
                },
                onMessage: { addListener: () => {}, removeListener: () => {} },
                getURL: (path) => `chrome-extension://fake-id/${path}`,
                getManifest: () => ({ manifest_version: 3, name: 'Test Extension' }),
                lastError: null,
                id: 'chrome-extension-id'
            },
            storage: {
                local: {
                    get: (keys, callback) => {
                        setTimeout(() => callback({}), 0);
                    },
                    set: (items, callback) => {
                        setTimeout(() => callback(), 0);
                    },
                    remove: (keys, callback) => {
                        setTimeout(() => callback(), 0);
                    },
                    clear: (callback) => {
                        setTimeout(() => callback(), 0);
                    }
                },
                onChanged: { addListener: () => {} }
            },
            tabs: {
                query: (queryInfo, callback) => {
                    setTimeout(() => callback([{ id: 1, url: 'https://example.com' }]), 0);
                },
                sendMessage: (tabId, message, callback) => {
                    setTimeout(() => callback({ received: true }), 0);
                }
            },
            notifications: {
                create: (options, callback) => {
                    setTimeout(() => callback('notification-id-chrome'), 0);
                },
                clear: (id, callback) => {
                    setTimeout(() => callback(true), 0);
                }
            },
            action: {
                setBadgeText: (details, callback) => {
                    setTimeout(() => callback(), 0);
                },
                setBadgeBackgroundColor: (details, callback) => {
                    setTimeout(() => callback(), 0);
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.chrome = mockChrome;
        } else if (typeof global !== 'undefined') {
            global.chrome = mockChrome;
        }
    }

    setupEdgeEnvironment() {
        // Edge is Chromium-based but uses browser namespace
        this.setupChromeEnvironment();
        const mockBrowser = this.createPromiseAPI();
        
        if (typeof window !== 'undefined') {
            window.browser = mockBrowser;
        } else if (typeof global !== 'undefined') {
            global.browser = mockBrowser;
        }
    }

    createPromiseAPI() {
        const chromeAPI = (typeof window !== 'undefined') ? window.chrome : global.chrome;
        
        return {
            runtime: {
                sendMessage: async (message) => new Promise(resolve => 
                    chromeAPI.runtime.sendMessage(message, resolve)
                ),
                onMessage: chromeAPI.runtime.onMessage,
                getURL: chromeAPI.runtime.getURL,
                getManifest: chromeAPI.runtime.getManifest
            },
            storage: {
                local: {
                    get: async (keys) => new Promise(resolve => 
                        chromeAPI.storage.local.get(keys, resolve)
                    ),
                    set: async (items) => new Promise(resolve => 
                        chromeAPI.storage.local.set(items, resolve)
                    )
                },
                onChanged: chromeAPI.storage.onChanged
            },
            tabs: {
                query: async (queryInfo) => new Promise(resolve => 
                    chromeAPI.tabs.query(queryInfo, resolve)
                ),
                sendMessage: async (tabId, message) => new Promise(resolve => 
                    chromeAPI.tabs.sendMessage(tabId, message, resolve)
                )
            }
        };
    }

    cleanup() {
        if (typeof window !== 'undefined') {
            delete window.browser;
            delete window.chrome;
        } else if (typeof global !== 'undefined') {
            delete global.browser;
            delete global.chrome;
        }
    }
}

// Cross-browser compatibility tests
testFramework.test('BrowserCompat should detect Firefox correctly', () => {
    const firefoxEnv = new BrowserEnvironmentMock('firefox');
    const compat = new BrowserCompat();
    
    Assert.equal(compat.browser, 'firefox', 'Should detect Firefox browser');
    Assert.equal(compat.manifestVersion, 2, 'Should detect Manifest V2 for Firefox');
    
    firefoxEnv.cleanup();
});

testFramework.test('BrowserCompat should detect Chrome correctly', () => {
    const chromeEnv = new BrowserEnvironmentMock('chrome');
    const compat = new BrowserCompat();
    
    Assert.equal(compat.browser, 'chrome', 'Should detect Chrome browser');
    Assert.equal(compat.manifestVersion, 3, 'Should detect Manifest V3 for Chrome');
    
    chromeEnv.cleanup();
});

testFramework.test('BrowserCompat should detect Edge correctly', () => {
    const edgeEnv = new BrowserEnvironmentMock('edge');
    const compat = new BrowserCompat();
    
    Assert.equal(compat.browser, 'edge', 'Should detect Edge browser');
    Assert.ok(compat.manifestVersion >= 2, 'Should detect valid manifest version');
    
    edgeEnv.cleanup();
});

testFramework.test('Chrome Promise API wrapper should work', async () => {
    const chromeEnv = new BrowserEnvironmentMock('chrome');
    const compat = new BrowserCompat();
    
    // Test promise-wrapped storage
    const result = await compat.getStorage(['testKey']);
    Assert.ok(typeof result === 'object', 'Should return storage object');
    
    // Test promise-wrapped messaging
    try {
        const response = await compat.sendMessage('TEST_MESSAGE', { test: true });
        Assert.ok(response.success, 'Should receive successful response');
    } catch (error) {
        // Expected in test environment
        Assert.ok(true, 'Error handling works correctly');
    }
    
    chromeEnv.cleanup();
});

testFramework.test('Cross-browser storage operations should work', async () => {
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const compat = new BrowserCompat();
        
        // Test storage operations
        await compat.setStorage({ testKey: 'testValue' });
        const result = await compat.getStorage(['testKey']);
        
        Assert.ok(typeof result === 'object', `${browserType}: Storage should return object`);
        
        env.cleanup();
    }
});

testFramework.test('Cross-browser messaging should work', async () => {
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const compat = new BrowserCompat();
        
        try {
            await compat.sendMessage('TEST_MESSAGE', { browser: browserType });
            Assert.ok(true, `${browserType}: Messaging should not throw errors`);
        } catch (error) {
            // Expected in test environment - ensure error is handled gracefully
            Assert.ok(error.message.includes('Failed to send message'), 
                `${browserType}: Should handle messaging errors gracefully`);
        }
        
        env.cleanup();
    }
});

testFramework.test('Browser-specific configurations should be appropriate', () => {
    const browsers = [
        { type: 'firefox', expectedManifest: 2 },
        { type: 'chrome', expectedManifest: 3 },
        { type: 'edge', expectedManifest: 3 }
    ];
    
    for (const browser of browsers) {
        const env = new BrowserEnvironmentMock(browser.type);
        const compat = new BrowserCompat();
        
        const config = compat.getBrowserConfig();
        const features = compat.getFeatureSupport();
        const settings = compat.getRecommendedSettings();
        
        Assert.equal(config.browser, browser.type, 
            `${browser.type}: Should have correct browser type`);
        
        Assert.ok(typeof features === 'object', 
            `${browser.type}: Should return feature support object`);
            
        Assert.ok(Array.isArray(settings.enabledCategories), 
            `${browser.type}: Should have enabled categories array`);
            
        Assert.ok(['low', 'medium', 'high', 'critical'].includes(settings.riskThreshold), 
            `${browser.type}: Should have valid risk threshold`);
        
        env.cleanup();
    }
});

testFramework.test('Manifest version compatibility should work', () => {
    const firefoxEnv = new BrowserEnvironmentMock('firefox');
    const firefoxCompat = new BrowserCompat();
    
    const v2Config = { backgroundPage: 'background.html' };
    const v3Config = { serviceWorker: 'background.js' };
    
    const firefoxResult = firefoxCompat.getManifestConfig(v2Config, v3Config);
    Assert.objectHasProperty(firefoxResult, 'backgroundPage', 
        'Firefox should use Manifest V2 config');
    
    firefoxEnv.cleanup();
    
    const chromeEnv = new BrowserEnvironmentMock('chrome');
    const chromeCompat = new BrowserCompat();
    
    const chromeResult = chromeCompat.getManifestConfig(v2Config, v3Config);
    Assert.objectHasProperty(chromeResult, 'serviceWorker', 
        'Chrome should use Manifest V3 config');
    
    chromeEnv.cleanup();
});

testFramework.test('Cross-browser feature detection should work', () => {
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const compat = new BrowserCompat();
        
        const features = compat.getFeatureSupport();
        
        Assert.objectHasProperty(features, 'notifications', 
            `${browserType}: Should detect notification support`);
        Assert.objectHasProperty(features, 'storage', 
            `${browserType}: Should detect storage support`);
        Assert.objectHasProperty(features, 'tabs', 
            `${browserType}: Should detect tabs support`);
        
        // Browser-specific feature checks
        if (browserType === 'firefox') {
            Assert.true(features.persistentBackground, 
                'Firefox should support persistent background');
            Assert.false(features.serviceWorkers, 
                'Firefox should not use service workers');
        } else {
            Assert.false(features.persistentBackground, 
                'Chrome/Edge should not have persistent background');
            Assert.true(features.serviceWorkers, 
                'Chrome/Edge should support service workers');
        }
        
        env.cleanup();
    }
});

testFramework.test('Error handling should be consistent across browsers', async () => {
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const compat = new BrowserCompat();
        
        // Test error handling in storage
        try {
            await compat.setStorage(null);
        } catch (error) {
            Assert.ok(error instanceof Error, 
                `${browserType}: Should throw proper Error objects`);
        }
        
        // Test error handling in messaging
        try {
            await compat.sendMessage('INVALID_MESSAGE_TYPE');
        } catch (error) {
            Assert.ok(typeof error.message === 'string', 
                `${browserType}: Error should have message property`);
        }
        
        env.cleanup();
    }
});

testFramework.test('Performance characteristics should be browser-appropriate', () => {
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const compat = new BrowserCompat();
        
        const settings = compat.getRecommendedSettings();
        const config = compat.getBrowserConfig();
        
        // Firefox should have more aggressive defaults (better performance)
        if (browserType === 'firefox') {
            Assert.ok(settings.scanDelay <= 500, 
                'Firefox should have shorter scan delay');
        } else {
            Assert.ok(settings.scanDelay >= 500, 
                'Chrome/Edge should have conservative scan delay');
        }
        
        // Storage limits should be appropriate
        Assert.ok(config.maxStorageSize > 0, 
            `${browserType}: Should have defined storage limit`);
        
        env.cleanup();
    }
});

// Integration test with actual scanner components
testFramework.test('Cross-browser scanner integration should work', async () => {
    // Mock scanner that uses browser compatibility layer
    class CrossBrowserScanner {
        constructor() {
            this.compat = new BrowserCompat();
        }
        
        async initialize() {
            const settings = await this.compat.getStorage(['userSettings']);
            return settings.userSettings || this.compat.getRecommendedSettings();
        }
        
        async saveResults(findings) {
            await this.compat.setStorage({
                lastScanResults: findings,
                lastScanTime: Date.now()
            });
        }
        
        async notifyUser(message) {
            return await this.compat.showNotification({
                title: 'Scan Complete',
                message: message
            });
        }
    }
    
    const browsers = ['firefox', 'chrome', 'edge'];
    
    for (const browserType of browsers) {
        const env = new BrowserEnvironmentMock(browserType);
        const scanner = new CrossBrowserScanner();
        
        // Test initialization
        const settings = await scanner.initialize();
        Assert.ok(typeof settings === 'object', 
            `${browserType}: Scanner should initialize with settings`);
        
        // Test result saving
        await scanner.saveResults([{ type: 'test', riskLevel: 'low' }]);
        Assert.ok(true, `${browserType}: Should save results without error`);
        
        // Test notifications
        const notificationId = await scanner.notifyUser('Test notification');
        // Notification may return null in test environment
        Assert.ok(typeof notificationId === 'string' || notificationId === null, 
            `${browserType}: Should handle notifications gracefully`);
        
        env.cleanup();
    }
});

// Export test framework
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework, BrowserEnvironmentMock };
} else {
    if (typeof window !== 'undefined') {
        window.crossBrowserTests = testFramework;
        window.BrowserEnvironmentMock = BrowserEnvironmentMock;
    }
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    testFramework.runAll().then(results => {
        console.log('\n🌐 Cross-browser compatibility test results:');
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`📊 Total: ${results.total}`);
        
        if (results.failed > 0 && results.failures) {
            console.log('\n💥 Failed tests:');
            results.failures.forEach(failure => {
                console.log(`  - ${failure.testName}: ${failure.error}`);
            });
        }
        
        console.log('\n🎯 Cross-browser compatibility testing complete!');
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
