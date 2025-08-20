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

    function buildNotificationContent(container, content, risk) {
        // Create title
        const title = document.createElement('div');
        title.style.cssText = 'text-align: center; font-weight: bold; margin-bottom: 12px; font-size: 15px; color: white;';
        title.textContent = `${content.emoji} ${content.title}`;
        container.appendChild(title);
        
        // Create findings
        if (content.findings && content.findings.length > 0) {
            content.findings.forEach(finding => {
                const findingDiv = document.createElement('div');
                findingDiv.style.cssText = 'margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; border-left: 3px solid ' + getRiskColor(finding.riskLevel || 'medium') + ';';
                
                // Finding header
                const header = document.createElement('div');
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';
                
                const typeSpan = document.createElement('span');
                typeSpan.style.cssText = 'font-weight: bold; font-size: 13px;';
                typeSpan.textContent = finding.type;
                header.appendChild(typeSpan);
                
                const badgeSpan = document.createElement('span');
                badgeSpan.style.cssText = `background: ${getRiskColor(finding.riskLevel || 'medium')}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: bold;`;
                badgeSpan.textContent = (finding.riskLevel || 'unknown').toUpperCase();
                header.appendChild(badgeSpan);
                
                findingDiv.appendChild(header);
                
                // Finding value
                const valueDiv = document.createElement('div');
                valueDiv.style.cssText = 'font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.9);';
                valueDiv.textContent = maskSecret(finding.value);
                findingDiv.appendChild(valueDiv);
                
                // Finding context
                if (finding.context && finding.context.trim() !== '' && finding.context !== 'N/A') {
                    const contextDiv = document.createElement('div');
                    contextDiv.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; font-style: italic;';
                    contextDiv.textContent = `"${finding.context.substring(0, 50)}${finding.context.length > 50 ? '...' : ''}"`;
                    findingDiv.appendChild(contextDiv);
                }
                
                container.appendChild(findingDiv);
            });
        }
        
        // More findings indicator
        if (content.moreCount > 0) {
            const moreDiv = document.createElement('div');
            moreDiv.style.cssText = 'margin: 8px 0; padding: 6px; text-align: center; font-style: italic; color: rgba(255,255,255,0.8); border-top: 1px solid rgba(255,255,255,0.2);';
            moreDiv.textContent = `📊 +${content.moreCount} more credential${content.moreCount > 1 ? 's' : ''} found`;
            container.appendChild(moreDiv);
        }
        
        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 11px; color: rgba(255,255,255,0.8); text-align: center;';
        footer.textContent = '💡 Click to dismiss • Check browser console for full details';
        container.appendChild(footer);
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

    function getDarkerRiskColor(risk) {
        const colors = {
            critical: '#b71c1c',
            high: '#e65100', 
            medium: '#4a148c',
            low: '#1b5e20'
        };
        return colors[risk] || colors.medium;
    }

    function maskSecret(secret) {
        if (!secret || secret.length < 8) return '***';
        return secret.slice(0, 4) + '...' + secret.slice(-4);
    }

    function showNotification(content, risk = 'medium') {
        const existing = document.querySelectorAll('.cyber-labs-credential-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'cyber-labs-credential-notification';
        
        // Handle both string and object content
        if (typeof content === 'string') {
            notification.textContent = content;
        } else if (content && typeof content === 'object') {
            // Build notification DOM structure
            buildNotificationContent(notification, content, risk);
        }
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: `linear-gradient(135deg, ${getRiskColor(risk)}, ${getDarkerRiskColor(risk)})`,
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            zIndex: '10000',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)',
            maxWidth: '420px',
            minWidth: '320px',
            fontSize: '13px',
            lineHeight: '1.5',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            animation: 'slideInRight 0.3s ease-out'
        });
        
        // Add CSS animation keyframes
        if (!document.getElementById('ferretwatch-animations')) {
            const style = document.createElement('style');
            style.id = 'ferretwatch-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                .cyber-labs-credential-notification:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.3) !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
            notificationDismissed = true;
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
                setTimeout(() => {
                    if (notification.parentNode) notification.remove();
                }, 300);
            }
        }, 12000);
        
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
        
        // Update the global window reference
        window.lastScanResults = lastScanResults;

        if (findings.length === 0) {
            console.log("%c✅ No credentials found on this page.", "color: green; font-weight: bold;");
            return;
        }

        // Enhanced console output with better formatting
        console.log(`%c🚨 FERRETWATCH SECURITY SCAN RESULTS 🚨`, "color: white; background: #d32f2f; font-weight: bold; padding: 8px; border-radius: 4px; font-size: 16px;");
        console.log(`%c📍 Domain: ${window.location.hostname}`, "color: #1976d2; font-weight: bold;");
        console.log(`%c🔍 Found ${findings.length} potential credential${findings.length > 1 ? 's' : ''}`, "color: #d32f2f; font-weight: bold; font-size: 14px;");
        console.log("%c" + "═".repeat(80), "color: #666;");

        findings.forEach((finding, index) => {
            const riskLevel = finding.riskLevel || 'unknown';
            const riskColor = getRiskColor(riskLevel);
            const riskEmoji = {
                critical: '🔥',
                high: '⚠️',
                medium: '📋',
                low: '📝',
                unknown: '❓'
            }[riskLevel] || '❓';
            
            console.log(`%c${riskEmoji} FINDING #${index + 1}`, `color: white; background: ${riskColor}; font-weight: bold; padding: 4px 8px; border-radius: 3px;`);
            console.log(`%c   📝 Type: ${finding.type}`, "color: #333; font-weight: bold;");
            console.log(`%c   🔐 Value: ${maskSecret(finding.value)}`, "color: #666;");
            console.log(`%c   ⚡ Risk: ${riskLevel.toUpperCase()}`, `color: ${riskColor}; font-weight: bold;`);
            
            if (finding.context && finding.context.trim() !== '' && finding.context !== 'N/A') {
                console.log(`%c   📍 Context: "${finding.context.substring(0, 120)}${finding.context.length > 120 ? '...' : ''}"`, "color: #795548; font-style: italic;");
            } else {
                console.log(`%c   📍 Context: Not available`, "color: #999; font-style: italic;");
            }
            console.log("%c" + "─".repeat(60), "color: #ddd;");
        });

        const newFindings = findings.filter(f => !seenCredentials.has(f.type + '|' + f.value));
        findings.forEach(f => seenCredentials.add(f.type + '|' + f.value));

        if (newFindings.length > 0 || !notificationDismissed) {
            const highestRisk = findings.reduce((highest, f) => {
                const riskLevels = ['low', 'medium', 'high', 'critical'];
                const currentRisk = f.riskLevel || 'unknown';
                const currentIndex = riskLevels.indexOf(currentRisk);
                const highestIndex = riskLevels.indexOf(highest);
                return currentIndex > highestIndex ? currentRisk : highest;
            }, 'low');
            
            // Enhanced notification with better visual structure
            const riskEmoji = {
                critical: '🔥',
                high: '⚠️',
                medium: '📋',
                low: '📝',
                unknown: '❓'
            }[highestRisk] || '📋';
            
            const notificationTitle = newFindings.length > 0 ? 
                `🆕 ${newFindings.length} New Credential${newFindings.length > 1 ? 's' : ''} Found` : 
                `🚨 ${findings.length} Credential${findings.length > 1 ? 's' : ''} Detected`;
            
            const displayFindings = (newFindings.length > 0 ? newFindings : findings).slice(0, 3);
            const moreCount = findings.length > 3 ? findings.length - 3 : 0;

            showNotification(
                {
                    emoji: riskEmoji,
                    title: notificationTitle,
                    findings: displayFindings,
                    moreCount: moreCount
                },
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
            await loadSettings(); // Load settings into cache
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
                return true;
            } else if (message.action === 'getCurrentFindings') {
                const resultsToSend = lastScanResults.length > 0 ? lastScanResults : (window.lastScanResults || []);
                sendResponse({ success: true, findings: resultsToSend });
                return true;
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
                return true;
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
                return true;
            } else if (message.action === 'getWhitelist') {
                await loadWhitelist();
                sendResponse({
                    success: true, 
                    whitelist: whitelistedDomains,
                    currentDomain: currentDomain,
                    isWhitelisted: isDomainWhitelisted()
                });
                return true;
            }
            return true;
        });
    }

    // --- Expose globals for testing and debugging ---
    window.ProgressiveScanner = ProgressiveScanner;
    window.SECURITY_PATTERNS = window.SECURITY_PATTERNS; // Already loaded from patterns.js
    // Settings cache for synchronous access
    let settingsCache = {
        maxFindings: 50,
        scanningMode: 'progressive', 
        scanDelay: 500,
        enableDebounce: true,
        enabledCategories: {
            aws: true,
            github: true,
            slack: true,
            discord: true,
            apiKeys: true,
            azure: true,
            gcp: true,
            jwt: true,
            services: true,
            passwords: true,
            keys_and_certificates: true,
            database: true,
            environment: true
        }
    };

    // Load settings into cache
    async function loadSettings() {
        try {
            const result = await browser.storage.local.get(['userSettings']);
            if (result.userSettings) {
                settingsCache = { ...settingsCache, ...result.userSettings };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    window.StorageUtils = {
        get: async (key) => {
            const result = await browser.storage.local.get([key]);
            return result[key] || null;
        },
        set: async (key, value) => {
            await browser.storage.local.set({[key]: value});
        },
        remove: async (key) => {
            await browser.storage.local.remove([key]);
        },
        isDomainWhitelisted: (domain = null) => {
            const targetDomain = domain || currentDomain;
            return whitelistedDomains.some(d => {
                if (d.startsWith('*.')) {
                    const baseDomain = d.substring(2);
                    return targetDomain === baseDomain || targetDomain.endsWith('.' + baseDomain);
                } else {
                    return targetDomain === d;
                }
            });
        },
        getSetting: (key, defaultValue = null) => {
            return settingsCache[key] !== undefined ? settingsCache[key] : defaultValue;
        },
        isCategoryEnabled: (category) => {
            const enabledCategories = settingsCache.enabledCategories || {};
            return enabledCategories[category] !== false; // Default to enabled
        }
    };
    
    
    window.FerretWatchDebug = {
        version: '2.1.0',
        scanCurrentPage: async () => {
            const findings = await runScan();
            return findings;
        },
        getLastScanResults: () => {
            return lastScanResults;
        }
    };
    
    // Expose scanner instance and results for fallback access
    window.scanner = scanner;
    window.lastScanResults = lastScanResults;
})();
