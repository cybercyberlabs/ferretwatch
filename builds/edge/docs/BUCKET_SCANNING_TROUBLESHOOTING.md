# Cloud Bucket Scanning Troubleshooting Guide

This guide helps resolve common issues with the cloud bucket scanning feature in FerretWatch.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Configuration Problems](#configuration-problems)
3. [Network and Connectivity Issues](#network-and-connectivity-issues)
4. [Performance Issues](#performance-issues)
5. [False Positives and Negatives](#false-positives-and-negatives)
6. [Browser-Specific Issues](#browser-specific-issues)
7. [Debugging Steps](#debugging-steps)
8. [Getting Help](#getting-help)

## Common Issues

### Bucket Scanning Not Working

**Symptoms:**
- No bucket findings despite visible bucket URLs on page
- Extension appears to be working but bucket scanning is silent
- Bucket URLs are detected but not tested for accessibility

**Solutions:**

1. **Check if bucket scanning is enabled:**
   ```javascript
   // Open browser console and run:
   const settings = await browser.storage.local.get('userSettings');
   console.log('Bucket scanning enabled:', settings.userSettings?.cloudBucketScanning?.enabled);
   ```

2. **Verify provider settings:**
   - Open extension settings
   - Navigate to "Cloud Bucket Scanning" section
   - Ensure desired providers (AWS, GCP, Azure, etc.) are enabled

3. **Check URL pattern matching:**
   - Supported formats:
     - AWS S3: `s3://bucket-name`, `https://bucket.s3.amazonaws.com`, `https://s3.amazonaws.com/bucket`
     - GCS: `gs://bucket-name`, `https://storage.googleapis.com/bucket`
     - Azure: `https://account.blob.core.windows.net/container`

### No Notifications for Found Buckets

**Symptoms:**
- Buckets are detected (visible in console logs)
- No visual notifications appear
- Extension popup shows no bucket findings

**Solutions:**

1. **Check notification settings:**
   - Ensure notifications are enabled in extension settings
   - Check if bucket findings meet the risk threshold

2. **Verify bucket accessibility results:**
   ```javascript
   // Check console for bucket test results
   // Look for messages like: "Bucket test completed: [bucket-url] - Status: [accessible/secured]"
   ```

3. **Review risk level filtering:**
   - Open buckets are typically "High" risk
   - Secured buckets are "Low" risk
   - Check if your risk threshold excludes these levels

## Configuration Problems

### Settings Not Saving

**Symptoms:**
- Changes to bucket scanning settings don't persist
- Settings reset to defaults after browser restart
- Error messages when updating settings

**Solutions:**

1. **Check browser storage permissions:**
   - Ensure extension has storage permissions in `about:addons`
   - Try reloading the extension

2. **Clear corrupted settings:**
   ```javascript
   // Reset bucket scanning settings to defaults
   await browser.storage.local.remove('userSettings');
   // Reload the extension
   ```

3. **Validate settings format:**
   ```javascript
   // Correct settings structure:
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

### Provider-Specific Issues

**AWS S3 Issues:**
- Ensure URLs match supported patterns
- Some S3 regions may have different URL formats
- Virtual-hosted-style URLs: `https://bucket-name.s3.region.amazonaws.com`
- Path-style URLs: `https://s3.region.amazonaws.com/bucket-name`

**Google Cloud Storage Issues:**
- Check for both `gs://` and `https://storage.googleapis.com/` formats
- Regional endpoints may not be detected
- Custom domain buckets are not currently supported

**Azure Blob Storage Issues:**
- Only standard blob storage URLs are supported
- Custom domains are not detected
- Ensure container names are included in URLs

## Network and Connectivity Issues

### CORS Errors

**Symptoms:**
- Console errors mentioning "CORS policy"
- Bucket tests failing with network errors
- "Access to fetch blocked by CORS policy" messages

**Solutions:**

1. **Understanding CORS limitations:**
   - CORS errors are expected for cross-origin bucket requests
   - The extension handles CORS errors gracefully
   - CORS errors don't necessarily mean the bucket is secured

2. **Check error handling:**
   ```javascript
   // Look for these console messages:
   // "Bucket test failed due to CORS - treating as unknown status"
   // "Network error testing bucket - this is expected for cross-origin requests"
   ```

3. **Verify test results interpretation:**
   - CORS errors are classified as "unknown" status
   - Only successful responses indicate public accessibility
   - Access denied responses indicate secured buckets

### Timeout Issues

**Symptoms:**
- Bucket tests taking too long
- "Request timeout" errors in console
- Scanning appears to hang on certain pages

**Solutions:**

1. **Adjust timeout settings:**
   - Default timeout: 5 seconds
   - Increase for slow networks: 10-15 seconds
   - Decrease for faster scanning: 2-3 seconds

2. **Reduce concurrent tests:**
   - Default: 3 concurrent tests
   - Reduce to 1-2 for slower connections
   - Increase to 5-10 for faster networks (use caution)

3. **Check network stability:**
   - Test on different networks
   - Verify internet connection speed
   - Consider using a VPN if regional restrictions apply

## Performance Issues

### Slow Page Loading

**Symptoms:**
- Pages load slowly when bucket scanning is enabled
- Browser becomes unresponsive during scanning
- High CPU usage during page loads

**Solutions:**

1. **Optimize concurrency settings:**
   ```javascript
   // Reduce concurrent tests
   await settings.updateBucketScanningSettings({
     maxConcurrentTests: 1  // Reduce from default of 3
   });
   ```

2. **Increase timeout for fewer retries:**
   ```javascript
   // Longer timeout reduces retry attempts
   await settings.updateBucketScanningSettings({
     testTimeout: 10000  // 10 seconds instead of 5
   });
   ```

3. **Disable unused providers:**
   ```javascript
   // Only enable providers you need
   await settings.updateBucketScanningSettings({
     providers: {
       aws: true,
       gcp: false,    // Disable if not needed
       azure: false,  // Disable if not needed
       digitalocean: false,
       alibaba: false
     }
   });
   ```

### Memory Usage

**Symptoms:**
- High memory usage in browser
- Browser tab crashes during scanning
- "Out of memory" errors

**Solutions:**

1. **Clear scan results regularly:**
   - Results are cached during browsing session
   - Clear browser cache periodically
   - Restart browser if memory usage is high

2. **Limit concurrent operations:**
   - Reduce `maxConcurrentTests` to 1-2
   - Avoid opening many tabs with bucket scanning simultaneously

## False Positives and Negatives

### False Positive Buckets

**Symptoms:**
- Extension reports buckets as "open" when they're actually secured
- Notifications for buckets that don't exist
- Test results don't match manual verification

**Solutions:**

1. **Verify bucket existence:**
   - Manually check bucket URLs in browser
   - Some URLs may be placeholders or examples
   - Check if bucket names contain obvious test patterns

2. **Review detection patterns:**
   - Extension may detect URL-like strings that aren't actual buckets
   - Check context around detected URLs
   - Report persistent false positives for pattern improvement

3. **Manual verification:**
   ```bash
   # Test AWS S3 bucket manually
   curl -I https://bucket-name.s3.amazonaws.com/
   
   # Test Google Cloud Storage
   curl -I https://storage.googleapis.com/bucket-name/
   ```

### Missing Bucket Detections

**Symptoms:**
- Known bucket URLs on page are not detected
- Extension misses obvious bucket references
- Inconsistent detection across similar URLs

**Solutions:**

1. **Check URL formats:**
   - Ensure URLs match supported patterns exactly
   - Some custom domain buckets may not be detected
   - Regional endpoints may use different formats

2. **Review page content:**
   - URLs in JavaScript variables may not be scanned
   - Dynamic content loaded after page load may be missed
   - Try manual page rescan after content loads

3. **Pattern limitations:**
   - Current patterns may not cover all possible formats
   - Custom implementations may use non-standard URLs
   - Report missing patterns for future updates

## Browser-Specific Issues

### Firefox-Specific Issues

**Common problems:**
- Content Security Policy (CSP) restrictions
- Extension permission limitations
- Network request handling differences

**Solutions:**
- Ensure extension has necessary permissions
- Check for CSP errors in console
- Try disabling other extensions that might interfere

### Cross-Browser Compatibility

**Chrome/Edge differences:**
- API differences between browsers
- Different CORS handling
- Permission model variations

**Solutions:**
- Use Firefox as primary testing browser
- Report browser-specific issues
- Check extension compatibility documentation

## Debugging Steps

### Enable Debug Logging

1. **Open browser console (F12)**
2. **Look for bucket scanning messages:**
   ```
   🪣 Bucket Scanner: Starting scan for cloud storage URLs
   🪣 Found bucket URL: [url] (Provider: [provider])
   🪣 Testing bucket accessibility: [url]
   🪣 Bucket test completed: [url] - Status: [result]
   ```

3. **Check for error messages:**
   ```
   ❌ Bucket test failed: [url] - Error: [details]
   ⚠️ Invalid bucket URL format: [url]
   🔧 Bucket scanning disabled in settings
   ```

### Manual Testing

1. **Test bucket detection:**
   ```javascript
   // Create test page with known bucket URLs
   const testContent = `
     s3://my-test-bucket
     https://example-bucket.s3.amazonaws.com/
     gs://my-gcs-bucket
   `;
   
   // Check if patterns match
   const patterns = window.BucketPatterns || {};
   console.log('Detected patterns:', patterns);
   ```

2. **Test settings:**
   ```javascript
   // Check current settings
   const settings = await browser.storage.local.get('userSettings');
   console.log('Bucket settings:', settings.userSettings?.cloudBucketScanning);
   
   // Test settings update
   await browser.storage.local.set({
     userSettings: {
       ...settings.userSettings,
       cloudBucketScanning: {
         enabled: true,
         providers: { aws: true, gcp: true, azure: true },
         testTimeout: 5000,
         maxConcurrentTests: 3
       }
     }
   });
   ```

### Network Debugging

1. **Monitor network requests:**
   - Open Network tab in DevTools
   - Look for requests to bucket URLs
   - Check response codes and timing

2. **Test connectivity:**
   ```bash
   # Test basic connectivity to cloud providers
   ping s3.amazonaws.com
   ping storage.googleapis.com
   ping blob.core.windows.net
   ```

## Getting Help

### Before Reporting Issues

1. **Gather information:**
   - Extension version
   - Browser version and type
   - Operating system
   - Specific bucket URLs (if public)
   - Console error messages
   - Network conditions

2. **Try basic troubleshooting:**
   - Restart browser
   - Reload extension
   - Test on different pages
   - Check settings configuration

3. **Create minimal test case:**
   - Create simple HTML page with bucket URLs
   - Test with known public/private buckets
   - Document expected vs actual behavior

### Reporting Issues

**Include in your report:**
- Detailed steps to reproduce
- Expected behavior vs actual behavior
- Console logs and error messages
- Extension and browser versions
- Network environment details

### Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| No bucket detection | Check if bucket scanning enabled in settings |
| CORS errors | Expected behavior - not a bug |
| Slow scanning | Reduce concurrent tests, increase timeout |
| False positives | Verify URLs manually, check for test patterns |
| Settings not saving | Clear storage, reload extension |
| High memory usage | Reduce concurrency, clear cache |
| Missing notifications | Check risk threshold and notification settings |

### Security Considerations

**Responsible Usage:**
- Only test buckets you have permission to access
- Don't overwhelm target services with requests
- Respect rate limits and terms of service
- Use findings for legitimate security research only

**Privacy:**
- Extension doesn't store bucket contents
- Only tests for public listing capability
- All processing happens locally in browser
- No data sent to external servers

This troubleshooting guide should help resolve most common issues with bucket scanning. For additional support, refer to the main documentation or report issues through the appropriate channels.