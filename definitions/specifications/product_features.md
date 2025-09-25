---
layout: spec
title: Product Features
description: Comprehensive feature specifications for FerretWatch Enhanced including local-first detection, reporting, and admin interface capabilities
date: 2025-09-25
version: 1.0
toc: true
---
# 🧩 Product Features

## 1. Local-First Suspicious Page Detection
- Feature: **Domain & URL Analysis**
  - Objective: Identify risky hosts using local heuristics
  - User Benefit: Early warnings without network dependency
  - Requirements:
    - Detect IDN homographs and lookalike domains via UTS #39 skeletons
    - eTLD+1 extraction with Public Suffix List
    - Local-first seen cache for "new to this browser" signals
    - Off-domain redirects and cross-domain form actions flagged
  - Non-Functional:
    - Performance: ≤ 50 ms average per page
    - Offline: Works fully offline with last-known rule pack

- Feature: **Brand Impersonation Heuristics**
  - Objective: Catch phishing that mimics known services
  - User Benefit: Clear, confidence-building alerts
  - Requirements:
    - Compare page title, favicon pHash, and meta tags to local brand pack
    - Flag mismatch when brand assets found but host not allowlisted
    - Allowlist popular CDNs to reduce noise
  - Non-Functional: pHash computation limited to top N images by size (configurable)

- Feature: **Content Signatures (YARA WASM)**
  - Objective: Detect known phishing kits and malware lures
  - User Benefit: Protection from known bad patterns
  - Requirements:
    - Run precompiled YARA rules on limited buffers (HTML, JS)
    - Map rule tags to scoring keys; evidence captured as rule IDs
  - Non-Functional: Hard CPU and time budget per page; graceful abort when budget exceeded

## 2. Threat Scoring & Alerts
- Feature: **Weighted Scoring Engine**
  - Objective: Convert findings into a single risk score
  - User Benefit: Simple green/yellow/red guidance
  - Requirements:
    - Weighted additive score with caps and confidence scaling
    - Default thresholds: yellow 40, red 70; user-adjustable slider
    - Expose details panel with per-finding contributions and evidence

- Feature: **Alert UX**
  - Objective: Communicate risk clearly to all users
  - User Benefit: Understandable actions and safer alternatives
  - Requirements:
    - Yellow: non-blocking banner; Red: interstitial-style panel
    - "Proceed" and "Report" actions; show safe official link when known
    - Session-based suppression after user acknowledges

## 3. Rule Distribution and Intel Packs (Cost-Optimized)
- Feature: **CDN-Pulled Rule Packs**
  - Objective: Low-cost, scalable distribution of rules
  - User Benefit: Always-up-to-date without push infra
  - Requirements:
    - Manifest with version, checksums, signature
    - Files: rules.json, yara.pack, intel.bloom, intel.tries, brands.phash
    - Pull interval with jitter; ETag/If-Modified-Since support
  - Non-Functional: Served via CDN with long TTL and cache-busting filenames

- Feature: **Threat Intel Integration (Offline)**
  - Objective: Enrich detection with reputable feeds
  - User Benefit: Faster reaction to emerging threats
  - Requirements:
    - Incorporate indicators from FeodoTracker, URLhaus, PhishTank into compact local structures
    - Reputation check is local only; no live lookups

## 4. Reporting and Anti-Abuse
- Feature: **Report Suspicious Page / False Positive**
  - Objective: Crowdsource threats and improve accuracy
  - User Benefit: Protect the community and reduce noise
  - Requirements:
    - Closed-list reasons; mandatory full URL; attach score and top findings
    - Local preview of payload prior to submit
    - Rate limiting: per-IP and per-install token buckets
    - Adaptive CAPTCHA on bursty or low-rep clients
  - Non-Functional: Serverless ingestion; 429 with Retry-After on limit

- Feature: **Reproducible Admin Review**
  - Objective: Prevent weaponization of reports
  - User Benefit: Fair treatment for legitimate domains
  - Requirements:
    - Admin sees full URL, timestamp, rule-pack ID; one-click reproduce in headless runner
    - Two-admin approval for new rules or allow/deny updates
    - Abuse analytics: domain-level trend charts; mark "verified legitimate"

## 5. Administrator Controls
- Feature: **Rule Management Console**
  - Objective: Safely evolve detection without user data access
  - User Benefit: Rapid protection improvements
  - Requirements:
    - Create/edit rules and YARA packs; staged rollout and rollback
    - Multi-admin review; immutable audit trail

- Feature: **Active Campaign Notifications**
  - Objective: Inform users about live phishing campaigns
  - User Benefit: Timely, actionable guidance
  - Requirements:
    - Bulletins JSON with scope filters (brands, eTLD+1, locales), severity, TTL
    - Distributed via CDN; clients pull with normal checks
    - Local display when scope matches; no callbacks

## 6. Privacy & Compliance Defaults
- Feature: **Privacy by Default**
  - Objective: Protect user identity and content
  - Requirements:
    - No browsing history collected
    - Reports exclude PII; optional screenshot hashed locally unless admin requests retrieval under policy
    - Data deletion via tokenized request
- ...