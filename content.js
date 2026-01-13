/**
 * Refactored content script for credential scanning
 * This version uses the ProgressiveScanner for better performance.
 */

(function () {
    'use strict';

    // Global state
    let seenCredentials = new Set();
    let interceptorInjected = false; // Track if we've already injected the interceptor

    // False positive validation for the scanner
    window.isValidSecret = function (match, patternConfig) {
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
                console.log('[FW Content] Whitelist loaded:', whitelistedDomains);
            }
        } catch (error) {
            console.log('[FW Content] Could not load whitelist, using empty list:', error);
            whitelistedDomains = [];
        }
    }

    // Check if current domain is whitelisted
    function isDomainWhitelisted() {
        // Check user whitelist only (no built-in whitelist - root causes fixed)
        const isWhitelisted = whitelistedDomains.some(domain => {
            if (domain.startsWith('*.')) {
                const baseDomain = domain.substring(2);
                return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain);
            } else {
                return currentDomain === domain;
            }
        });
        console.log(`[FW Content] Domain whitelist check for "${currentDomain}": ${isWhitelisted}`);
        return isWhitelisted;
    }

    // --- Network Interceptor Injection ---
    function injectInterceptor() {
        console.log('[FW Content] injectInterceptor() called');

        if (isDomainWhitelisted()) {
            console.log('[FW Content] Skipping interceptor injection - domain is whitelisted');
            return;
        }

        // Check if we've already injected in this content script instance
        if (interceptorInjected) {
            console.log('[FW Content] Interceptor already injected by this content script - skipping');
            return;
        }

        try {
            console.log('[FW Content] Creating interceptor script element...');
            const script = document.createElement('script');
            script.src = (typeof chrome !== 'undefined' ? chrome : browser).runtime.getURL('utils/network-interceptor.js');
            script.onload = function () {
                console.log('[FW Content] Interceptor script loaded and executed');
                this.remove();
            };
            script.onerror = function(e) {
                console.error('[FW Content] Interceptor script failed to load:', e);
            };
            (document.head || document.documentElement).appendChild(script);
            interceptorInjected = true; // Mark as injected
            console.log('[FW Content] Interceptor script element appended to DOM');
            debugLog('Network interceptor injected');
        } catch (e) {
            console.error('[FW Content] Failed to inject interceptor:', e);
        }
    }

    // --- Message Listener for Interceptor ---
    window.addEventListener('message', function (event) {
        if (event.source !== window) return;

        if (event.data && event.data.type === 'FERRETWATCH_API_CALL') {
            const apiCall = event.data.data;
            console.log(`[FW Content] API call received from interceptor: ${apiCall.method} ${apiCall.url}`);
            debugLog(`[Content] API call captured: ${apiCall.method} ${apiCall.url}`);
            // Send to background
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'API_CALL_CAPTURED',
                    data: apiCall
                }, response => {
                    if (chrome.runtime.lastError) {
                        console.error('[FW Content] Error sending to background:', chrome.runtime.lastError);
                    } else {
                        console.log('[FW Content] Message sent to background successfully');
                    }
                });
            } else if (typeof browser !== 'undefined' && browser.runtime) {
                browser.runtime.sendMessage({
                    type: 'API_CALL_CAPTURED',
                    data: apiCall
                }).then(() => {
                    console.log('[FW Content] Message sent to background successfully');
                }).catch(err => {
                    console.error('[FW Content] Error sending to background:', err);
                });
            }
        }
    });

    console.log('[FW Content] Message listener registered for window.postMessage');


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

                // Finding header with provider icon for bucket findings
                const header = document.createElement('div');
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';

                const typeContainer = document.createElement('div');
                typeContainer.style.cssText = 'display: flex; align-items: center; gap: 6px;';

                // Add provider icon for bucket findings
                if (finding.bucketInfo && finding.bucketInfo.provider) {
                    const providerIcon = document.createElement('span');
                    providerIcon.style.cssText = 'font-size: 14px;';
                    providerIcon.textContent = getBucketProviderIcon(finding.bucketInfo.provider);
                    typeContainer.appendChild(providerIcon);
                }

                const typeSpan = document.createElement('span');
                typeSpan.style.cssText = 'font-weight: bold; font-size: 13px;';
                typeSpan.textContent = finding.type;
                typeContainer.appendChild(typeSpan);

                header.appendChild(typeContainer);

                const badgeSpan = document.createElement('span');
                badgeSpan.style.cssText = `background: ${getRiskColor(finding.riskLevel || 'medium')}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: bold;`;
                badgeSpan.textContent = (finding.riskLevel || 'unknown').toUpperCase();
                header.appendChild(badgeSpan);

                findingDiv.appendChild(header);

                // Finding value with copy functionality for bucket URLs
                const valueDiv = document.createElement('div');
                valueDiv.style.cssText = 'font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.9); display: flex; justify-content: space-between; align-items: center;';

                const valueText = document.createElement('span');
                valueText.textContent = finding.value; // Show actual value without masking
                valueDiv.appendChild(valueText);

                // Add copy button for bucket URLs
                if (finding.bucketInfo) {
                    const copyBtn = document.createElement('button');
                    copyBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; margin-left: 8px;';
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.onclick = (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(finding.value).then(() => {
                            copyBtn.textContent = '✓ Copied';
                            setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
                        }).catch(() => {
                            copyBtn.textContent = '❌ Failed';
                            setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
                        });
                    };
                    valueDiv.appendChild(copyBtn);
                }

                findingDiv.appendChild(valueDiv);

                // Bucket-specific information
                if (finding.bucketInfo) {
                    const bucketInfoDiv = document.createElement('div');
                    bucketInfoDiv.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px;';

                    const providerText = `Provider: ${finding.bucketInfo.provider.toUpperCase()}`;
                    const accessText = finding.bucketInfo.accessible ? '🔓 Public Access' : '🔒 Access Denied';
                    const regionText = finding.bucketInfo.region ? ` | Region: ${finding.bucketInfo.region}` : '';

                    bucketInfoDiv.textContent = `${providerText} | ${accessText}${regionText}`;
                    findingDiv.appendChild(bucketInfoDiv);
                }

                // Finding context (for non-bucket findings)
                else if (finding.context && finding.context.trim() !== '' && finding.context !== 'N/A') {
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

    // Debug logging utility
    function debugLog(message, ...args) {
        if (window.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`[Content Debug] ${message}`, ...args);
        }
    }

    // Info logging for important discoveries
    function infoLog(message, ...args) {
        console.log(`[FerretWatch] ${message}`, ...args);
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

    function getBucketProviderIcon(provider) {
        const icons = {
            aws: '☁️',
            gcp: '🌐',
            azure: '🔷',
            digitalocean: '🌊',
            alibaba: '🏮'
        };
        return icons[provider] || '☁️';
    }

    // Masking removed - showing actual values for security analysis

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
            infoLog("✅ No security issues found on this page.");
            return;
        }

        // Separate bucket findings from regular findings
        const bucketFindings = findings.filter(f => f.bucketInfo);
        const regularFindings = findings.filter(f => !f.bucketInfo);

        // Summary log for normal mode with actual findings
        const criticalCount = findings.filter(f => f.riskLevel === 'critical').length;
        const highCount = findings.filter(f => f.riskLevel === 'high').length;
        const mediumCount = findings.filter(f => f.riskLevel === 'medium').length;

        // Show summary with counts
        if (criticalCount > 0 || highCount > 0) {
            infoLog(`🚨 SECURITY ALERT: Found ${criticalCount + highCount} high-risk issue(s) on ${window.location.hostname}`);
        } else if (mediumCount > 0) {
            infoLog(`⚠️ Found ${mediumCount} medium-risk issue(s) on ${window.location.hostname}`);
        } else {
            infoLog(`ℹ️ Found ${findings.length} low-risk issue(s) on ${window.location.hostname}`);
        }

        // Show actual findings (always visible for important discoveries)
        const importantFindings = findings.filter(f => ['critical', 'high', 'medium'].includes(f.riskLevel));
        importantFindings.forEach((finding, index) => {
            const riskEmoji = {
                critical: '🔥',
                high: '🚨',
                medium: '⚠️',
                low: 'ℹ️'
            }[finding.riskLevel] || '❓';

            if (finding.bucketInfo) {
                // Bucket finding
                const accessStatus = finding.bucketInfo.testResults?.listingEnabled ? 'PUBLIC LISTING' :
                    finding.bucketInfo.testResults?.accessible ? 'ACCESSIBLE' : 'SECURED';
                infoLog(`${riskEmoji} ${finding.type}: ${finding.fullUrl || finding.value} (${accessStatus})`);
            } else {
                // Regular credential finding
                infoLog(`${riskEmoji} ${finding.type}: ${finding.value}`);
            }
        });

        // Show low-risk findings in debug mode with values
        const lowRiskFindings = findings.filter(f => f.riskLevel === 'low');
        if (lowRiskFindings.length > 0) {
            debugLog(`Found ${lowRiskFindings.length} low-risk findings:`);
            lowRiskFindings.forEach(finding => {
                if (finding.bucketInfo) {
                    debugLog(`  ℹ️ ${finding.type}: ${finding.fullUrl || finding.value} (SECURED)`);
                } else {
                    debugLog(`  ℹ️ ${finding.type}: ${finding.value}`);
                }
            });
        }

        // Detailed output only in debug mode
        if (window.StorageUtils?.getSetting('debugMode', false)) {
            console.log(`%c🚨 FERRETWATCH SECURITY SCAN RESULTS 🚨`, "color: white; background: #d32f2f; font-weight: bold; padding: 8px; border-radius: 4px; font-size: 16px;");
            console.log(`%c📍 Domain: ${window.location.hostname}`, "color: #1976d2; font-weight: bold;");
            console.log(`%c🔍 Found ${findings.length} potential security issue${findings.length > 1 ? 's' : ''}`, "color: #d32f2f; font-weight: bold; font-size: 14px;");

            if (bucketFindings.length > 0) {
                console.log(`%c☁️ Cloud Buckets: ${bucketFindings.length} found`, "color: #ff9800; font-weight: bold;");
            }
            if (regularFindings.length > 0) {
                console.log(`%c🔐 Credentials: ${regularFindings.length} found`, "color: #d32f2f; font-weight: bold;");
            }

            console.log("%c" + "═".repeat(80), "color: #666;");
        }

        // Detailed findings output only in debug mode
        if (window.StorageUtils?.getSetting('debugMode', false)) {
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

                if (finding.bucketInfo) {
                    console.log(`%c   ☁️ Bucket: ${finding.value}`, "color: #666;");
                    console.log(`%c   🏢 Provider: ${finding.bucketInfo.provider.toUpperCase()}`, "color: #666;");
                    console.log(`%c   🔓 Access: ${finding.bucketInfo.accessible ? 'Public' : 'Denied'}`, `color: ${finding.bucketInfo.accessible ? '#d32f2f' : '#388e3c'};`);
                    if (finding.bucketInfo.region) {
                        console.log(`%c   🌍 Region: ${finding.bucketInfo.region}`, "color: #666;");
                    }
                } else {
                    console.log(`%c   🔐 Value: ${finding.value}`, "color: #666;");
                }

                console.log(`%c   ⚡ Risk: ${riskLevel.toUpperCase()}`, `color: ${riskColor}; font-weight: bold;`);

                if (finding.context && finding.context.trim() !== '' && finding.context !== 'N/A') {
                    console.log(`%c   📍 Context: "${finding.context.substring(0, 120)}${finding.context.length > 120 ? '...' : ''}"`, "color: #795548; font-style: italic;");
                } else {
                    console.log(`%c   📍 Context: Not available`, "color: #999; font-style: italic;");
                }
                console.log("%c" + "─".repeat(60), "color: #ddd;");
            });
        } // End debug mode check

        const newFindings = findings.filter(f => !seenCredentials.has(f.type + '|' + f.value));
        findings.forEach(f => seenCredentials.add(f.type + '|' + f.value));

        // Filter out low-risk findings from popup notifications (but keep them in console and exports)
        const notificationFindings = newFindings.filter(f => (f.riskLevel || 'medium') !== 'low');

        if (notificationFindings.length > 0 || !notificationDismissed) {
            // Process bucket and regular findings separately for notifications (excluding low-risk)
            const notificationBucketFindings = notificationFindings.filter(f => f.bucketInfo);
            const notificationRegularFindings = notificationFindings.filter(f => !f.bucketInfo);

            // Show bucket notification if there are medium+ risk bucket findings
            const allNotificationBuckets = bucketFindings.filter(f => (f.riskLevel || 'medium') !== 'low');
            if (allNotificationBuckets.length > 0) {
                showBucketNotification(allNotificationBuckets, notificationBucketFindings);
            }

            // Show regular notification if there are medium+ risk regular findings
            const allNotificationRegular = regularFindings.filter(f => (f.riskLevel || 'medium') !== 'low');
            if (allNotificationRegular.length > 0) {
                showRegularNotification(allNotificationRegular, notificationRegularFindings);
            }
        } else {
            debugLog("Same findings detected (notification dismissed - check console for details)");
        }

        // Log info about low-risk findings that are excluded from popup
        const lowRiskNewFindings = newFindings.filter(f => (f.riskLevel || 'medium') === 'low');
        if (lowRiskNewFindings.length > 0) {
            debugLog(`${lowRiskNewFindings.length} low-risk finding(s) detected (informational only - not shown in popup)`);
        }
    }

    function showBucketNotification(allBucketFindings, newBucketFindings) {
        const publicBuckets = allBucketFindings.filter(f => f.bucketInfo?.accessible === true);
        const privateBuckets = allBucketFindings.filter(f => f.bucketInfo?.accessible === false);

        // Determine highest risk level for buckets
        const highestRisk = allBucketFindings.reduce((highest, f) => {
            const riskLevels = ['low', 'medium', 'high', 'critical'];
            const currentRisk = f.riskLevel || 'unknown';
            const currentIndex = riskLevels.indexOf(currentRisk);
            const highestIndex = riskLevels.indexOf(highest);
            return currentIndex > highestIndex ? currentRisk : highest;
        }, 'low');

        // Create notification title based on bucket accessibility
        let notificationTitle;
        let emoji = '☁️';

        if (publicBuckets.length > 0) {
            emoji = '🚨';
            if (newBucketFindings.some(f => f.bucketInfo?.accessible === true)) {
                notificationTitle = `🆕 ${publicBuckets.length} Public Cloud Bucket${publicBuckets.length > 1 ? 's' : ''} Found`;
            } else {
                notificationTitle = `🚨 ${publicBuckets.length} Public Cloud Bucket${publicBuckets.length > 1 ? 's' : ''} Detected`;
            }
        } else {
            if (newBucketFindings.length > 0) {
                notificationTitle = `🆕 ${allBucketFindings.length} Cloud Bucket${allBucketFindings.length > 1 ? 's' : ''} Found`;
            } else {
                notificationTitle = `☁️ ${allBucketFindings.length} Cloud Bucket${allBucketFindings.length > 1 ? 's' : ''} Detected`;
            }
        }

        // Show top 3 bucket findings, prioritizing public ones
        const displayFindings = [...publicBuckets, ...privateBuckets].slice(0, 3);
        const moreCount = allBucketFindings.length > 3 ? allBucketFindings.length - 3 : 0;

        showNotification(
            {
                emoji: emoji,
                title: notificationTitle,
                findings: displayFindings,
                moreCount: moreCount
            },
            highestRisk
        );
    }

    function showRegularNotification(allRegularFindings, newRegularFindings) {
        const highestRisk = allRegularFindings.reduce((highest, f) => {
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

        const notificationTitle = newRegularFindings.length > 0 ?
            `🆕 ${newRegularFindings.length} New Credential${newRegularFindings.length > 1 ? 's' : ''} Found` :
            `🚨 ${allRegularFindings.length} Credential${allRegularFindings.length > 1 ? 's' : ''} Detected`;

        const displayFindings = (newRegularFindings.length > 0 ? newRegularFindings : allRegularFindings).slice(0, 3);
        const moreCount = allRegularFindings.length > 3 ? allRegularFindings.length - 3 : 0;

        showNotification(
            {
                emoji: riskEmoji,
                title: notificationTitle,
                findings: displayFindings,
                moreCount: moreCount
            },
            highestRisk
        );
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
                        risk: patternConfig.riskLevel,
                        riskLevel: patternConfig.riskLevel, // Add this for consistency
                        category: patternConfig.category || category, // Use pattern's category if specified
                        provider: patternConfig.provider
                    });
                }
            }
        }

        // 2. Run the scan using the ProgressiveScanner
        const content = document.documentElement.innerHTML;
        let findings = await scanner.progressiveScan(content, allPatterns);

        // 3. Run bucket scanning if enabled and bucket findings exist
        if (scanner.isBucketScanningEnabled && typeof scanner.isBucketScanningEnabled === 'function' && scanner.isBucketScanningEnabled()) {
            try {
                const bucketFindings = await scanner.scanCloudBuckets(findings);
                if (bucketFindings && bucketFindings.length > 0) {
                    // Replace original bucket findings with enhanced ones
                    const nonBucketFindings = findings.filter(f => !f.category || f.category !== 'cloudStorage');
                    findings = [...nonBucketFindings, ...bucketFindings];
                }
            } catch (error) {
                debugLog('Bucket scanning failed:', error);
            }
        }

        // 4. Process the results
        processFindings(findings);
        return findings;
    }

    // Inject interceptor IMMEDIATELY at document_start (before page scripts run)
    async function injectInterceptorEarly() {
        try {
            console.log('[FW Content] Early initialization at document_start');
            await loadWhitelist();
            if (isDomainWhitelisted()) {
                console.log('[FW Content] Domain is whitelisted - skipping interceptor injection');
                return;
            }

            // Inject interceptor before any page scripts can run
            injectInterceptor();
            console.log('[FW Content] Interceptor injected at document_start');
        } catch (error) {
            console.error('[FW Content] Early injection error:', error);
        }
    }

    async function initializeScanner() {
        try {
            console.log('[FW Content] Initializing FerretWatch scanner on domain:', currentDomain);
            await loadSettings(); // Load settings into cache
            if (isDomainWhitelisted()) {
                console.log('[FW Content] FerretWatch disabled for whitelisted domain:', currentDomain);
                return;
            }

            console.log('[FW Content] FerretWatch starting scan on:', currentDomain);
            debugLog('FerretWatch Auto-scanning for credentials...');

            await runScan();

        } catch (error) {
            console.error('[FW Content] Initialization error:', error);
        }
    }

    // IMMEDIATELY inject interceptor (synchronous, at document_start)
    injectInterceptorEarly();

    // Delay scanning until DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScanner);
    } else {
        setTimeout(initializeScanner, 100);
    }

    // --- Browser Message Listener ---
    const runtime = (typeof browser !== 'undefined' ? browser : chrome).runtime;
    if (runtime) {
        runtime.onMessage.addListener((message, sender, sendResponse) => {

            if (message.action === 'executeRequest') {
                // Handle executeRequest asynchronously
                (async () => {
                // Content Script Proxy Handler
                const { url, method, headers, body } = message.data;

                // --- Main World Execution Strategy ---

                // 1. Firefox Xray Path (Bypasses CSP & Isolated World without injection)
                // If this fails, will fall through to external script approach
                if (typeof exportFunction !== 'undefined' && window.wrappedJSObject) {
                    try {
                        infoLog(`Executing proxied request (Firefox Xray): ${method} ${url}`);

                        // Filter unsafe headers
                        const unsafeHeaders = [
                            'host', 'connection', 'origin', 'referer', 'content-length',
                            'cookie', 'date', 'user-agent', 'dnt', 'upgrade-insecure-requests',
                            'sec-fetch-user', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'
                        ];
                        const cleanHeaders = {};
                        if (headers) {
                            for (const [key, value] of Object.entries(headers)) {
                                if (!unsafeHeaders.includes(key.toLowerCase())) {
                                    cleanHeaders[key] = value;
                                }
                            }
                        }

                        const makeXrayRequest = async (credMode) => {
                            const opts = {
                                method: method || 'GET',
                                headers: cleanHeaders,
                                credentials: credMode
                            };
                            if (body && !['GET', 'HEAD'].includes(opts.method.toUpperCase())) {
                                opts.body = typeof body === 'object' ? JSON.stringify(body) : body;
                            }

                            // Firefox requires cloning objects into the page's scope
                            const safeOpts = cloneInto(opts, window.wrappedJSObject);
                            return await window.wrappedJSObject.fetch(url, safeOpts);
                        };

                        let response;
                        try {
                            response = await makeXrayRequest('include');
                        } catch (e) {
                            // Fallback
                            response = await makeXrayRequest('omit');
                        }

                        let bodyText = '';
                        try { bodyText = await response.text(); } catch (e) { bodyText = '[Body Read Error]'; }

                        sendResponse({
                            success: true,
                            status: response.status,
                            statusText: response.statusText,
                            headers: [], // Xray headers are tricky to copy back, sending empty for now
                            body: bodyText
                        });
                        return true;

                    } catch (error) {
                        console.warn('Firefox Xray failed, falling back to external script approach:', error.message);
                        // Don't return - fall through to external script path below
                    }
                }

                // 2. Chrome/Generic Injection Path - Using Web-Accessible Script
                const requestId = 'fw-' + Math.random().toString(36).substr(2, 9);

                try {
                    infoLog(`Executing proxied request (Main World via External Script): ${method} ${url}`);

                    // Filter unsafe headers (still needed to avoid browser errors)
                    const unsafeHeaders = [
                        'host', 'connection', 'origin', 'referer', 'content-length',
                        'cookie', 'date', 'user-agent', 'dnt', 'upgrade-insecure-requests',
                        'sec-fetch-user', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'
                    ];

                    const cleanHeaders = {};
                    if (headers) {
                        for (const [key, value] of Object.entries(headers)) {
                            if (!unsafeHeaders.includes(key.toLowerCase())) {
                                cleanHeaders[key] = value;
                            }
                        }
                    }

                    // Create a promise to wait for the result
                    const resultPromise = new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            window.removeEventListener(requestId, handleResponse);
                            reject(new Error('Main World Request Timed Out'));
                        }, 30000); // 30s timeout

                        const handleResponse = (e) => {
                            window.removeEventListener(requestId, handleResponse);
                            clearTimeout(timeoutId);

                            const result = e.detail;
                            if (result.success) {
                                resolve(result.response);
                            } else {
                                reject(new Error(result.error));
                            }
                        };

                        window.addEventListener(requestId, handleResponse);
                    });

                    // Inject the proxy script if not already loaded
                    if (!document.querySelector('script[data-ferretwatch-proxy]')) {
                        const proxyScript = document.createElement('script');
                        proxyScript.src = (typeof chrome !== 'undefined' ? chrome : browser).runtime.getURL('utils/main-world-proxy.js');
                        proxyScript.dataset.ferretwatchProxy = 'true';
                        proxyScript.onload = function () {
                            debugLog('Main world proxy script loaded successfully');
                        };
                        proxyScript.onerror = function () {
                            console.error('Failed to load main world proxy script');
                        };
                        (document.head || document.documentElement).appendChild(proxyScript);

                        // Wait a moment for script to initialize
                        await new Promise(r => setTimeout(r, 100));
                    }

                    // Dispatch request to main world proxy
                    const requestOptions = {
                        method: method || 'GET',
                        headers: cleanHeaders
                    };

                    // Add body if present and method supports it
                    if (body && !['GET', 'HEAD'].includes((method || 'GET').toUpperCase())) {
                        requestOptions.body = body;
                    }

                    window.dispatchEvent(new CustomEvent('ferretwatch-proxy-request', {
                        detail: {
                            requestId: requestId,
                            url: url,
                            options: requestOptions
                        }
                    }));

                    // Wait for result
                    const responseData = await resultPromise;
                    sendResponse(responseData);

                } catch (error) {
                    console.error('Content Script Proxy Error:', error);
                    sendResponse({
                        success: false,
                        error: `Proxy Error: ${error.message}`
                    });
                }
                })(); // Execute async function
                return true; // Keep channel open

            } else if (message.action === 'rescan') {
                (async () => {
                    await loadWhitelist();
                    if (isDomainWhitelisted()) {
                        sendResponse({ success: false, error: 'Domain is whitelisted' });
                        return;
                    }
                    notificationDismissed = false;
                    const results = await runScan();
                    sendResponse({ success: true, findings: results });
                })();
                return true;

            } else if (message.action === 'getCurrentFindings') {
                const resultsToSend = lastScanResults.length > 0 ? lastScanResults : (window.lastScanResults || []);
                sendResponse({ success: true, findings: resultsToSend });
                return true;

            } else if (message.action === 'addToWhitelist') {
                (async () => {
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
                })();
                return true;

            } else if (message.action === 'removeFromWhitelist') {
                (async () => {
                    try {
                        await loadWhitelist();
                        const domain = message.domain;
                        whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
                        await browser.storage.local.set({ whitelistedDomains });
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            } else if (message.action === 'getWhitelist') {
                (async () => {
                    await loadWhitelist();
                    sendResponse({
                        success: true,
                        whitelist: whitelistedDomains,
                        currentDomain: currentDomain,
                        isWhitelisted: isDomainWhitelisted()
                    });
                })();
                return true;

            } else if (message.action === 'scanUnusedEndpoints') {
                (async () => {
                    try {
                        // EndpointScanner is loaded in content script context, not page context
                        if (typeof EndpointScanner === 'undefined') {
                            sendResponse({
                                success: false,
                                error: 'EndpointScanner not loaded'
                            });
                            return;
                        }

                        debugLog('[Content] Starting endpoint scan...');
                        const scanner = new EndpointScanner();
                        const scanResult = await scanner.scanPage();
                        debugLog(`[Content] Scan complete: ${scanResult.total} endpoints found`);

                        sendResponse({
                            success: true,
                            discovered: scanResult.endpoints,
                            total: scanResult.total,
                            scannedAt: scanResult.scannedAt
                        });
                    } catch (error) {
                        console.error('[FW] Endpoint scan error:', error);
                        sendResponse({
                            success: false,
                            error: error.message
                        });
                    }
                })();
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
        },
        cloudBucketScanning: {
            enabled: true,
            providers: {
                aws: true,
                gcp: true,
                azure: true,
                digitalocean: true,
                alibaba: true
            },
            testTimeout: 5000,
            maxConcurrentTests: 3,
            testPublicAccess: true
        }
    };

    // Load settings into cache
    async function loadSettings() {
        try {
            const result = await browser.storage.local.get(['userSettings', 'debugMode']);
            if (result.userSettings) {
                settingsCache = { ...settingsCache, ...result.userSettings };
            }
            // Load debug mode setting separately
            if (result.debugMode !== undefined) {
                settingsCache.debugMode = result.debugMode;
            }
        } catch (error) {
            debugLog('Failed to load settings:', error);
        }
    }

    window.StorageUtils = {
        get: async (key) => {
            const result = await browser.storage.local.get([key]);
            return result[key] || null;
        },
        set: async (key, value) => {
            await browser.storage.local.set({ [key]: value });
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
        },
        getBucketScanningSettings: () => {
            return settingsCache.cloudBucketScanning || {
                enabled: true,
                providers: {
                    aws: true,
                    gcp: true,
                    azure: true,
                    digitalocean: true,
                    alibaba: true
                },
                testTimeout: 5000,
                maxConcurrentTests: 3,
                testPublicAccess: true
            };
        },
        isBucketScanningEnabled: () => {
            const bucketSettings = settingsCache.cloudBucketScanning;
            return bucketSettings && bucketSettings.enabled === true;
        },
        isProviderEnabled: (provider) => {
            const bucketSettings = settingsCache.cloudBucketScanning;
            return bucketSettings &&
                bucketSettings.providers &&
                bucketSettings.providers[provider] === true;
        }
    };


    window.FerretWatchDebug = {
        version: '2.2.0',
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
