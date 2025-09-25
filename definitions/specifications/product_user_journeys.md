---
layout: spec
title: User Journeys
description: Detailed user journeys showing how different personas interact with FerretWatch Enhanced in various scenarios
date: 2025-09-25
version: 1.0
toc: true
---
# 🗺️ User Journeys

## Journey 1: Sarah's Close Call with a Phishing Attack

**Scenario**: Sarah receives an email appearing to be from LinkedIn about a connection request, containing a link to view the profile.

```mermaid
journey
    title Sarah's Phishing Protection Journey
    section Email Arrival
      Receives LinkedIn email: 5: Sarah
      Clicks profile link: 4: Sarah
    section FerretWatch Detection
      Extension detects homograph attack: 5: FerretWatch
      Shows warning - fake LinkedΙn.com: 5: FerretWatch
      Sarah sees clear danger message: 5: Sarah
    section Safe Resolution
      Closes fake site immediately: 5: Sarah
      Reports phishing attempt: 5: Sarah
      Checks real LinkedIn safely: 5: Sarah
```

**Journey Description**: Sarah starts her day checking emails (sentiment: 5/5). She sees what appears to be a LinkedIn connection request and clicks the link without suspicion (sentiment: 4/5). FerretWatch detects a homograph attack - 'LinkedΙn.com' with a Greek Iota. The extension shows a high-priority warning. Sarah closes the site, reports the page, and navigates safely to the real LinkedIn.

## Journey 2: Robert's Banking Security Check

**Scenario**: Robert needs to check his bank balance and types his bank's URL with a small typo.

```mermaid
journey
    title Robert's Safe Banking Journey
    section Accessing Bank Site
      Types bank URL with typo: 3: Robert
      Lands on suspicious domain: 2: Robert
    section Multiple Red Flags
      New domain warning appears: 4: FerretWatch
      Hotlinked bank images detected: 4: FerretWatch
      Simple red warning shown: 5: FerretWatch
    section Getting to Safety
      Reads "DANGER" message: 4: Robert
      Clicks "Go to Real Bank Site": 5: Robert
      Successfully checks balance: 5: Robert
```

**Journey Description**: Robert wants to check his bank balance online. He types the URL but makes a typo (sentiment: 3/5). He lands on a suspicious page (sentiment: 2/5).
FerretWatch detects multiple issues: domain registered recently, hotlinked images. It shows a simple warning. He follows the safe link and completes banking.

## Journey 3: Alex's Technical Investigation

**Scenario**: Alex's friend sends a Discord link to a 'free game giveaway' that seems suspicious.

```mermaid
journey
    title Alex's Threat Investigation Journey
    section Initial Suspicion
      Receives Discord link: 4: Alex
      Notices odd URL structure: 3: Alex
      Clicks to investigate: 4: Alex
    section Deep Analysis
      Multiple warnings appear: 5: FerretWatch
      Views technical details: 5: Alex
      Sees YARA rule matches: 5: Alex
      Identifies credential harvester: 5: Alex
    section Community Action
      Reports with technical details: 5: Alex
      Warns Discord server: 5: Alex
      Helps update detection rules: 5: Alex
```

**Journey Description**: Alex investigates suspicious Discord link; YARA matches; reports with technical notes; administrators update rules.

## Journey 4: Maria's Business Protection

**Scenario**: Maria receives an invoice email from a supplier with a link.

```mermaid
journey
    title Maria's Business Payment Protection
    section Supplier Email
      Receives invoice email: 5: Maria
      Clicks payment portal link: 4: Maria
    section Threat Detection
      Homograph warning appears: 5: FerretWatch
      Shows real supplier domain: 5: FerretWatch
      Maria recognizes deception: 4: Maria
    section Business Protection
      Avoids financial loss: 5: Maria
      Reports to other owners: 5: Maria
      Adds real site to whitelist: 5: Maria
      Trains staff on threat: 5: Maria
```

**Journey Description**: Maria almost paid scammers; she reports, shares warning, and whitelists the real portal.

## Journey 5: Administrator's Emergency Response

**Scenario**: A new phishing campaign emerges; rapid response.

```mermaid
journey
    title Admin Emergency Threat Response
    section Threat Discovery
      Security researcher reports campaign: 3: Admin
      Analyzes phishing kit patterns: 2: Admin
      Identifies unique markers: 3: Admin
    section Rule Development
      Creates new YARA rules: 4: Admin
      Tests against known samples: 4: Admin
      Submits for peer review: 4: Admin
    section Deployment
      Second admin approves: 5: Admin
      Rules pushed to all users: 5: Admin
      Monitors detection rates: 5: Admin
      Zero user data exposed: 5: Admin
```

**Journey Description**: Admin develops, reviews, and deploys rules with two-person approval; users protected quickly.