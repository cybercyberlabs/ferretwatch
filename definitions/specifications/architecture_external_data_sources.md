---
layout: spec
title: External Data Sources and Enrichment Feeds
description: Local-first system for consuming external threat intelligence feeds and building signed rule packs for offline detection
date: 2025-09-25
version: 1.0
toc: true
---
# 🌐 External Data Sources and Enrichment Feeds

This system is local-first. External feeds are consumed asynchronously in CI to produce signed, CDN-distributed rule packs. The extension does not perform live lookups to these services during detection.

## Sources

- FeodoTracker (abuse.ch): https://feodotracker.abuse.ch/
  - Focus: Known botnet C2 IPs/domains (e.g., Emotet/Dridex era successors)
  - Use: Offline-compiled indicators into blocklist section of rules.json; tagged with source="feodotracker" and feed-version
  - TTL: Short (e.g., 24–72h); expired entries removed on next build

- URLhaus (abuse.ch): https://urlhaus.abuse.ch/
  - Focus: Malware distribution URLs
  - Use: Normalize to effective TLD+1 + path patterns; compile into YARA strings and heuristic URL matchers with conservative weighting
  - TTL: Short (e.g., 24–72h)

- PhishTank: https://phishtank.org/developer_info.php
  - Focus: Community-verified phishing URLs/domains
  - Use: Curated into brand-target mapping and high-confidence URL indicators; no user report will be domain-pattern-based
  - TTL: Medium (e.g., 7 days) with rolling updates

## Access, Formats & Update Cadence

- Formats
  - CSV and/or JSON as provided by each service; configured via CI-managed endpoints
  - Support ETag/If-Modified-Since where offered to minimize bandwidth
- Cadence
  - FeodoTracker & URLhaus: poll 4–8×/day (configurable)
  - PhishTank: poll daily or per rate-limit guidance
- Licensing & Attribution
  - Respect each provider’s terms; include source, fetch time, and license snippet in the manifest
  - Provide an allowlist for brands/providers opting out

## Ingestion & Build Pipeline

1. Scheduled CI job pulls feeds (respecting licenses and rate limits)
2. Normalize and deduplicate indicators
   - Domain canonicalization (lowercase, IDNA to ASCII), eTLD+1 extraction
   - URL normalization (strip default ports, collapse repeated slashes, drop querystrings unless feed marks them required)
   - IPs kept exact; domains folded to eTLD+1 plus optional subpath prefix
3. Assign source tags, confidence, and expiry timestamps
4. Generate artifacts:
   - rules.json (weights, heuristics, allow/deny lists, brand mappings)
   - yara.wasm + rule pack (compiled patterns with tags referencing source and expiry)
   - intel.bloom + intel.tries (compact reputation structures)
   - manifest.json (version, checksums, signature)
5. Publish to object storage; CDN serves with long TTL and cache-busting filenames

## Client Usage (Local-First)

- Extension pulls manifest via CDN
- Verifies signature; downloads new packs when versions change
- Applies indicators locally; no live calls to feeds
- Reports include only indicator IDs and source tags (e.g., src=urlhaus, id=abcdef), never raw feed content

## Bloom Filters & Tries (Reputation Packs)

- Bloom filter target false-positive rate: ~1e-6 for URL/host membership checks
- Hash functions: 3–5 independent hashes derived via double hashing
- Separate filters for hosts (eTLD+1), full URLs, and IPs for efficient lookups
- Prefix tries for brand-target mapping (e.g., login paths) to support quick rule evaluation

## Privacy & Reproducibility

- No page content is uploaded; only normalized indicators and hashes
- Admin can reproduce using the same rule pack version recorded in the report metadata
- No domain-pattern submissions from users; evidence must be concrete and replayable
