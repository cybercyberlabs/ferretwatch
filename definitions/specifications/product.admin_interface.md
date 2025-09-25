---
layout: spec
title: Admin Interface Specification
description: Secure, privacy-preserving admin console for triaging reports, managing detection rules, and maintaining product health with minimal infrastructure cost
date: 2025-09-25
version: 1.0
toc: true
---
# 🛠️ Admin Interface Specification

## 1. Purpose & Scope
A secure, privacy-preserving console for administrators to triage reports, verify findings reproducibly, manage detection rules and bulletins, and maintain product health — all with minimal infrastructure cost.

## 2. Roles & Permissions (RBAC)
- Roles
  - **Viewer**: Read-only access to dashboards and audit logs
  - **Reviewer**: Triage reports, mark Verified/Rejected/Benign, propose rules
  - **Publisher**: Approve and publish rules and bulletins
  - **Admin**: Manage users, roles, policies, keys, rate limits
  - **Auditor**: Read audit logs and configuration histories, export compliance reports
- Principles
  - **Least privilege** by default; separation of duties between Reviewer and Publisher
  - **Two-person rule**: Publishing requires at least two distinct approvers
  - **Just-in-time elevation**: Time-boxed role elevation with reason and audit entry

## 3. Navigation & Modules
- Dashboard
  - Open items: untriaged reports, pending approvals, active bulletins, rule pack status
  - KPIs: verification rate, time-to-publish, false-positive rate, CDN propagation health
- Reports
  - Filters: status, score range, source, reason, domain, pack version, date
  - Bulk actions: merge duplicates, tag campaign, requeue for reproduce
  - Detail view: full URL, timestamp, score, findings, evidence snippets, pack versions
- Reproduce
  - One-click headless fetch under the same rule and intel pack versions
  - Artifacts: HTTP headers, HTML hash, DOM snapshot hash, outgoing request map
- Rules
  - Heuristics: weights, thresholds, allow/deny entries with expiry
  - YARA: rule editor with linting; attach tags and severity; test against samples
  - Packs: stage, canary, publish, rollback; pack diff and signature preview
- Bulletins (Active Campaign Notifications)
  - Create: scope (brands, eTLD+1, locales), severity, TTL, advisory text, safe links
  - Validate: preview matching examples and client render
  - Publish: signed JSON via CDN; schedule and auto-expiry
- Policies & Settings
  - Rate limiting: per-IP and per-install buckets; CAPTCHA policy thresholds
  - Feed pipeline status: FeodoTracker, URLhaus, PhishTank fetch health
  - Keys: rotation status for signing keys; access logs; IP allowlists
- Audit & Exports
  - Immutable audit timeline; CSV/JSON export; signed snapshots for compliance

## 4. Core Workflows

### 4.1 Report Triage → Verification → Decision
...