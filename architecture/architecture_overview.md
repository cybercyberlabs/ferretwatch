---
layout: default
title: Architecture Overview
parent: Architecture
nav_order: 1
description: Privacy-preserving browser extension architecture for suspicious web page detection through client-side analysis and centralized rule distribution
---
# 🏗️ Architecture Overview

## System Purpose
FerretWatch Enhanced is a privacy-preserving browser extension that detects and alerts users about suspicious web pages through client-side analysis, crowd-sourced threat intelligence, and centralized rule distribution.

## Context Diagram (Local-First, Mermaid 10.9.4 Compatible)

```mermaid
flowchart TB
  subgraph BROWSER
    direction TB
    user[User]
    ext[Extension]
    heur[Local Heuristics]
    yara[WASM YARA]
    cache[Signed Rule Cache]
  end

  subgraph SERVICES
    direction TB
    cdn[Rule CDN]
    report[Report API]
    admin[Admin Panel]
    bulletin[Campaign Bulletins]
  end

  subgraph ENRICH
    direction TB
    whois[WHOIS Cache]
    intel[Threat Intel Feeds]
  end

  user --> ext
  ext --> heur
  heur --> yara
  heur --> cache
  heur -->|alert if score >= threshold| ext

  ext -->|pull rules| cdn
  ext -->|pull bulletins| bulletin
  ext -->|submit reports| report
  admin -->|publish rules| cdn
  admin -->|publish bulletins| bulletin
  admin -->|review reports| report

  ext -. optional .-> whois
  ext -. optional .-> intel
```

> Local-first detection: all alerts can be generated without network access. Services are used asynchronously for updates and enrichment only.

## Key Constraints

### 🔐 Privacy Constraints
- **Zero PII Collection**: No user browsing history or personal data leaves the browser
- **Reproducible Reports**: Full URL and evidence required; no domain patterns
- **Local Processing**: All detection logic runs client-side

### 💰 Cost Constraints
- **CDN Pull**: Static rule packs, intel filters, and bulletins pulled via CDN; no push infra
- **Serverless APIs**: Report ingestion scales to zero; aggressive rate limiting and CAPTCHA
- **Delta Packs**: Support partial updates to minimize bandwidth

### 🎯 Technical Constraints
- **Manifest V3** and content script limits respected
- **Performance Budget**: < 50 ms average detection per page
- **Offline Capability**: Core detection works offline

## High-Level Architecture Vision
- Client performs detection with cached rules; explains findings and scores locally
- CI builds signed rule packs from sources including FeodoTracker, URLhaus, PhishTank
- CDN distributes packs and bulletins; clients poll with jitter
- Admin console verifies reports, publishes rules and bulletins under two-person control

## Core Design Principles
- Defense in Depth; Eventual Consistency; Fail-Safe Defaults; Evidence-Based Scoring; Reproducible Reports