/**
 * FerretWatch - Notification UI Module
 *
 * Handles all notification display and building logic
 * Exposes: window.FerretWatchNotifications
 */

(function() {
    'use strict';

    // Track notification state
    let notificationDismissed = false;

    // Get utilities
    const utils = window.FerretWatchUtils || {};
    const getRiskColor = utils.getRiskColor || function(risk) { return '#ff9800'; };
    const getDarkerRiskColor = utils.getDarkerRiskColor || function(risk) { return '#f57c00'; };
    const getBucketProviderIcon = utils.getBucketProviderIcon || function() { return '☁️'; };

    /**
     * Builds the notification DOM structure
     * @param {HTMLElement} container - The notification container element
     * @param {Object} content - Notification content object
     * @param {string} content.emoji - Emoji for the notification
     * @param {string} content.title - Notification title
     * @param {Array} content.findings - Array of findings to display
     * @param {number} content.moreCount - Count of additional findings not shown
     * @param {string} risk - Risk level (critical, high, medium, low)
     */
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

    /**
     * Shows a notification popup
     * @param {string|Object} content - Either a string message or an object with notification content
     * @param {string} risk - Risk level (critical, high, medium, low)
     */
    function showNotification(content, risk = 'medium') {
        // Remove any existing notifications
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

        // Auto-dismiss after 12 seconds
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

    /**
     * Shows notification specifically for bucket findings
     * @param {Array} allBucketFindings - All bucket findings
     * @param {Array} newBucketFindings - New bucket findings to highlight
     */
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

    /**
     * Shows notification for regular (non-bucket) findings
     * @param {Array} allRegularFindings - All regular findings
     * @param {Array} newRegularFindings - New regular findings to highlight
     */
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

    /**
     * Resets the notification dismissed state
     */
    function resetNotificationDismissed() {
        notificationDismissed = false;
    }

    /**
     * Checks if notification was dismissed
     * @returns {boolean}
     */
    function isNotificationDismissed() {
        return notificationDismissed;
    }

    // Expose public API
    window.FerretWatchNotifications = {
        showNotification,
        showBucketNotification,
        showRegularNotification,
        buildNotificationContent,
        resetNotificationDismissed,
        isNotificationDismissed
    };

})();
