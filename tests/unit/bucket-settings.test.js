/**
 * Unit tests for bucket scanning settings functionality
 */

// Mock browser storage API
const mockStorage = {
    local: {
        data: {},
        get: function(keys) {
            return Promise.resolve(
                keys.reduce((result, key) => {
                    if (this.data[key] !== undefined) {
                        result[key] = this.data[key];
                    }
                    return result;
                }, {})
            );
        },
        set: function(items) {
            Object.assign(this.data, items);
            return Promise.resolve();
        },
        clear: function() {
            this.data = {};
            return Promise.resolve();
        }
    }
};

// Mock browser runtime API
const mockRuntime = {
    sendMessage: function(message) {
        return Promise.resolve();
    }
};

// Set up global mocks
global.browser = {
    storage: mockStorage,
    runtime: mockRuntime
};

// Import the settings class
const BucketScanningSettings = require('../../utils/settings.js');

describe('BucketScanningSettings', () => {
    let settings;

    beforeEach(() => {
        mockStorage.local.clear();
        settings = new BucketScanningSettings();
    });

    describe('Default Settings', () => {
        test('should have correct default settings', () => {
            const defaults = settings.defaultSettings;
            
            expect(defaults.enabled).toBe(true);
            expect(defaults.providers.aws).toBe(true);
            expect(defaults.providers.gcp).toBe(true);
            expect(defaults.providers.azure).toBe(true);
            expect(defaults.providers.digitalocean).toBe(true);
            expect(defaults.providers.alibaba).toBe(true);
            expect(defaults.testTimeout).toBe(5000);
            expect(defaults.maxConcurrentTests).toBe(3);
            expect(defaults.testPublicAccess).toBe(true);
        });
    });

    describe('getBucketScanningSettings', () => {
        test('should return default settings when no user settings exist', async () => {
            const result = await settings.getBucketScanningSettings();
            
            expect(result).toEqual(settings.defaultSettings);
        });

        test('should return user settings when they exist', async () => {
            const userSettings = {
                cloudBucketScanning: {
                    enabled: false,
                    providers: { aws: false, gcp: true },
                    testTimeout: 10000
                }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const result = await settings.getBucketScanningSettings();
            
            expect(result.enabled).toBe(false);
            expect(result.providers.aws).toBe(false);
            expect(result.providers.gcp).toBe(true);
            expect(result.testTimeout).toBe(10000);
        });

        test('should validate and fix invalid settings', async () => {
            const userSettings = {
                cloudBucketScanning: {
                    enabled: 'invalid',
                    testTimeout: -1000,
                    maxConcurrentTests: 50
                }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const result = await settings.getBucketScanningSettings();
            
            expect(result.enabled).toBe(true);
            expect(result.testTimeout).toBe(5000);
            expect(result.maxConcurrentTests).toBe(3);
        });
    });

    describe('updateBucketScanningSettings', () => {
        test('should update settings in storage', async () => {
            const newSettings = {
                enabled: false,
                testTimeout: 8000
            };
            
            await settings.updateBucketScanningSettings(newSettings);
            
            const stored = await mockStorage.local.get(['userSettings']);
            expect(stored.userSettings.cloudBucketScanning.enabled).toBe(false);
            expect(stored.userSettings.cloudBucketScanning.testTimeout).toBe(8000);
        });

        test('should merge with existing settings', async () => {
            const existingSettings = {
                cloudBucketScanning: {
                    enabled: true,
                    providers: { aws: false }
                }
            };
            
            await mockStorage.local.set({ userSettings: existingSettings });
            
            const newSettings = {
                testTimeout: 7000
            };
            
            await settings.updateBucketScanningSettings(newSettings);
            
            const stored = await mockStorage.local.get(['userSettings']);
            const bucketSettings = stored.userSettings.cloudBucketScanning;
            
            expect(bucketSettings.enabled).toBe(true);
            expect(bucketSettings.providers.aws).toBe(false);
            expect(bucketSettings.testTimeout).toBe(7000);
        });
    });

    describe('isBucketScanningEnabled', () => {
        test('should return true by default', async () => {
            const result = await settings.isBucketScanningEnabled();
            expect(result).toBe(true);
        });

        test('should return false when disabled', async () => {
            const userSettings = {
                cloudBucketScanning: { enabled: false }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const result = await settings.isBucketScanningEnabled();
            expect(result).toBe(false);
        });
    });

    describe('isProviderEnabled', () => {
        test('should return true for enabled providers by default', async () => {
            const awsEnabled = await settings.isProviderEnabled('aws');
            const gcpEnabled = await settings.isProviderEnabled('gcp');
            
            expect(awsEnabled).toBe(true);
            expect(gcpEnabled).toBe(true);
        });

        test('should return false for disabled providers', async () => {
            const userSettings = {
                cloudBucketScanning: {
                    providers: { aws: false, gcp: true }
                }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const awsEnabled = await settings.isProviderEnabled('aws');
            const gcpEnabled = await settings.isProviderEnabled('gcp');
            
            expect(awsEnabled).toBe(false);
            expect(gcpEnabled).toBe(true);
        });
    });

    describe('getTestTimeout', () => {
        test('should return default timeout', async () => {
            const timeout = await settings.getTestTimeout();
            expect(timeout).toBe(5000);
        });

        test('should return custom timeout', async () => {
            const userSettings = {
                cloudBucketScanning: { testTimeout: 15000 }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const timeout = await settings.getTestTimeout();
            expect(timeout).toBe(15000);
        });
    });

    describe('getMaxConcurrentTests', () => {
        test('should return default max concurrent tests', async () => {
            const maxTests = await settings.getMaxConcurrentTests();
            expect(maxTests).toBe(3);
        });

        test('should return custom max concurrent tests', async () => {
            const userSettings = {
                cloudBucketScanning: { maxConcurrentTests: 5 }
            };
            
            await mockStorage.local.set({ userSettings });
            
            const maxTests = await settings.getMaxConcurrentTests();
            expect(maxTests).toBe(5);
        });
    });

    describe('validateSettings', () => {
        test('should fix invalid enabled value', () => {
            const invalid = { enabled: 'yes' };
            const validated = settings.validateSettings(invalid);
            
            expect(validated.enabled).toBe(true);
        });

        test('should fix invalid timeout values', () => {
            const invalid = { testTimeout: 500 }; // Too low
            const validated = settings.validateSettings(invalid);
            
            expect(validated.testTimeout).toBe(5000);
            
            const tooHigh = { testTimeout: 50000 }; // Too high
            const validatedHigh = settings.validateSettings(tooHigh);
            
            expect(validatedHigh.testTimeout).toBe(5000);
        });

        test('should fix invalid maxConcurrentTests values', () => {
            const invalid = { maxConcurrentTests: 0 }; // Too low
            const validated = settings.validateSettings(invalid);
            
            expect(validated.maxConcurrentTests).toBe(3);
            
            const tooHigh = { maxConcurrentTests: 20 }; // Too high
            const validatedHigh = settings.validateSettings(tooHigh);
            
            expect(validatedHigh.maxConcurrentTests).toBe(3);
        });

        test('should fix invalid provider values', () => {
            const invalid = {
                providers: {
                    aws: 'yes',
                    gcp: 1,
                    azure: null
                }
            };
            
            const validated = settings.validateSettings(invalid);
            
            expect(validated.providers.aws).toBe(true);
            expect(validated.providers.gcp).toBe(true);
            expect(validated.providers.azure).toBe(true);
        });

        test('should create providers object if missing', () => {
            const invalid = { providers: null };
            const validated = settings.validateSettings(invalid);
            
            expect(validated.providers).toEqual(settings.defaultSettings.providers);
        });
    });

    describe('resetToDefaults', () => {
        test('should reset settings to defaults', async () => {
            // Set some custom settings first
            const customSettings = {
                enabled: false,
                testTimeout: 10000
            };
            
            await settings.updateBucketScanningSettings(customSettings);
            
            // Reset to defaults
            await settings.resetToDefaults();
            
            const result = await settings.getBucketScanningSettings();
            expect(result).toEqual(settings.defaultSettings);
        });
    });

    describe('getAvailableProviders', () => {
        test('should return all available providers', () => {
            const providers = settings.getAvailableProviders();
            
            expect(providers).toEqual(['aws', 'gcp', 'azure', 'digitalocean', 'alibaba']);
        });
    });

    describe('getProviderDisplayNames', () => {
        test('should return provider display names', () => {
            const displayNames = settings.getProviderDisplayNames();
            
            expect(displayNames.aws).toBe('Amazon S3');
            expect(displayNames.gcp).toBe('Google Cloud Storage');
            expect(displayNames.azure).toBe('Azure Blob Storage');
            expect(displayNames.digitalocean).toBe('DigitalOcean Spaces');
            expect(displayNames.alibaba).toBe('Alibaba Cloud OSS');
        });
    });
});