/**
 * Refactored content script for credential scanning
 * This version uses the ProgressiveScanner for better performance.
 */

(function() {
    'use strict';
    
    // Global state
    let seenCredentials = new Set();

    // False positive validation for the scanner
    window.isValidSecret = function(match, patternConfig) {
        if (!match) return false;

        // Use the patterns from config/patterns.js
        if (window.FALSE_POSITIVE_PATTERNS) {
            for (const fpPattern of window.FALSE_POSITIVE_PATTERNS) {
                if (fpPattern.test(match)) {
                    return false; // It's a false positive
                }
            }
        }
        return true; // Likely a valid secret
    };
    let notificationDismissed = false;
    let lastScanResults = [];
    const scanner = new ProgressiveScanner();

    // Domain whitelist management
    let whitelistedDomains = [];
    let currentDomain = window.location.hostname;
    
    // Load whitelist from storage
    async function loadWhitelist() {
        try {
            if (typeof browser !== 'undefined' && browser.storage) {
                const result = await browser.storage.local.get(['whitelistedDomains']);
                whitelistedDomains = result.whitelistedDomains || [];
            }
        } catch (error) {
            console.log('FerretWatch: Could not load whitelist, using empty list');
            whitelistedDomains = [];
        }
    }
    
    // Check if current domain is whitelisted
    function isDomainWhitelisted() {
        return whitelistedDomains.some(domain => {
            if (domain.startsWith('*.')) {
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            } else {
                return currentDomain === domain;
            }
        });
    }

    // --- UI and Notification Functions ---

    function getRiskColor(risk) {
        const colors = {
            critical: '#d32f2f',
            high: '#f57c00', 
            medium: '#7b1fa2',
            low: '#388e3c'
        };
        return colors[risk] || colors.medium;
    }

    function maskSecret(secret) {
        if (!secret || secret.length < 8) return '***';
        return secret.slice(0, 4) + '...' + secret.slice(-4);
    }

    function showNotification(message, risk = 'medium') {
        const existing = document.querySelectorAll('.cyber-labs-credential-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'cyber-labs-credential-notification';
        notification.innerHTML = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: getRiskColor(risk),
            color: '#fff',
            padding: '15px 20px',
            borderRadius: '8px',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            fontSize: '14px',
            lineHeight: '1.4',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        });
        
        notification.addEventListener('click', () => {
            notification.remove();
            notificationDismissed = true;
        });
        
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 10000);
        
        document.body.appendChild(notification);
    }

    // --- Main Scanning and Processing Logic ---

    function processFindings(findings) {
        // Store for export
        lastScanResults = findings.map(finding => ({
            ...finding,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            domain: window.location.hostname
        }));

        if (findings.length === 0) {
            console.log("%c✅ No credentials found on this page.", "color: green; font-weight: bold;");
            return;
        }

        console.log(`%c🚨 Found ${findings.length} potential credential${findings.length > 1 ? 's' : ''}!`, "color: red; font-weight: bold;");
        findings.forEach((finding, index) => {
            console.log(`%c${index + 1}. ${finding.type}`, `color: ${getRiskColor(finding.riskLevel)}; font-weight: bold;`);
            console.log(`   Value: ${maskSecret(finding.value)} (Risk: ${finding.riskLevel.toUpperCase()})`);
            console.log(`   Context: ${finding.context ? finding.context.substring(0, 100) : 'N/A'}...`);
        });

        const newFindings = findings.filter(f => !seenCredentials.has(f.type + '|' + f.value));
        findings.forEach(f => seenCredentials.add(f.type + '|' + f.value));

        if (newFindings.length > 0 || !notificationDismissed) {
            const highestRisk = findings.reduce((highest, f) => {
                const riskLevels = ['low', 'medium', 'high', 'critical'];
                return riskLevels.indexOf(f.riskLevel) > riskLevels.indexOf(highest) ? f.riskLevel : highest;
            }, 'low');
            
            const notificationPrefix = newFindings.length > 0 ? `🆕 Found ${newFindings.length} new credential(s)` : `🚨 Found ${findings.length} potential credential(s)`;
            const displayFindings = (newFindings.length > 0 ? newFindings : findings).slice(0, 3).map(f =>
                `<div style="margin: 4px 0;"><strong>${f.type}:</strong> ${maskSecret(f.value)}</div>`
            ).join('');
            const more = findings.length > 3 ? `<div style="margin: 8px 0; font-style: italic;">...and ${findings.length - 3} more</div>` : '';

            showNotification(
                `<div style="font-weight: bold; margin-bottom: 8px;">${notificationPrefix}</div>` + displayFindings + more +
                `<div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">Click to dismiss • Check console for details</div>`,
                highestRisk
            );
        } else {
            console.log("%c🔕 Same credentials found (notification dismissed - check console for details)", "color: orange;");
        }
    }
    
    async function runScan() {
        // 1. Get patterns from the global scope (loaded from config/patterns.js)
        const allPatterns = [];
        for (const category in window.SECURITY_PATTERNS) {
            for (const key in window.SECURITY_PATTERNS[category]) {
                const patternConfig = window.SECURITY_PATTERNS[category][key];
                if (patternConfig.pattern) {
                    allPatterns.push({
                        regex: patternConfig.pattern,
                        type: patternConfig.description,
                        risk: patternConfig.riskLevel
                    });
                }
            }
        }

        // 2. Run the scan using the ProgressiveScanner
        const content = document.documentElement.innerHTML;
        const findings = await scanner.progressiveScan(content, allPatterns);

        // 3. Process the results
        processFindings(findings);
        return findings;
    }

    async function initializeScanner() {
        try {
            await loadWhitelist();
            if (isDomainWhitelisted()) {
                console.log('🔕 FerretWatch disabled for domain:', currentDomain);
                return;
            }
            
            console.log('🔍 FerretWatch Auto-scanning for credentials...');
            await runScan();

        } catch (error) {
            console.error('FerretWatch initialization error:', error);
        }
    }
    
    // Start scanning when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScanner);
    } else {
        setTimeout(initializeScanner, 100);
    }
    
    // --- Browser Message Listener ---
    if (typeof browser !== 'undefined') {
        browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
            if (message.action === 'rescan') {
                await loadWhitelist();
                if (isDomainWhitelisted()) {
                    sendResponse({ success: false, error: 'Domain is whitelisted' });
                    return true;
                }
                notificationDismissed = false;
                const results = await runScan();
                sendResponse({ success: true, findings: results });
            } else if (message.action === 'getCurrentFindings') {
                sendResponse({ success: true, findings: lastScanResults });
            }
            // Keep other message handlers for whitelist etc.
            else if (message.action === 'addToWhitelist') {
                try {
                    await loadWhitelist();
                    const domain = message.domain || currentDomain;
                    const includeSubdomains = message.includeSubdomains || false;
                    const domainToAdd = includeSubdomains ? '*.' + domain : domain;
                    if (!whitelistedDomains.includes(domainToAdd)) {
                        whitelistedDomains.push(domainToAdd);
                        await browser.storage.local.set({ whitelistedDomains });
                    }
                    sendResponse({ success: true, domain: domainToAdd });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            } else if (message.action === 'removeFromWhitelist') {
                try {
                    await loadWhitelist();
                    const domain = message.domain;
                    whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
                    await browser.storage.local.set({ whitelistedDomains });
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            } else if (message.action === 'getWhitelist') {
                await loadWhitelist();
                sendResponse({
                    success: true, 
                    whitelist: whitelistedDomains,
                    currentDomain: currentDomain,
                    isWhitelisted: isDomainWhitelisted()
                });
            }
            return true;
        });
    }
})();
