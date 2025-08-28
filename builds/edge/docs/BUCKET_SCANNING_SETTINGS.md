# Bucket Scanning Settings

This document describes the bucket scanning configuration options available in the FerretWatch extension.

## Overview

The bucket scanning feature can be configured through the extension's settings system. Settings are stored in browser local storage and can be modified programmatically or through the extension UI.

## Settings Structure

```javascript
{
  cloudBucketScanning: {
    enabled: true,                    // Enable/disable bucket scanning
    providers: {                      // Provider-specific toggles
      aws: true,                      // Amazon S3
      gcp: true,                      // Google Cloud Storage
      azure: true,                    // Azure Blob Storage
      digitalocean: true,             // DigitalOcean Spaces
      alibaba: true                   // Alibaba Cloud OSS
    },
    testTimeout: 5000,                // Timeout for bucket tests (1000-30000ms)
    maxConcurrentTests: 3,            // Max concurrent tests (1-10)
    testPublicAccess: true            // Enable public access testing
  }
}
```

## Default Values

- **enabled**: `true` - Bucket scanning is enabled by default
- **providers**: All providers are enabled by default
- **testTimeout**: `5000` ms (5 seconds)
- **maxConcurrentTests**: `3` concurrent tests
- **testPublicAccess**: `true` - Public access testing is enabled

## Configuration Methods

### Using BucketScanningSettings Class

```javascript
// Create settings instance
const settings = new BucketScanningSettings();

// Get current settings
const currentSettings = await settings.getBucketScanningSettings();

// Update settings
await settings.updateBucketScanningSettings({
  enabled: false,
  testTimeout: 10000
});

// Check if scanning is enabled
const isEnabled = await settings.isBucketScanningEnabled();

// Check if specific provider is enabled
const awsEnabled = await settings.isProviderEnabled('aws');
```

### Using StorageUtils (Content Script)

```javascript
// Get bucket scanning settings
const bucketSettings = window.StorageUtils.getBucketScanningSettings();

// Check if bucket scanning is enabled
const isEnabled = window.StorageUtils.isBucketScanningEnabled();

// Check if provider is enabled
const awsEnabled = window.StorageUtils.isProviderEnabled('aws');
```

## Validation Rules

Settings are automatically validated when updated:

### enabled
- Must be boolean
- Defaults to `true` if invalid

### providers
- Must be object with boolean values
- Supported providers: `aws`, `gcp`, `azure`, `digitalocean`, `alibaba`
- Invalid providers default to `true`

### testTimeout
- Must be number between 1000 and 30000 (1-30 seconds)
- Defaults to `5000` if invalid

### maxConcurrentTests
- Must be number between 1 and 10
- Defaults to `3` if invalid

### testPublicAccess
- Must be boolean
- Defaults to `true` if invalid

## Provider Information

| Provider Key | Display Name | Description |
|--------------|--------------|-------------|
| `aws` | Amazon S3 | Amazon Simple Storage Service |
| `gcp` | Google Cloud Storage | Google Cloud Platform storage |
| `azure` | Azure Blob Storage | Microsoft Azure blob storage |
| `digitalocean` | DigitalOcean Spaces | DigitalOcean object storage |
| `alibaba` | Alibaba Cloud OSS | Alibaba Cloud Object Storage Service |

## Usage Examples

### Disable Bucket Scanning

```javascript
const settings = new BucketScanningSettings();
await settings.updateBucketScanningSettings({ enabled: false });
```

### Enable Only AWS and Azure

```javascript
const settings = new BucketScanningSettings();
await settings.updateBucketScanningSettings({
  providers: {
    aws: true,
    gcp: false,
    azure: true,
    digitalocean: false,
    alibaba: false
  }
});
```

### Increase Timeout and Concurrency

```javascript
const settings = new BucketScanningSettings();
await settings.updateBucketScanningSettings({
  testTimeout: 15000,        // 15 seconds
  maxConcurrentTests: 5      // 5 concurrent tests
});
```

### Reset to Defaults

```javascript
const settings = new BucketScanningSettings();
await settings.resetToDefaults();
```

## Integration with Scanner

The scanner automatically respects these settings:

- Only scans for enabled providers
- Uses configured timeout values
- Respects concurrency limits
- Skips testing if bucket scanning is disabled

## Error Handling

- Invalid settings are automatically corrected to safe defaults
- Storage errors fall back to default settings
- Network errors during settings updates are logged but don't crash the extension

## Performance Considerations

- Lower `testTimeout` values improve responsiveness but may miss slow responses
- Higher `maxConcurrentTests` values speed up scanning but may overwhelm target services
- Disabling unused providers reduces unnecessary network requests