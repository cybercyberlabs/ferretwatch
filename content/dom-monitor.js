/** Bounded mutation batches, including text and attribute changes. */
(function () {
    'use strict';
    class DomMonitor {
        constructor(scan, root) {
            this.scan = scan;
            this.root = root;
            this.chunks = [];
            this.bytes = 0;
            this.truncated = false;
            this.timer = null;
            this.running = false;
            this.stopped = false;
            this.observer = new MutationObserver(records => this.collect(records));
            this.observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
        }

        collect(records) {
            if (this.stopped) return;
            const add = node => {
                const element = node.nodeType === 1 ? node : node.parentElement;
                if (element?.closest?.('.cyber-labs-credential-notification')) return;
                const text = node.nodeType === 1 ? node.outerHTML : node.textContent;
                this.append(text);
            };
            for (const record of records) {
                const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
                if (element?.closest?.('.cyber-labs-credential-notification')) continue;
                if (record.type === 'attributes') this.append(record.target.getAttribute(record.attributeName));
                else if (record.type === 'characterData') add(record.target);
                else for (const node of record.addedNodes) add(node);
            }
            this.schedule();
        }

        append(text) {
            if (!text) return;
            const limit = FerretWatchContracts.CAPTURE_LIMITS.domQueueBytes;
            const remaining = limit - this.bytes;
            if (remaining <= 0 || this.chunks.length >= 200) { this.truncated = true; return; }
            // Slice before encoding so even a very large DOM node has a bounded copy.
            const bytes = new TextEncoder().encode(String(text).slice(0, remaining));
            if (bytes.length > remaining || text.length > remaining) this.truncated = true;
            const kept = bytes.subarray(0, remaining);
            this.chunks.push(new TextDecoder().decode(kept));
            this.bytes += kept.byteLength;
        }

        schedule() {
            // A continuous mutation stream must not keep resetting the deadline.
            if (!this.stopped && !this.running && this.timer === null && this.chunks.length) {
                this.timer = setTimeout(() => this.flush(), 500);
            }
        }

        async flush() {
            this.timer = null;
            if (this.stopped) return;
            const text = this.chunks.join('\n');
            const truncated = this.truncated;
            this.chunks = []; this.bytes = 0; this.truncated = false;
            this.running = true;
            try { await this.scan(text, { sourceKind: 'dom', truncated }); }
            catch (_) { /* Scanner manager reports inspection failures. */ }
            finally { this.running = false; this.schedule(); }
        }

        stop() {
            this.stopped = true;
            this.observer.disconnect();
            clearTimeout(this.timer);
            this.timer = null;
            this.chunks = []; this.bytes = 0;
        }
    }
    globalThis.FerretWatchDomMonitor = DomMonitor;
})();
