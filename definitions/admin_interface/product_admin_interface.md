---
layout: spec
title: Admin Interface Specification
description: Secure, privacy-preserving admin console for triaging reports, managing detection rules, and maintaining product health with minimal infrastructure cost
date: 2025-09-25
version: 1.0
toc: true
---
# 🧭 Admin Interface Specification

## 1. Purpose & Scope
A secure, privacy‑preserving console for administrators to triage reports, verify findings reproducibly, manage detection rules and bulletins, and maintain product health — all with minimal infrastructure cost.

## 2. Roles & Permissions (RBAC)
- Roles
  - Viewer: Read-only; dashboards and audit logs
  - Reviewer: Triage reports; mark Verified/Rejected/Benign; propose rules
  - Publisher: Approve and publish rules and bulletins
  - Admin: Manage users, roles, policies, keys, rate limits
  - Auditor: Read audit logs; export compliance data

- Principles
  - Least privilege; two-person rule for publishing; just-in-time elevation with audit trail

## 3. Navigation & Modules
- Dashboard; Reports; Reproduce; Rules; Bulletins; Policies & Settings; Audit & Exports
- Each module supports filtering, search, and per-item detail with evidence

## 4. Core Workflows
- Report Triage, Verification, and Decision (with reproduce)
- Rule Authoring & Publication
- Active Campaign Bulletins
- Auditing & Exports

## 5. Security Requirements
- SSO + MFA; RBAC enforcement; signed packs; immutable audit logs
- CSP, CSRF protection; endpoint rate limits; admin secure endpoints

## 6. Privacy & Compliance
- No user PII; private admin actions; sign‑verified rule packs
- Reproduction runner with sandboxed fetch; no remote content leakage

## 7. Performance & Reliability
- Response-time budgets for admin actions; failover and rollbacks

## 8. Monitoring & Alerts
- Admin action auditing; pack publication health; CDN propagation checks

## 9. Access & Rotation
- Keys rotation; signing keys stored securely; access controlled by SSO

## 10. Audit & Exports
- Immutable logs; exportable audits; data retention policies
