// Chrome compatibility layer
if (typeof importScripts !== 'undefined') {
    importScripts('utils/browser-compat.js');
}

/**
 * FerretWatch Content Script
 *
 * This script orchestrates the scanning process on the page.
 * It loads the necessary modules, initializes the scanner, and
 * communicates with the background script.
 */

(function() {
    'use strict';

    const SCRIPT_URLS = [
        'utils/storage.js',
        'utils/context.js',
        'config/patterns.js',
        'utils/scanner.js'
    ];

    let scanner;

    /**
     * Injects and loads the necessary scripts into the page.
     */
    async function loadScripts() {
        for (const url of SCRIPT_URLS) {
            try {
                const scriptUrl = chrome.runtime.getURL(url);
                await import(scriptUrl);
            } catch (e) {
                console.error(`FerretWatch: Failed to load script ${url}`, e);
            }
        }
    }

    /**
     * Initializes the scanner and starts the scanning process.
     */
    async function initialize() {
        await loadScripts();

        // Check if the domain is whitelisted before proceeding
        if (window.StorageUtils.isDomainWhitelisted(window.location.hostname)) {
            console.log('FerretWatch: Domain is whitelisted. Skipping scan.');
            return;
        }

        scanner = new window.ProgressiveScanner();
        startScan();

        // Set up dynamic content scanning if enabled
        if (window.StorageUtils.getSetting('enableDynamicScanning', false)) {
            const observer = new MutationObserver(() => {
                scanner.debouncedScan(document.body.innerHTML, getPatterns());
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    function getPatterns() {
        return Object.values(window.SECURITY_PATTERNS).flatMap(category => Object.values(category));
    }

    /**
     * Starts the scanning process.
     */
    async function startScan() {
        if (!scanner) return;

        const patterns = Object.values(window.SECURITY_PATTERNS).flatMap(category => Object.values(category));
        const findings = await scanner.progressiveScan(document.body.innerHTML, patterns);

        if (findings && findings.length > 0) {
            chrome.runtime.sendMessage({
                type: 'SCAN_COMPLETE',
                data: { findings }
            });
        }
    }

    /**
     * Listens for messages from the background script.
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'rescan') {
            startScan();
            sendResponse({ success: true });
        }
        return true;
    });

    // Start the initialization process
    initialize();

})();
