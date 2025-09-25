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
- Reports contain only indicator IDs and pack IDs; optional screenshot hashed locally unless admin requests retrieval under policy
- Redaction workflow: honor deletion requests via token; apply tombstones on query
- Aggregated analytics only; no raw URL lists exported by default

## Cost Controls
- CDN distribution for packs and bulletins; serverless APIs; no push infra
- Bot protection and rate limiting; retrieval of updates via CDN only
- Archive old reports to cold storage

## Intel Feed Integration (Offline)
- FeodoTracker, URLhaus, PhishTank integration included in offline packs and manifest
- No live lookups; only local indicators used for scoring and warning
