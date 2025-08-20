/**
 * Context-aware filtering utilities for reducing false positives
 */

/**
 * Removes script tag content from HTML to reduce false positives
 * @param {string} html - HTML content to filter
 * @returns {string} HTML with script content removed
 */
function removeScriptTags(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Remove script tag contents but keep the rest
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Removes CSS content from HTML to reduce false positives
 * @param {string} html - HTML content to filter
 * @returns {string} HTML with CSS content removed
 */
function removeCssTags(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Remove style tag contents and inline styles
    return html
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/\sstyle\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Detects if a line appears to be minified JavaScript
 * @param {string} line - Line of text to check
 * @returns {boolean} True if appears to be minified JS
 */
function isMinifiedJavaScript(line) {
    if (!line || typeof line !== 'string') return false;
    
    // Heuristics for minified JS detection
    const length = line.length;
    const semicolons = (line.match(/;/g) || []).length;
    const commas = (line.match(/,/g) || []).length;
    const brackets = (line.match(/[{}()]/g) || []).length;
    
    // If line is very long with high density of JS syntax characters
    if (length > 500) {
        const syntaxDensity = (semicolons + commas + brackets) / length;
        if (syntaxDensity > 0.05) { // More than 5% syntax characters
            return true;
        }
    }
    
    // Check for common minified JS patterns
    const minifiedPatterns = [
        /^[a-zA-Z$_][a-zA-Z0-9$_]*\s*=\s*function\s*\(/,  // var a=function(
        /}\s*,\s*[a-zA-Z$_]/,  // },a or },function
        /\)\s*&&\s*\(/,        // )&&(
        /\|\|\s*\(/,           // ||(
        /\?\s*[a-zA-Z$_]+\s*:/  // ?a: or ?function:
    ];
    
    return minifiedPatterns.some(pattern => pattern.test(line));
}

/**
 * Filters out lines that are likely to contain false positives
 * @param {string} content - Content to filter
 * @returns {string} Filtered content
 */
function filterContent(content) {
    if (!content || typeof content !== 'string') return '';
    
    // Remove script and CSS content
    let filtered = removeScriptTags(content);
    filtered = removeCssTags(filtered);
    
    // Split into lines and filter out minified JS
    const lines = filtered.split('\n');
    const filteredLines = lines.filter(line => {
        // Skip empty lines
        if (!line.trim()) return false;
        
        // Skip lines that appear to be minified JS
        if (isMinifiedJavaScript(line)) return false;
        
        // Skip lines with excessive HTML tags (likely layout code)
        const tagCount = (line.match(/<[^>]+>/g) || []).length;
        const lineLength = line.length;
        if (tagCount > 5 && lineLength < 200) return false; // High tag density in short line
        
        return true;
    });
    
    return filteredLines.join('\n');
}

/**
 * Checks if a match appears in a suspicious context
 * @param {string} match - The matched text
 * @param {string} context - Surrounding context (e.g., full line)
 * @returns {boolean} True if context seems suspicious for false positives
 */
function isSuspiciousContext(match, context) {
    if (!context) return false;
    
    const suspiciousPatterns = [
        // Inside HTML attributes
        /\s(class|id|data-[^=]*)\s*=\s*["'][^"']*\b/i,
        // Inside JavaScript variable names or object properties
        /\b(var|let|const|function)\s+\w*\b/i,
        // Inside CSS selectors or properties
        /\b(color|background|border|margin|padding)\s*:/i,
        // Inside comments
        /\/\*.*\*\/|\/\/.*$/,
        // Inside base64 encoded images
        /data:image\/[^;]+;base64,/i,
        // Inside URL parameters that are not secrets
        /[?&](utm_|ga_|fb_|ref=)/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(context));
}

/**
 * Extracts just the visible text content from HTML
 * @param {string} html - HTML content
 * @returns {string} Visible text content only
 */
function extractVisibleText(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Remove script and style tags completely
    let text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
    
    // Replace HTML entities
    text = text
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(num));
    
    // Remove HTML tags but keep the text content
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        removeScriptTags,
        removeCssTags,
        isMinifiedJavaScript,
        filterContent,
        isSuspiciousContext,
        extractVisibleText
    };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.ContextUtils = {
        removeScriptTags,
        removeCssTags,
        isMinifiedJavaScript,
        filterContent,
        isSuspiciousContext,
        extractVisibleText
    };
}
