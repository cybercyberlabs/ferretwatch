---
layout: default
title: "Detection & Scoring"
parent: Specifications
nav_order: 3
description: Local-first detection signals, homograph detection, YARA integration, and scoring model for suspicious web page alerts
---
# 🧠 Detection & Scoring Specification

This section defines the local-first detection signals, homograph (IDN) detection, YARA integration, and the scoring model used to decide when to alert users.

## Key Principles
- Local-first: All signals below run entirely in the browser without network dependency.
- Deterministic: The same page yields the same score given the same rule pack.
- Explainable: Every score contribution is accompanied by human-readable evidence.

## Detection Signals (Local)

1) Internationalized Domain Name (IDN) Homograph/Lookalike
- Detect xn-- (punycode) hosts and non-ASCII characters in eTLD+1
- Compute Unicode security confusables “skeleton” and compare against a local brand set (banking, email, social, crypto, etc.)
- Fuzzy match thresholds: Levenshtein distance ≤ 1 for short brands (≤6 chars), ≤ 2 for 7–12 chars; weighted by character confusability class
- Elevate severity if page uses well-known brand assets (title, favicon pHash, meta og:site_name) but host mismatches

2) New Domain / Fresh Infrastructure
- Prefer local heuristics: treat domains first seen by this browser as higher-risk for first 24h (local-first-seen cache)
- Optional enrichment (cached via CDN packs): age buckets per TLD; if absent, mark neutral
- Signals: lack of subdomain history in same session and no service worker history for the origin

3) Phishing UI Heuristics
- Credential/post indicators: password fields posting cross-domain; hidden fields for email/phone; generic login forms on unknown host
- Off-domain form action or inline event handlers that exfiltrate to other origins
- Favicon/title/brand mismatch (e.g., title mentions "PayPal" but host not paypal.*)
- data: URLs for images/scripts; excessive inline JS obfuscation; suspicious keywords in DOM ("verify account", "urgent", "gift card")
- Suspicious redirects: immediate meta refresh or JS location.replace to unrelated eTLD+1

4) Cross-Domain Hotlinking
- Images, CSS, or fonts loaded from unrelated eTLD+1 not in subdomain tree and not on allowlisted CDN/vendor domains from rules.json
- Elevate if hotlinked assets originate from well-known brands (logo pHash matches) while host is unknown

5) Brand Asset Similarity (Perceptual Hash)
- Compute pHash for favicon and top images (size-limited); compare to local pack of brand pHashes
- If high similarity (e.g., Hamming distance ≤ 8) but domain is not in brand allowlist, raise brand_asset_mismatch

6) YARA Content Signatures (WASM)
- Run YARA rules over: DOM text snapshot, HTML source, and concatenated JS strings (size- and time-limited)
- Tag rules by family (phishing-kit, credential-harvest, crypto-scam, malware-dropper) and severity (low/med/high)

7) Community Reputation (Pulled Packs)
- Offline reputation packs (URLhaus, PhishTank, Feodo-derived indicators) are merged locally and consulted via exact match or fast hash-bloom filters
- No live queries; packs are signed and refreshed via CDN

## Scoring Model

- Weighted additive score in [0, 100]. Each finding contributes weight × confidence.
- Confidence reduces with noisy signals (e.g., keyword-only without structural evidence)
- Per-signal caps to prevent one noisy subsystem from dominating
- Default thresholds (user-tunable):
  - Green: 0–39
  - Yellow: 40–69
  - Red: ≥ 70 (show prominent warning, but do not block navigation)

### Example weights (from rules.json)
```json
{
  "version": "2025.09.24",
  "thresholds": { "yellow": 40, "red": 70 },
  "weights": {
    "idn_homograph_high": 40,
    "idn_homograph_medium": 25,
    "brand_asset_mismatch": 20,
    "new_domain_local_first_seen": 15,
    "phishing_form_cross_domain": 30,
    "phishing_keywords_only": 8,
    "cross_domain_hotlink": 12,
    "redirect_unrelated_domain": 10,
    "yara_phishing_high": 45,
    "yara_phishing_medium": 25,
    "reputation_hit": 50
  },
  "allowlists": {
    "cdn_domains": ["cdn.jsdelivr.net", "fonts.gstatic.com", "static.cloudflareinsights.com"],
    "brand_hosts": ["paypal.com", "google.com", "microsoft.com", "apple.com"]
  }
}
```
