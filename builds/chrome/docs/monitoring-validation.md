# Always-on monitoring validation

Automated verification uses the actual manifest scripts, scanner, settings, and browser-event handlers in a Node VM. Browser APIs and stream filters are mocked. Passing these tests does **not** establish Firefox stream behavior, successful installation, or Cloudflare compatibility.

Run from the repository root:

```sh
node tests/test-runner.js --no-performance
bash build.sh
node tests/verify-packages.js
```

The integration suite covers response detection and alerts without opening the popup; original response-buffer forwarding; rolling request count and byte limits; inspection continuing after 1 MiB; document generations; tab closure; whitelisting of both pages and resources; cancellation and automatic resumption; Explorer snapshots and tab authorization; settings migration; scanner dismissal; text and attribute mutations; overload, binary/stream exclusions, and capture deadlines. Package verification compares archive contents to the generated trees, checks source freshness, and loads the packaged background entry points.

## Browser acceptance still required

Use a disposable Firefox profile and load the rebuilt Firefox manifest through `about:debugging` (or select the ZIP if the Firefox build permits temporary ZIP loading).

1. Leave monitoring on and keep the popup closed. Serve a local fixture with a synthetic GitHub token (`ghp_` followed by 36 `a` characters) in page text, an attribute, inline JavaScript, an external script, and a JSON response. Confirm alerts and correct source URLs. Change text and attribute values after load and append text in separate batches within 500 ms.
2. Exercise ordinary fetch/XHR requests, errors, aborts, redirects, cached scripts, large responses, and an event stream. Verify response bytes and page behavior against the extension-disabled baseline. Continue past 1 MiB and 200 requests, then return another synthetic secret; it must still be found. Saturating limits should show incomplete coverage while requests continue normally.
3. Navigate or reload while a response is pending. Whitelist a page that uses third-party scripts while a response is pending, then remove it from the whitelist without reloading. Verify old findings and requests are cleared where appropriate, old responses are rejected, and new scans resume.
4. Open the API Explorer, generate two simultaneous requests to the same URL, and verify request IDs, headers, bodies, statuses and updates. Navigate the source tab and verify the old request list disappears. Rescan, dismiss a finding, reopen the popup and export; dismissed findings stay hidden but remain flagged in export until navigation.
5. Test the user's affected Cloudflare URL with monitoring on and the page interceptor diagnostic setting off. Compare challenge completion with the extension disabled. Record Firefox version, URL, exact error and whether the challenge was cached. **This check remains open until an affected URL is available and tested.**
6. Separately verify Chrome/Edge installation and document/DOM scanning. These builds have no response-body filter; request metadata alone cannot establish that a response is secret-free. Their in-memory state is subject to MV3 worker lifecycle limitations.

## Limits and status

Firefox attaches the filter at `onBeforeRequest`, before its optimized script cache lookup. The filter forwards each original buffer before copying inspection data. At 256 KiB, five seconds, cancellation, or error it relinquishes the stream. Only four filters and four queued/active response scans are allowed at once. Captured history rolls over at 200 requests or 1 MiB per tab; it is not a lifetime scanning allowance. Findings are capped at 1,000 per document. Mutation batches are capped at 256 KiB and 200 fragments.

Truncated or failed inspections remain visible in the document's aggregate status. A later successful scan must not imply complete coverage of previously omitted data. Automatic monitoring skips bucket-access probes and never installs page fetch/XHR wrappers by default.

References: [Firefox response filters](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/filterResponseData), [disconnect behavior](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/StreamFilter/disconnect).
