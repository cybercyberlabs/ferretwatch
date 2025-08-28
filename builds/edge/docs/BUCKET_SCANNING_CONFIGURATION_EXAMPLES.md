# Cloud Bucket Scanning Configuration Examples

This document provides practical configuration examples for different bucket scanning scenarios and use cases.

## Table of Contents

1. [Basic Configuration](#basic-configuration)
2. [Security Audit Scenarios](#security-audit-scenarios)
3. [Performance Optimization](#performance-optimization)
4. [Provider-Specific Configurations](#provider-specific-configurations)
5. [Network Environment Configurations](#network-environment-configurations)
6. [Development and Testing](#development-and-testing)
7. [Enterprise Environments](#enterprise-environments)

## Basic Configuration

### Default Settings (Recommended for Most Users)

```javascript
{
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
  }
}
```

**Use case:** General security awareness while browsing
**Performance:** Balanced speed and thoroughness
**Network impact:** Moderate

### Minimal Configuration (Privacy-Focused)

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: false,
      azure: false,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 3000,
    maxConcurrentTests: 1,
    testPublicAccess: false  // Only detect URLs, don't test accessibility
  }
}
```

**Use case:** Privacy-conscious users who want detection without network requests
**Performance:** Minimal impact
**Network impact:** None (detection only)

## Security Audit Scenarios

### Comprehensive Security Audit

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 15000,      // Longer timeout for thorough testing
    maxConcurrentTests: 5,   // Higher concurrency for faster audits
    testPublicAccess: true
  }
}
```

**Use case:** Professional security assessments and penetration testing
**Performance:** Higher resource usage
**Network impact:** High (thorough testing)

**Additional recommendations:**
- Use on dedicated testing browser profile
- Monitor network usage during audits
- Document findings for compliance reporting

### AWS-Focused Security Assessment

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: false,
      azure: false,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 10000,
    maxConcurrentTests: 3,
    testPublicAccess: true
  }
}
```

**Use case:** Organizations primarily using AWS infrastructure
**Performance:** Focused and efficient
**Network impact:** Moderate (AWS-only)

### Multi-Cloud Environment Audit

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: false,    // Skip if not used
      alibaba: false          // Skip if not used
    },
    testTimeout: 8000,
    maxConcurrentTests: 4,
    testPublicAccess: true
  }
}
```

**Use case:** Organizations using multiple major cloud providers
**Performance:** Balanced for multi-cloud
**Network impact:** High (multiple providers)

## Performance Optimization

### Low-Resource Configuration

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: false,           // Reduce provider count
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 3000,        // Shorter timeout
    maxConcurrentTests: 1,    // Sequential testing
    testPublicAccess: true
  }
}
```

**Use case:** Older devices, limited bandwidth, or resource-constrained environments
**Performance:** Minimal impact
**Network impact:** Low

### High-Performance Configuration

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 2000,        // Aggressive timeout
    maxConcurrentTests: 8,    // High concurrency
    testPublicAccess: true
  }
}
```

**Use case:** High-end systems with fast internet connections
**Performance:** High resource usage
**Network impact:** Very high

**Warnings:**
- May overwhelm target services
- Could trigger rate limiting
- Monitor for stability issues

### Bandwidth-Conscious Configuration

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 8000,        // Longer timeout, fewer retries
    maxConcurrentTests: 2,    // Moderate concurrency
    testPublicAccess: true
  }
}
```

**Use case:** Limited bandwidth or metered connections
**Performance:** Moderate
**Network impact:** Controlled

## Provider-Specific Configurations

### AWS S3 Only

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: false,
      azure: false,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 5000,
    maxConcurrentTests: 3,
    testPublicAccess: true
  }
}
```

**Detected patterns:**
- `s3://bucket-name`
- `https://bucket-name.s3.amazonaws.com`
- `https://s3.amazonaws.com/bucket-name`
- `https://bucket-name.s3.region.amazonaws.com`

### Google Cloud Storage Only

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: false,
      gcp: true,
      azure: false,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 6000,        // GCS can be slower
    maxConcurrentTests: 2,
    testPublicAccess: true
  }
}
```

**Detected patterns:**
- `gs://bucket-name`
- `https://storage.googleapis.com/bucket-name`
- `https://storage.cloud.google.com/bucket-name`

### Microsoft Azure Only

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: false,
      gcp: false,
      azure: true,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 7000,        // Azure can have variable response times
    maxConcurrentTests: 2,
    testPublicAccess: true
  }
}
```

**Detected patterns:**
- `https://account.blob.core.windows.net/container`
- `https://account.blob.core.windows.net/container/blob`

## Network Environment Configurations

### Corporate Network (Behind Firewall)

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: false,    // May be blocked
      alibaba: false          // May be blocked
    },
    testTimeout: 15000,       // Longer timeout for proxy delays
    maxConcurrentTests: 1,    // Conservative for corporate networks
    testPublicAccess: true
  }
}
```

**Considerations:**
- Corporate firewalls may block external requests
- Proxy servers can add significant latency
- Some cloud providers may be blocked by policy

### VPN Environment

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 12000,       // Account for VPN latency
    maxConcurrentTests: 2,    // Moderate concurrency
    testPublicAccess: true
  }
}
```

**Considerations:**
- VPN can add 1-3 seconds of latency
- Some VPN servers may have geographic restrictions
- Exit node location affects response times

### Mobile/Cellular Network

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: false,           // Reduce for data usage
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 10000,       // Account for variable mobile latency
    maxConcurrentTests: 1,    // Minimize data usage
    testPublicAccess: true
  }
}
```

**Considerations:**
- Higher latency and variable connection quality
- Data usage concerns
- Battery impact from network requests

## Development and Testing

### Development Environment

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 2000,        // Fast feedback during development
    maxConcurrentTests: 1,    // Easier debugging
    testPublicAccess: true
  }
}
```

**Use case:** Extension development and testing
**Benefits:** Quick feedback, easier to debug issues

### Testing with Mock Data

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: false,
      azure: false,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 1000,        // Very short for mock responses
    maxConcurrentTests: 10,   // High concurrency for testing
    testPublicAccess: true
  }
}
```

**Use case:** Automated testing with mock bucket responses
**Requirements:** Mock server setup for bucket endpoints

### Staging Environment

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: false,
      alibaba: false
    },
    testTimeout: 5000,
    maxConcurrentTests: 2,
    testPublicAccess: true
  }
}
```

**Use case:** Pre-production testing with real cloud services
**Considerations:** Use test buckets, monitor for rate limiting

## Enterprise Environments

### Large Organization (Conservative)

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,              // Primary cloud provider
      gcp: false,             // Not used
      azure: true,            // Secondary provider
      digitalocean: false,    // Not used
      alibaba: false          // Blocked by policy
    },
    testTimeout: 10000,       // Conservative timeout
    maxConcurrentTests: 1,    // Minimize network impact
    testPublicAccess: true
  }
}
```

**Use case:** Large enterprises with strict network policies
**Benefits:** Minimal network impact, focused on used providers

### Security Team Configuration

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 20000,       // Thorough testing
    maxConcurrentTests: 3,    // Balanced approach
    testPublicAccess: true
  }
}
```

**Use case:** Dedicated security team browsers for threat hunting
**Benefits:** Comprehensive coverage, detailed findings

### Compliance Audit Configuration

```javascript
{
  cloudBucketScanning: {
    enabled: true,
    providers: {
      aws: true,
      gcp: true,
      azure: true,
      digitalocean: true,
      alibaba: true
    },
    testTimeout: 30000,       // Maximum thoroughness
    maxConcurrentTests: 2,    // Stable and reliable
    testPublicAccess: true
  }
}
```

**Use case:** Formal compliance audits and regulatory assessments
**Benefits:** Maximum detection capability, audit trail

## Configuration Management

### Programmatic Configuration

```javascript
// Function to apply configuration based on environment
async function applyBucketScanningConfig(environment) {
  const configs = {
    development: {
      enabled: true,
      providers: { aws: true, gcp: true, azure: false, digitalocean: false, alibaba: false },
      testTimeout: 2000,
      maxConcurrentTests: 1,
      testPublicAccess: true
    },
    
    production: {
      enabled: true,
      providers: { aws: true, gcp: true, azure: true, digitalocean: false, alibaba: false },
      testTimeout: 5000,
      maxConcurrentTests: 3,
      testPublicAccess: true
    },
    
    audit: {
      enabled: true,
      providers: { aws: true, gcp: true, azure: true, digitalocean: true, alibaba: true },
      testTimeout: 15000,
      maxConcurrentTests: 5,
      testPublicAccess: true
    }
  };
  
  const config = configs[environment] || configs.production;
  
  const settings = await browser.storage.local.get('userSettings');
  await browser.storage.local.set({
    userSettings: {
      ...settings.userSettings,
      cloudBucketScanning: config
    }
  });
}

// Usage
await applyBucketScanningConfig('audit');
```

### Configuration Validation

```javascript
// Function to validate bucket scanning configuration
function validateBucketConfig(config) {
  const errors = [];
  
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be boolean');
  }
  
  if (config.testTimeout < 1000 || config.testTimeout > 30000) {
    errors.push('testTimeout must be between 1000 and 30000ms');
  }
  
  if (config.maxConcurrentTests < 1 || config.maxConcurrentTests > 10) {
    errors.push('maxConcurrentTests must be between 1 and 10');
  }
  
  const validProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba'];
  for (const provider of Object.keys(config.providers)) {
    if (!validProviders.includes(provider)) {
      errors.push(`Invalid provider: ${provider}`);
    }
  }
  
  return errors;
}
```

## Best Practices

### Configuration Selection Guidelines

1. **Start Conservative:** Begin with default settings and adjust based on needs
2. **Monitor Performance:** Watch for browser slowdowns or high network usage
3. **Test Thoroughly:** Validate configuration changes on test pages
4. **Document Changes:** Keep track of configuration changes and reasons
5. **Regular Review:** Periodically review and optimize settings

### Security Considerations

1. **Responsible Testing:** Only test buckets you have permission to access
2. **Rate Limiting:** Respect cloud provider rate limits and terms of service
3. **Network Monitoring:** Be aware of network traffic generated by testing
4. **Data Handling:** Treat bucket findings as sensitive security information

### Performance Monitoring

```javascript
// Monitor bucket scanning performance
function monitorBucketScanningPerformance() {
  const startTime = performance.now();
  let requestCount = 0;
  
  // Override fetch to count bucket test requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    if (args[0].includes('s3.amazonaws.com') || 
        args[0].includes('storage.googleapis.com') ||
        args[0].includes('blob.core.windows.net')) {
      requestCount++;
    }
    return originalFetch.apply(this, args);
  };
  
  // Log performance metrics after 30 seconds
  setTimeout(() => {
    const duration = performance.now() - startTime;
    console.log(`Bucket scanning performance:
      Duration: ${duration}ms
      Requests: ${requestCount}
      Avg time per request: ${duration / requestCount}ms`);
  }, 30000);
}
```

This configuration guide provides practical examples for various scenarios. Choose the configuration that best matches your use case and adjust as needed based on your specific requirements and constraints.