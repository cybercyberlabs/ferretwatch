---
layout: spec
title: Reporting, Admin, Privacy and Cost Controls
description: User-initiated reporting system with privacy-preserving admin controls and cost-effective infrastructure design
date: 2025-09-25
version: 1.0
toc: true
---
# 🧾 Reporting, Admin, Privacy & Cost Controls

## Reporting (User-Initiated)
- Reasons (closed list):
  - Phishing login page
  - Payment fraud/scam
  - Malware/download deception
  - Brand impersonation/homograph
  - Data exfiltration/form abuse
  - Other (requires short free-text, locally validated length)
- Payload (no PII):
  - Full URL, timestamp, extension version, rule pack ID, score, top findings (keys + evidence snippets), optional screenshot hash (no raw image by default)
  - Client install token (HMAC signed, non-PII) for rate limiting
  - CAPTCHA token (when required by server)
- Constraints:
  - No domain-pattern-only reports; every report must be reproducible with a concrete URL and evidence
  - Local preview shows exactly what will be sent

## Report API (Low-Cost, Abuse-Resilient)
- POST /report and POST /false-positive
- Edge protections: WAF bot rules; per-IP and per-install token buckets (e.g., 5/min, 50/day); exponential backoff with Retry-After
- CAPTCHA challenge policy: adaptive; trigger on bursty behavior or low reputation
- Storage: Append-only log (immutable), moderation table with status (queued, verified, rejected, benign)
- Data retention: 90 days for raw reports; aggregated stats kept longer

## Admin Workflow
- Inbox: Triage by score, source, reason; dedup by URL hash
- Reproduction Runner: Headless fetcher applies the same rule pack and intel version used in the report; captures artifacts (headers, HTML hash, DOM snapshot hash)
- Actions:
  - Mark Verified/Rejected/Benign
  - Create quick rule (YARA or heuristic allow/deny) -> requires second admin approval
  - Flag coordinated abuse -> auto-throttle reports from correlated tokens/IPs
  - Publish Active Campaign Notification (see below)
- Audit log: All admin actions are signed and immutable; export to object storage periodically
- RBAC: Admin, Reviewer, Publisher; two-person rule for publishing new packs

## Active Campaign Notifications (Cost-Efficient, CDN-Pulled)
- Bulletins are JSON documents signed by the publisher and served via CDN with cache-busting filenames
- Fields: id, version, created_at, ttl, severity, locales, brands, etldPlus1, advisory_text, safe_links[], min_ext_version, frequency_cap
- Client behavior: pull during normal manifest check; store locally; display advisory when visiting matching scope; never call home
- Expiration: auto-expire at ttl; hidden if user dismisses within session; can be suppressed by enterprise policy

## Privacy Guarantees
- No browsing history or user identifiers collected
- Reports contain only indicator IDs and pack IDs; optional screenshot hashed locally
- Opt-in enrichment calls; default off; results cached locally
- Right to deletion: user can request redaction of report payloads via token; implemented as keyed-hash tombstone applied at query time

## Cost Controls
- CDN-only pull: rules.json, yara packs, intel.bloom (Feodo, URLhaus, PhishTank) and bulletins distributed via object storage + CDN; long TTL, cache-busting filenames
- Serverless APIs: report ingestion and admin read endpoints; autoscale to zero
- Batch processing for moderation analytics; pre-compute bloom filters offline in CI
- Avoid push infra (SNS/WebSockets); rely on client pull intervals with jitter
- Intelligent delta updates: partial packs supported to reduce bandwidth

## Intel Feed Integration (Offline Packs)
- Sources:
  - Feodo Tracker — https://feodotracker.abuse.ch/
  - URLhaus — https://urlhaus.abuse.ch/
  - PhishTank — https://phishtank.org/developer_info.php
- Pipeline:
  - Scheduled CI job fetches sources, normalizes to indicators (domains, URLs, IPs, hashes)
  - Builds compact bloom filters and prefix tries; signs manifest with version and checksums
  - Publishes to CDN alongside rules.json
- Client behavior:
  - Periodically pulls latest intel.bloom and verifies signature
  - Checks visited URL/host against filters locally; raises "reputation_hit" finding on match

## Rate Limiting & CAPTCHA Details
- Token buckets:
  - Per IP: 5/minute, 300/day (configurable)
  - Per install token: 3/minute, 100/day
- Burst handling: 429 with Retry-After; greylist for cool-down
- CAPTCHA triggers: after N failed attempts, on geolocation risk, or when anomaly detector flags automation
- Abuse sinkhole: repeated abusers receive success=false with increased CAPTCHA hardness
