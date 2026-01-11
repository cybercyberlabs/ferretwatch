# FerretWatch Troubleshooting Guide

## Quick Diagnostics

### Step 1: Check Extension Status
```javascript
// In browser console (F12), run:
console.log('FerretWatch installed:', !!window.__ferretWatchProxyLoaded);
console.log('Scanner loaded:', !!window.FerretWatchDebug);
console.log('Proxy loaded:', !!window.__ferretWatchProxyLoaded);
```

**Expected output:**
```
FerretWatch installed: true
Scanner loaded: true
Proxy loaded: true  // (after first replay attempt)
```

---

## Common Issues

### 🔴 Issue: Replay Button Doesn't Work

**Symptoms:**
- Click "Replay Request" - nothing happens
- Console shows CSP errors
- "Main World Request Timed Out" error

**Solutions:**

#### 1. Reload the Extension
```bash
# Firefox: about:addons → FerretWatch → Reload
# Chrome: chrome://extensions → FerretWatch → Reload button
```

#### 2. Check Console for Errors
1. Open DevTools (F12)
2. Click "Console" tab
3. Look for `[FW Proxy]` messages

**Good output:**
```
[FW Proxy] Main world proxy initialized
[FW Proxy] Executing request fw-xyz: GET https://api.example.com/endpoint
[FW Proxy] Request succeeded: 200
```

**Bad output:**
```
CSP: blocked inline script
[FW Proxy] Request failed: NetworkError
```

#### 3. Verify Permissions
1. Go to extension settings
2. Check "Access your data for all websites" is enabled
3. If disabled, enable and reload page

#### 4. Test on Simple Site
Try on a test API:
- https://jsonplaceholder.typicode.com/posts
- https://api.github.com/users/octocat
- https://httpbin.org/get

If it works there, the original site may have additional restrictions.

---

### 🔴 Issue: "NetworkError when attempting to fetch"

**Symptoms:**
```
[FW Proxy] Request with credentials failed, retrying without: NetworkError
[FW Proxy] Request failed: TypeError: NetworkError
```

**Causes:**
1. **CORS restrictions** - API blocks cross-origin requests
2. **Relative URL** - URL starts with `/` but page has no base URL
3. **Network connectivity** - Internet connection issues
4. **Blocked by firewall** - Corporate firewall blocking request

**Solutions:**

#### For CORS Issues:
- ✅ This is expected for some APIs
- ℹ️ The API is working as designed (blocking browser requests)
- 💡 Use the original page's context instead of replay

#### For Relative URLs (Fixed in v2.2.0):
- ✅ Should now auto-resolve to absolute URLs
- ✅ Check console for "Resolved relative URL" message
- ℹ️ Example: `/api/users` → `https://example.com/api/users`

#### For Network Issues:
1. Check your internet connection
2. Try accessing the URL directly in browser
3. Check browser's Network tab for details

---

### 🔴 Issue: No API Calls Detected

**Symptoms:**
- API Explorer shows "No API calls detected yet"
- You know the page makes API calls

**Solutions:**

#### 1. Interact with the Page
The interceptor only captures calls **after** the extension loads:
- Refresh the page
- Click buttons that trigger API calls
- Scroll to load more content
- Submit forms

#### 2. Check Interceptor Status
```javascript
// In console:
console.log('Interceptor loaded:', !!window.__ferretWatchInterceptorInjected);
```

If `false`, the interceptor didn't load. Try:
1. Reload page
2. Check if domain is whitelisted (remove if so)
3. Check console for injection errors

#### 3. Some Requests Not Captured
The interceptor only captures:
- ✅ `fetch()` calls
- ✅ `XMLHttpRequest` (XHR) calls
- ❌ WebSocket connections
- ❌ Server-Sent Events (SSE)
- ❌ Requests from iframes (cross-origin)

For WebSocket/SSE, use browser DevTools Network tab.

---

### 🔴 Issue: CSP Errors Still Appearing

**Symptoms:**
```
Content-Security-Policy: blocked inline script
```

**This should be fixed in v2.2.0!** If you still see this:

#### 1. Verify Version
```javascript
// In console:
window.FerretWatchDebug.version
// Should show: "2.2.0"
```

If older version:
1. Uninstall extension completely
2. Reinstall latest version
3. Hard refresh page (Ctrl+Shift+R)

#### 2. Clear Extension Cache
```bash
# Firefox
rm -rf ~/.mozilla/firefox/*/storage/default/moz-extension*

# Chrome
# Go to chrome://extensions → FerretWatch → Remove → Reinstall
```

#### 3. Check Manifest
The `web_accessible_resources` should include:
```json
"web_accessible_resources": [
    "utils/network-interceptor.js",
    "utils/main-world-proxy.js"
]
```

---

### 🔴 Issue: Extension Not Loading

**Symptoms:**
- No icon in toolbar
- Extension not in extensions list
- Installation fails

**Solutions:**

#### Firefox
1. Check browser version: Firefox 91+ required
2. Try temporary installation:
   - `about:debugging` → This Firefox → Load Temporary Add-on
   - Select `manifest.json`

#### Chrome
1. Developer mode must be enabled
2. Use "Load unpacked" button
3. Select extension folder (not zip file)

#### Common Installation Errors:
```
"Failed to load extension: Manifest is invalid"
```
- **Cause:** Corrupt manifest.json
- **Fix:** Redownload extension

```
"This extension may have been corrupted"
```
- **Cause:** Files modified after installation
- **Fix:** Reinstall completely

---

### 🔴 Issue: Broken Authentication Test Always Passes

**Symptoms:**
- "Test Broken Auth" button always shows green (success)
- API returns 200 even without auth headers

**This might not be a bug!** Possible reasons:

#### 1. Endpoint Doesn't Require Auth
Some endpoints are intentionally public:
- `/api/public/*`
- `/api/health`
- `/api/version`
- GET endpoints for public data

#### 2. API Uses Cookie Auth
The extension removes common auth headers but **not cookies**:
- Session cookies persist
- JWT in cookies persist
- Test may need cookie removal (planned for v2.3.0)

#### 3. API Uses IP Whitelist
If the API checks IP address instead of tokens:
- Removing auth headers won't help
- API is secure (IP-based auth)

#### 4. API Has No Auth (Vulnerability!)
If a protected endpoint returns 200 without auth:
- 🚨 This is a real security issue!
- Report to the website owner
- Document in your security report

---

### 🔴 Issue: Response Body is Truncated

**Symptoms:**
- Response shows `[Body too large - truncated]`
- Only first part of response visible

**This is intentional!** Large responses are truncated to:
- Prevent browser slowdown
- Save memory
- Maintain UI responsiveness

**Limits:**
- Console output: 5 MB
- Popup display: 1 MB
- Export files: No limit

**Solutions:**
1. Use browser DevTools Network tab for full response
2. Export findings to JSON (no truncation)
3. Use external tool like Postman for large responses

---

## Advanced Diagnostics

### Enable Debug Mode
1. Click FerretWatch icon
2. Click "Settings"
3. Enable "Debug Mode"
4. Close settings
5. Reload page

**Debug mode shows:**
- All low-risk findings
- Detailed scan timing
- Pattern matching details
- Internal state logs

### Check Extension Logs
```javascript
// Get scan results
window.FerretWatchDebug.getLastScanResults()

// Trigger manual scan
await window.FerretWatchDebug.scanCurrentPage()

// Check storage
await browser.storage.local.get(null)
```

### Export Diagnostic Info
```javascript
// Run this in console to get diagnostic dump
{
    version: window.FerretWatchDebug?.version,
    proxyLoaded: window.__ferretWatchProxyLoaded,
    interceptorLoaded: window.__ferretWatchInterceptorInjected,
    lastScan: window.lastScanResults?.length,
    domain: window.location.hostname,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
}
```

Copy and paste output when reporting issues.

---

## Performance Issues

### 🐌 Extension Slowing Down Browser

**Symptoms:**
- Page loads slowly
- High CPU usage
- Browser freezes

**Solutions:**

#### 1. Check Findings Count
```javascript
window.lastScanResults?.length
// If > 1000, you may have too many findings
```

**High finding counts** can slow down:
- Popup rendering
- Export generation
- Rescan operations

**Fix:** Whitelist domains with many false positives

#### 2. Whitelist False Positive Domains
If a domain always shows many low-risk findings:
1. Open FerretWatch popup
2. Click "Add to Whitelist"
3. Reload page

**Common whitelist candidates:**
- Developer documentation sites
- Code repositories
- Test/demo sites

#### 3. Disable on Slow Devices
On low-end devices:
- Whitelist heavy sites
- Close API Explorer when not needed
- Disable debug mode

---

## Browser-Specific Issues

### Firefox

#### Issue: "Receiving end does not exist"
**Cause:** Content script not injected
**Fix:**
1. Check `about:debugging`
2. Verify content scripts listed
3. Reload page

#### Issue: Xray Vision Not Working
**Cause:** Not actually an issue - fallback works
**Note:** Firefox should prefer Xray, Chrome uses external script

### Chrome

#### Issue: "Cannot access chrome-extension://"
**Cause:** Script trying to access restricted URLs
**Fix:** This is expected and caught by error handler

#### Issue: Manifest V3 Warning
**Note:** Extension uses Manifest V2 (compatible with all browsers)
**Action:** None needed (V3 migration planned for v3.0.0)

---

## Getting Help

### Before Reporting Issues

1. ✅ Check this troubleshooting guide
2. ✅ Verify you're on latest version (v2.2.0+)
3. ✅ Try on a simple test site first
4. ✅ Check browser console for errors
5. ✅ Collect diagnostic info (see above)

### How to Report Issues

**Good bug report:**
```
Title: Replay button fails on LinkedIn

Steps to reproduce:
1. Go to linkedin.com
2. Click a message
3. Open API Explorer
4. Select a GraphQL endpoint
5. Click "Replay Request"

Expected: Request replays successfully
Actual: Error "NetworkError when attempting to fetch"

Browser: Firefox 123.0
Extension Version: 2.2.0
Console Output: [paste console logs]
Diagnostic Info: [paste diagnostic dump]
```

**Where to report:**
- 🐛 Bugs: https://github.com/cybercyberlabs/ferretwatch/issues
- 💡 Feature requests: Same GitHub issues
- 🔐 Security issues: security@cybercyberlabs.com (private)

---

## FAQ

### Q: Is it safe to use on production sites?
**A:** Yes, FerretWatch is read-only and doesn't modify page behavior. However:
- Don't replay sensitive operations (POST/DELETE) in production
- Be cautious when testing authentication
- Some sites may log extension activity

### Q: Will this get me banned from websites?
**A:** Unlikely, but possible if you:
- Make excessive API requests (rate limiting)
- Trigger security alerts (unusual patterns)
- Test authentication on financial sites

**Best practice:** Use on test/dev environments when possible.

### Q: Does this work with GraphQL?
**A:** Yes! GraphQL requests are captured like any other API call.

### Q: Can I use this for bug bounty hunting?
**A:** Yes, but:
- Read the program's rules carefully
- Don't use automated testing features excessively
- Document findings properly
- Follow responsible disclosure

### Q: How do I uninstall completely?
1. Remove extension from browser
2. Clear browser data (optional)
3. Remove local storage: `browser.storage.local.clear()`

---

**Last Updated:** 2026-01-11 (v2.2.0)
**Need more help?** Open an issue on GitHub!
