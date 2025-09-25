---
layout: default
title: Product Overview
parent: Overview
nav_order: 1
description: Product vision, problem statement, goals, and success metrics for FerretWatch Enhanced
---
# 🎯 Product Overview

## Product Vision
**Empower users to browse safely by instantly detecting and alerting them to suspicious web pages, protecting them from phishing, scams, and other web-based threats.**

## Problem Statement

### Who hurts?
**Internet users of all technical levels** who are vulnerable to increasingly sophisticated phishing attacks, scam websites, and malicious pages that steal credentials or personal information.

### Pain intensity?
- **70% of successful cyberattacks** start with phishing or malicious websites
- Average financial loss per phishing victim: **$1,200**
- **1 in 4 users** have clicked on a phishing link in the past year
- Current browser warnings often come **too late** or are **too generic**

### Existing workaround?
- Manual URL inspection (ineffective for most users)
- Relying on browser's built-in protection (often inadequate)
- Using separate security tools (inconvenient)
- Learning from bad experiences (costly)

### Additional Context
- Phishing techniques evolve rapidly, making static blacklists insufficient
- New domains are registered constantly for malicious purposes
- Visual spoofing techniques are becoming more sophisticated
- Users need real-time, contextual warnings

## Goals & Success Metrics

| Goal | KPI | Target |
|------|-----|--------|
| **Reduce successful phishing attempts** | Detection rate of known phishing sites | > 95% |
| **Minimize false positives** | False positive rate | < 2% |
| **Increase user awareness** | Users who report suspicious pages | > 10% of active users/month |
| **Improve response time** | Time to detect new threats via YARA rules | < 4 hours |
| **User adoption** | Daily active users | 100K in 6 months |
| **User trust** | User retention rate | > 80% after 3 months |
| **Community protection** | Suspicious pages reported & verified | > 1000/month |

## Local-First Enhancements
- On-device detection: IDN/homoglyph checks, phishing UI heuristics, hotlink detection, and YARA scanning in WASM
- Offline intel packs pulled from CDN (Feodo Tracker, URLhaus, PhishTank); no live lookups required
- Scoring model with user-adjustable thresholds and explainable findings
- Low-cost infrastructure: static rule distribution over CDN; serverless reporting with CAPTCHA + rate-limiting
- Privacy by default: no browsing history collection; reports are reproducible (full URL + timestamp), never domain-pattern-only