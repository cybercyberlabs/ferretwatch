// Chrome compatibility layer
if (typeof importScripts !== 'undefined') {
    importScripts('utils/browser-compat.js');
}

/**
 * Simplified and robust content script for credential scanning
 * This version focuses on working functionality without complex dependencies
 */

(function() {
    'use strict';
    
    // Track seen credentials to avoid repeat notifications
    let seenCredentials = new Set();
    let notificationDismissed = false;
    
    // Store last scan results for export functionality
    let lastScanResults = [];
    
    // Domain whitelist management
    let whitelistedDomains = [];
    let currentDomain = window.location.hostname;
    
    // Load whitelist from storage
    async function loadWhitelist() {
        try {
            console.log('🔧 Debug: Loading whitelist from storage');
            if (typeof browser !== 'undefined' && browser.storage) {
                const result = await browser.storage.local.get(['whitelistedDomains']);
                whitelistedDomains = result.whitelistedDomains || [];
                console.log('🔧 Debug: Loaded whitelist:', whitelistedDomains);
            } else {
                console.log('🔧 Debug: browser.storage not available');
                whitelistedDomains = [];
            }
        } catch (error) {
            console.log('🔧 Debug: loadWhitelist error:', error);
            console.log('FerretWatch: Could not load whitelist, using empty list');
            whitelistedDomains = [];
        }
    }
    
    // Check if current domain is whitelisted (disabled)
    function isDomainWhitelisted() {
        return whitelistedDomains.some(domain => {
            // Support both exact matches and subdomain matches
            if (domain.startsWith('*.')) {
                // Wildcard subdomain (e.g., *.example.com)
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            } else {
                // Exact domain match
                return currentDomain === domain;
            }
        });
    }
    
    // Robust fallback patterns that definitely work
    const DETECTION_PATTERNS = [
        // AWS
        { regex: /AKIA[0-9A-Z]{16}/gi, type: "AWS Access Key ID", risk: "high" },
        { regex: /aws_secret_access_key\s*[:=]\s*['"]?([A-Za-z0-9\/+=]{40})['"]?/gi, type: "AWS Secret Access Key", risk: "critical" },
        
        // GitHub
        { regex: /ghp_[a-zA-Z0-9]{36}/gi, type: "GitHub Personal Access Token", risk: "high" },
        { regex: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/gi, type: "GitHub Fine-grained Token", risk: "high" },
        
        // Generic API keys
        { regex: /(?:api[_\-]?key|access[_\-]?token|secret[_\-]?key|auth[_\-]?token)\s*[:=]\s*['"]([a-zA-Z0-9_\-.]{16,})['""]/gi, type: "API Key", risk: "medium" },
        
        // Database connections
        { regex: /(?:mongodb|mysql|postgres|postgresql|redis):\/\/[^"\s]+/gi, type: "Database Connection String", risk: "critical" },
        
        // Bearer tokens
        { regex: /authorization:\s*bearer\s+([A-Za-z0-9\-_\.=\/\+]{20,})/gi, type: "Bearer Token", risk: "high" },
        
        // JWT tokens
        { regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, type: "JWT Token", risk: "medium" },
        
        // SSH keys
        { regex: /-----BEGIN\s+(?:RSA\s+|DSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi, type: "SSH Private Key", risk: "critical" },
        
        // Google API keys
        { regex: /AIza[0-9A-Za-z\-_]{35}/gi, type: "Google API Key", risk: "medium" },
        
        // Stripe keys
        { regex: /(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}/gi, type: "Stripe API Key", risk: "high" },
        
        // Basic passwords
        { regex: /password\s*[:=]\s*['"]([a-zA-Z0-9_\-\.@]{8,})['""]/gi, type: "Password", risk: "high" },
        
        // Slack tokens
        { regex: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/gi, type: "Slack Bot Token", risk: "high" },
        
        // Discord tokens
        { regex: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/gi, type: "Discord Bot Token", risk: "high" }
    ];
    
    // Simple false positive detection
    function isLikelyFalsePositive(match) {
        if (!match || match.length < 8) return true;
        
        const lowerMatch = match.toLowerCase();
        
        // Common false positives
        const falsePositives = [
            'your_api_key', 'your_secret', 'example_key', 'test_key', 'demo_key',
            'placeholder', 'sample_token', 'dummy_key', 'fake_secret',
            'xxxxxxxx', 'aaaaaaaa', '12345678', 'password123'
        ];
        
        return falsePositives.some(fp => lowerMatch.includes(fp));
    }
    
    // Get risk color
    function getRiskColor(risk) {
        const colors = {
            critical: '#d32f2f',
            high: '#f57c00', 
            medium: '#7b1fa2',
            low: '#388e3c'
        };
        return colors[risk] || colors.medium;
    }
    
    // Mask sensitive data
    function maskSecret(secret) {
        if (!secret || secret.length < 8) return '***';
        return secret.slice(0, 4) + '...' + secret.slice(-4);
    }
    
    // Show notification
    function showNotification(message, risk = 'medium') {
        // Remove any existing notifications first
        const existing = document.querySelectorAll('.cyber-labs-credential-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'cyber-labs-credential-notification';
        notification.innerHTML = message;
        
        // Styling
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
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.remove();
            notificationDismissed = true; // Mark that user dismissed notifications for this page
        });
        
        // Auto dismiss after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
        
        document.body.appendChild(notification);
    }
    
    // Main scanning function
    function scanForCredentials() {
        // Get page content
        const content = document.documentElement.innerHTML;
        let findings = [];
        
        // Scan with each pattern
        DETECTION_PATTERNS.forEach(pattern => {
            try {
                let matches = content.match(pattern.regex);
                if (matches) {
                    matches.forEach(match => {
                        // Clean up the match
                        let cleanMatch = match.trim();
                        
                        // Extract actual secret value for some patterns
                        if (pattern.regex.source.includes('[:=]')) {
                            const valueMatch = match.match(/[:=]\s*['"]?([^'"]+)['"]?/);
                            if (valueMatch && valueMatch[1]) {
                                cleanMatch = valueMatch[1];
                            }
                        }
                        
                        // Skip false positives
                        if (!isLikelyFalsePositive(cleanMatch)) {
                            findings.push({
                                type: pattern.type,
                                value: cleanMatch,
                                risk: pattern.risk,
                                context: match
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error processing pattern:', pattern.type, error);
            }
        });
        
        // Remove duplicates
        const uniqueFindings = [];
        const seen = new Set();
        findings.forEach(finding => {
            const key = finding.type + '|' + finding.value;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueFindings.push(finding);
            }
        });

        // Store findings for export functionality
        lastScanResults = uniqueFindings.map(finding => ({
            type: finding.type,
            value: finding.value,
            risk: finding.risk,
            context: finding.context,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            domain: window.location.hostname
        }));
        
        // Report results
        if (uniqueFindings.length > 0) {
            console.log(`%c🚨 Found ${uniqueFindings.length} potential credential${uniqueFindings.length > 1 ? 's' : ''}!`, 
                "color: red; font-weight: bold; font-size: 16px;");
            
            // Log each finding safely
            uniqueFindings.forEach((finding, index) => {
                console.log(`%c${index + 1}. ${finding.type}`, 
                    `color: ${getRiskColor(finding.risk)}; font-weight: bold;`);
                console.log(`   Value: ${maskSecret(finding.value)} (Risk: ${finding.risk.toUpperCase()})`);
                console.log(`   Context: ${finding.context.substring(0, 100)}...`);
            });
            
            // Check if we have any new credentials not seen before
            const newFindings = uniqueFindings.filter(finding => {
                const key = finding.type + '|' + finding.value;
                return !seenCredentials.has(key);
            });
            
            // Add all findings to seen set
            uniqueFindings.forEach(finding => {
                const key = finding.type + '|' + finding.value;
                seenCredentials.add(key);
            });
            
            // Only show notification if:
            // 1. We have new credentials, OR
            // 2. User hasn't dismissed notifications yet
            if (newFindings.length > 0 || !notificationDismissed) {
                // Determine highest risk level
                const riskLevels = ['low', 'medium', 'high', 'critical'];
                const highestRisk = uniqueFindings.reduce((highest, finding) => {
                    const currentIndex = riskLevels.indexOf(finding.risk);
                    const highestIndex = riskLevels.indexOf(highest);
                    return currentIndex > highestIndex ? finding.risk : highest;
                }, 'low');
                
                const findingsToShow = newFindings.length > 0 ? newFindings : uniqueFindings;
                const notificationPrefix = newFindings.length > 0 ? 
                    `🆕 Found ${newFindings.length} new credential${newFindings.length > 1 ? 's' : ''}` :
                    `🚨 Found ${uniqueFindings.length} potential credential${uniqueFindings.length > 1 ? 's' : ''}`;
                
                // Show notification
                const displayFindings = findingsToShow.slice(0, 3).map(f => 
                    `<div style="margin: 4px 0;"><strong>${f.type}:</strong> ${maskSecret(f.value)}</div>`
                ).join('');
                
                const more = findingsToShow.length > 3 ? 
                    `<div style="margin: 8px 0; font-style: italic;">...and ${findingsToShow.length - 3} more</div>` : '';
                
                showNotification(
                    `<div style="font-weight: bold; margin-bottom: 8px;">${notificationPrefix}</div>` +
                    displayFindings + more +
                    `<div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">Click to dismiss • Check console for details</div>`,
                    highestRisk
                );
            } else {
                console.log("%c🔕 Same credentials found (notification dismissed - check console for details)", 
                    "color: orange; font-weight: bold;");
            }
            
        } else {
            console.log("%c✅ No credentials found on this page.", 
                "color: green; font-weight: bold; font-size: 14px;");
        }
        
        return uniqueFindings;
    }
    
    // Initialize scanner
    async function initializeScanner() {
        try {
            // Load whitelist first
            await loadWhitelist();
            
            // Check if domain is whitelisted
            if (isDomainWhitelisted()) {
                console.log('🔕 FerretWatch disabled for domain:', currentDomain);
                return;
            }
            
            console.log('🔍 FerretWatch Auto-scanning for credentials...');
            
            // Scan immediately
            scanForCredentials();
            
            // Optional: Set up very conservative mutation observer for dynamic content
            // Only enable if absolutely needed and with strict throttling
            const enableDynamicScanning = false; // Disabled by default to save CPU
            
            if (enableDynamicScanning) {
                let lastScanTime = Date.now();
                const MIN_SCAN_INTERVAL = 30000; // Minimum 30 seconds between scans
                let significantChanges = 0;
                
                const observer = new MutationObserver((mutations) => {
                    // Only consider significant mutations
                    const significantMutation = mutations.some(mutation => {
                        // Ignore style/class changes and small text changes
                        if (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                            return false;
                        }
                        
                        // Only count additions of substantial content
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            return Array.from(mutation.addedNodes).some(node => {
                                return node.nodeType === Node.ELEMENT_NODE && 
                                       node.textContent && 
                                       node.textContent.length > 50; // Only substantial content
                            });
                        }
                        
                        return false;
                    });
                    
                    if (significantMutation) {
                        significantChanges++;
                        
                        // Only rescan if enough time has passed AND we have significant changes
                        const now = Date.now();
                        if (now - lastScanTime > MIN_SCAN_INTERVAL && significantChanges >= 3) {
                            clearTimeout(window.cyberlabsRescanTimer);
                            window.cyberlabsRescanTimer = setTimeout(() => {
                                console.log("🔄 Rescanning due to significant page changes...");
                                scanForCredentials();
                                lastScanTime = Date.now();
                                significantChanges = 0;
                            }, 5000); // 5 second delay after significant changes
                        }
                    }
                });
                
                // Much more conservative observation - only major DOM changes
                observer.observe(document.body, {
                    childList: true,
                    subtree: false, // Don't observe deep changes to save CPU
                    attributes: false, // Ignore attribute changes
                    characterData: false // Ignore text changes
                });
                
                console.log("🔄 Dynamic scanning enabled (conservative mode)");
            } else {
                console.log("🔄 Dynamic scanning disabled - use browser action to manually rescan");
            }
            
        } catch (error) {
            console.error('FerretWatch initialization error:', error);
        }
    }
    
    // Start scanning when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScanner);
    } else {
        // DOM already loaded
        setTimeout(initializeScanner, 100);
    }
    
    // Simple popup communication (if needed)
    if (typeof browser !== 'undefined') {
        browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
            console.log('🔧 Debug: Content script received message:', message);
            
            if (message.action === 'rescan') {
                console.log('🔧 Debug: Processing rescan request');
                // Check whitelist before rescanning
                await loadWhitelist();
                if (isDomainWhitelisted()) {
                    sendResponse({ success: false, error: 'Domain is whitelisted' });
                    return;
                }
                
                // Reset notification dismissed state for manual rescans
                notificationDismissed = false;
                
                const results = scanForCredentials();
                sendResponse({ success: true, findings: results });
            } else if (message.action === 'addToWhitelist') {
                console.log('🔧 Debug: Processing addToWhitelist request');
                try {
                    await loadWhitelist();
                    const domain = message.domain || currentDomain;
                    const includeSubdomains = message.includeSubdomains || false;
                    
                    const domainToAdd = includeSubdomains ? '*.' + domain : domain;
                    
                    if (!whitelistedDomains.includes(domainToAdd)) {
                        whitelistedDomains.push(domainToAdd);
                        await browser.storage.local.set({ whitelistedDomains });
                        console.log('🔕 Domain added to whitelist:', domainToAdd);
                    }
                    
                    sendResponse({ success: true, domain: domainToAdd });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            } else if (message.action === 'removeFromWhitelist') {
                console.log('🔧 Debug: Processing removeFromWhitelist request');
                try {
                    await loadWhitelist();
                    const domain = message.domain;
                    
                    whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
                    await browser.storage.local.set({ whitelistedDomains });
                    console.log('✅ Domain removed from whitelist:', domain);
                    
                    sendResponse({ success: true });
                } catch (error) {
                    console.log('🔧 Debug: removeFromWhitelist error:', error);
                    sendResponse({ success: false, error: error.message });
                }
            } else if (message.action === 'getWhitelist') {
                console.log('🔧 Debug: Processing getWhitelist request');
                await loadWhitelist();
                const response = { 
                    success: true, 
                    whitelist: whitelistedDomains,
                    currentDomain: currentDomain,
                    isWhitelisted: isDomainWhitelisted()
                };
                console.log('🔧 Debug: getWhitelist response:', response);
                sendResponse(response);
            } else if (message.action === 'getCurrentFindings') {
                console.log('🔧 Debug: Processing getCurrentFindings request');
                
                // Return the last scan results if available
                if (lastScanResults && lastScanResults.length > 0) {
                    sendResponse({ success: true, findings: lastScanResults });
                } else {
                    // No previous results, perform a fresh scan
                    const results = scanForCredentials();
                    sendResponse({ success: true, findings: results });
                }
            }
            return true;
        });
    }
    
})();
