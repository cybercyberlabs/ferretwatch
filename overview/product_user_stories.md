---
layout: default
title: User Stories
parent: Overview
nav_order: 3
description: Comprehensive user stories covering core detection, reporting, and admin functionality for FerretWatch Enhanced
---
# 📋 User Stories

## Core Detection Stories

### FW-001: Homograph Attack Detection
**As a** 🧑d busy professional  
**I want** the extension to detect when a domain uses lookalike characters (e.g., paypaI.com instead of paypal.com)  
**So that** I don't enter my credentials on convincing fake sites

**Acceptance Criteria:**
- Given I visit a page with a domain containing homograph characters that resemble a known legitimate domain
- When the page loads
- Then the extension should alert me with a high-priority warning showing the legitimate domain it's impersonating

### FW-002: New Domain Detection
**As a** 👴 retiree managing finances online  
**I want** to be warned when visiting recently registered domains  
**So that** I can be extra cautious with new, potentially malicious sites

**Acceptance Criteria:**
- Given I visit a domain registered within the last 30 days
- When the domain age check completes
- Then I should see a medium-priority warning with the domain registration date in simple language

### FW-003: Password/Secret Detection (Existing Feature)
**As a** 👨d tech-savvy student  
**I want** to be alerted when a page contains exposed passwords or API keys  
**So that** I can avoid sites that might compromise my credentials

**Acceptance Criteria:**
- Given a webpage contains patterns matching passwords, API keys, or secrets
- When the page content is analyzed
- Then the extension should highlight the detected secrets and provide a detailed technical explanation

### FW-004: Image Hotlinking Detection
**As a** 🏢 small business owner  
**I want** to know when a site is hotlinking images from unrelated domains  
**So that** I can identify potentially fraudulent sites mimicking legitimate businesses

**Acceptance Criteria:**
- Given a webpage loads images from domains that aren't subdomains of the current site
- When the image sources are analyzed
- Then the extension should flag suspicious hotlinking patterns and show which legitimate sites the images are from

### FW-005: Phishing Pattern Detection via YARA Rules
**As a** 🧑d professional handling sensitive data  
**I want** the extension to check pages against updated YARA rules  
**So that** I'm protected against the latest phishing techniques

**Acceptance Criteria:**
- Given the extension has access to an external YARA rules service
- When I visit any webpage
- Then the page should be scanned against current rules and alert me to matches with threat details

## Scoring and Alert Stories

### FW-006: Threat Scoring System
**As a** 👴 non-technical user  
**I want** a simple overall safety score for each page  
**So that** I can quickly understand if a site is safe without technical details

**Acceptance Criteria:**
- Given multiple suspicious indicators are detected on a page
- When the scoring algorithm runs
- Then I should see a clear visual indicator (green/yellow/red) with a simple safety message

### FW-007: Customizable Alert Threshold
**As a** 👨d advanced user  
**I want** to adjust the sensitivity of alerts  
**So that** I can balance security with fewer false positives

**Acceptance Criteria:**
- Given I access the extension settings
- When I adjust the alert threshold slider
- Then the extension should only show warnings for pages exceeding my chosen score threshold

## Reporting Stories

### FW-008: Report Suspicious Page
**As a** 🏢 business owner who discovered a fake supplier site  
**I want** to report the suspicious page to help protect others  
**So that** the threat database can be updated quickly

**Acceptance Criteria:**
- Given I'm on a suspicious page
- When I click the "Report Page" button and select from predefined reasons
- Then the report should be sent to the central service with the full domain URL, timestamp, detection results, and my selected reason

### FW-009: Community Threat Intelligence
**As a** 🧑d security-conscious professional  
**I want** to benefit from pages reported by other users  
**So that** I'm protected from newly discovered threats

**Acceptance Criteria:**
- Given other users have reported a page as suspicious
- When I visit that page
- Then I should see a community warning with the number of reports and most common reasons

## User Experience Stories

### FW-010: Simple Warning Interface
**As a** 👴 retiree with basic tech skills  
**I want** clear, non-technical warnings  
**So that** I understand the danger without confusion

**Acceptance Criteria:**
- Given a threat is detected
- When the warning appears
- Then it should use simple language, clear icons, and provide a "Safe Site" alternative when possible

### FW-011: Detailed Threat Information
**As a** 👨d computer science student  
**I want** access to technical details about detected threats  
**So that** I can learn about security threats and verify detections

**Acceptance Criteria:**
- Given a threat is detected
- When I click "Show Details"
- Then I should see technical information including detection rules, scores, and evidence

### FW-012: Whitelist Trusted Sites
**As a** 🏢 business owner with known supplier portals  
**I want** to whitelist legitimate sites that trigger false positives  
**So that** my workflow isn't interrupted on trusted sites

**Acceptance Criteria:**
- Given I'm on a site I trust that shows warnings
- When I add it to my whitelist
- Then future visits should not show warnings unless new severe threats are detected

## Administrator Stories

### FW-013: Privacy-Preserving Rule Management
**As an** 🛡️ extension administrator  
**I want** to update detection rules without accessing user browsing data  
**So that** I can improve protection while maintaining user privacy

### etc.