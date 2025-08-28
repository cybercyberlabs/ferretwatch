/**
 * Cloud Bucket URL Parser Utility
 * Extracts bucket information from detected cloud storage URLs
 */

class BucketParser {
    /**
     * Parse a bucket URL and extract relevant information
     * @param {string} url - The detected bucket URL
     * @param {string} provider - The cloud provider (aws, gcp, azure, etc.)
     * @returns {Object} Parsed bucket information
     */
    static parseBucketUrl(url, provider) {
        // Enhanced input validation
        const validationResult = this._validateInputs(url, provider);
        if (!validationResult.isValid) {
            throw new Error(validationResult.error);
        }

        const normalizedUrl = this.normalizeUrl(url);
        
        // Additional URL validation after normalization
        if (!this.isValidCloudStorageUrl(normalizedUrl)) {
            throw new Error(`URL does not match expected cloud storage patterns: ${normalizedUrl}`);
        }

        let bucketInfo = {
            originalUrl: url.trim(),
            normalizedUrl: normalizedUrl,
            provider: provider.toLowerCase(),
            bucketName: null,
            region: null,
            path: null,
            testUrls: []
        };

        try {
            switch (provider.toLowerCase()) {
                case 'aws':
                    bucketInfo = this._parseAwsS3Url(normalizedUrl, bucketInfo);
                    break;
                case 'gcp':
                    bucketInfo = this._parseGcpUrl(normalizedUrl, bucketInfo);
                    break;
                case 'azure':
                    bucketInfo = this._parseAzureUrl(normalizedUrl, bucketInfo);
                    break;
                case 'digitalocean':
                    bucketInfo = this._parseDigitalOceanUrl(normalizedUrl, bucketInfo);
                    break;
                case 'alibaba':
                    bucketInfo = this._parseAlibabaUrl(normalizedUrl, bucketInfo);
                    break;
                case 'ibm':
                    bucketInfo = this._parseIbmUrl(normalizedUrl, bucketInfo);
                    break;
                case 'oracle':
                    bucketInfo = this._parseOracleUrl(normalizedUrl, bucketInfo);
                    break;
                case 'wasabi':
                    bucketInfo = this._parseWasabiUrl(normalizedUrl, bucketInfo);
                    break;
                case 'backblaze':
                    bucketInfo = this._parseBackblazeUrl(normalizedUrl, bucketInfo);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }

            // Validate parsed bucket information
            const bucketValidation = this._validateParsedBucket(bucketInfo);
            if (!bucketValidation.isValid) {
                throw new Error(bucketValidation.error);
            }

            // Generate test URLs for accessibility testing
            bucketInfo.testUrls = this.generateTestUrls(bucketInfo);
            
            // Final validation of test URLs (allow empty for certain providers/types)
            if (!bucketInfo.testUrls || bucketInfo.testUrls.length === 0) {
                // Some bucket types don't support direct listing (S3 websites, Backblaze B2)
                if (bucketInfo.isWebsite || provider.toLowerCase() === 'backblaze') {
                    bucketInfo.testUrls = []; // Empty array is acceptable
                } else {
                    throw new Error(`No valid test URLs could be generated for ${provider} bucket`);
                }
            }
            
            return bucketInfo;
        } catch (error) {
            throw new Error(`Failed to parse ${provider} URL '${url}': ${error.message}`);
        }
    }

    /**
     * Validate input parameters
     * @private
     */
    static _validateInputs(url, provider) {
        if (!url) {
            return { isValid: false, error: 'URL is required' };
        }

        if (typeof url !== 'string') {
            return { isValid: false, error: 'URL must be a string' };
        }

        if (url.trim().length === 0) {
            return { isValid: false, error: 'URL cannot be empty' };
        }

        if (url.length > 2048) {
            return { isValid: false, error: 'URL is too long (maximum 2048 characters)' };
        }

        if (!provider) {
            return { isValid: false, error: 'Provider is required' };
        }

        if (typeof provider !== 'string') {
            return { isValid: false, error: 'Provider must be a string' };
        }

        const supportedProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'alibaba', 'ibm', 'oracle', 'wasabi', 'backblaze'];
        if (!supportedProviders.includes(provider.toLowerCase())) {
            return { isValid: false, error: `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}` };
        }

        return { isValid: true };
    }

    /**
     * Validate parsed bucket information
     * @private
     */
    static _validateParsedBucket(bucketInfo) {
        if (!bucketInfo.bucketName) {
            return { isValid: false, error: 'Could not extract bucket name from URL' };
        }

        if (typeof bucketInfo.bucketName !== 'string') {
            return { isValid: false, error: 'Bucket name must be a string' };
        }

        if (bucketInfo.bucketName.length < 3 || bucketInfo.bucketName.length > 63) {
            return { isValid: false, error: 'Bucket name must be between 3 and 63 characters' };
        }

        // Validate bucket name format (provider-specific validation)
        const provider = bucketInfo.provider.toLowerCase();
        if (provider === 'gcp') {
            // GCP allows uppercase letters and underscores
            if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.\_]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(bucketInfo.bucketName)) {
                return { isValid: false, error: 'Bucket name contains invalid characters for GCP' };
            }
        } else {
            // AWS and others are more restrictive
            if (!/^[a-z0-9][a-z0-9\-\.\_]*[a-z0-9]$|^[a-z0-9]$/.test(bucketInfo.bucketName)) {
                return { isValid: false, error: 'Bucket name contains invalid characters' };
            }
        }

        return { isValid: true };
    }

    /**
     * Parse AWS S3 URLs (multiple formats supported)
     */
    static _parseAwsS3Url(url, bucketInfo) {
        // s3://bucket-name/path
        const s3ProtocolMatch = url.match(/^s3:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (s3ProtocolMatch) {
            bucketInfo.bucketName = s3ProtocolMatch[1];
            bucketInfo.path = s3ProtocolMatch[2] || '';
            bucketInfo.region = 'us-east-1'; // Default region for s3:// URLs
            return bucketInfo;
        }

        // S3 website: https://bucket-name.s3-website-region.amazonaws.com/path (check this first as it's more specific)
        const websiteMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.s3-website(?:-([a-z0-9\-]+))?\.amazonaws\.com(?:\/(.*))?$/i);
        if (websiteMatch) {
            bucketInfo.bucketName = websiteMatch[1];
            bucketInfo.region = websiteMatch[2] || 'us-east-1';
            bucketInfo.path = websiteMatch[3] || '';
            bucketInfo.isWebsite = true;
            return bucketInfo;
        }

        // Virtual-hosted style: https://bucket-name.s3.region.amazonaws.com/path
        const virtualHostedMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.s3(?:[\.\-]([a-z0-9\-]+))?\.amazonaws\.com(?:\/(.*))?$/i);
        if (virtualHostedMatch) {
            bucketInfo.bucketName = virtualHostedMatch[1];
            bucketInfo.region = virtualHostedMatch[2] || 'us-east-1';
            bucketInfo.path = virtualHostedMatch[3] || '';
            return bucketInfo;
        }

        // Path style: https://s3.region.amazonaws.com/bucket-name/path
        const pathStyleMatch = url.match(/^https?:\/\/s3(?:[\.\-]([a-z0-9\-]+))?\.amazonaws\.com\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (pathStyleMatch) {
            bucketInfo.region = pathStyleMatch[1] || 'us-east-1';
            bucketInfo.bucketName = pathStyleMatch[2];
            bucketInfo.path = pathStyleMatch[3] || '';
            return bucketInfo;
        }

        throw new Error('Invalid AWS S3 URL format');
    }

    /**
     * Parse Google Cloud Storage URLs
     */
    static _parseGcpUrl(url, bucketInfo) {
        // gs://bucket-name/path
        const gsProtocolMatch = url.match(/^gs:\/\/([a-z0-9][a-z0-9\-_\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (gsProtocolMatch) {
            bucketInfo.bucketName = gsProtocolMatch[1];
            bucketInfo.path = gsProtocolMatch[2] || '';
            return bucketInfo;
        }

        // https://storage.googleapis.com/bucket-name/path
        const apiMatch = url.match(/^https?:\/\/storage\.googleapis\.com\/([a-z0-9][a-z0-9\-_\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (apiMatch) {
            bucketInfo.bucketName = apiMatch[1];
            bucketInfo.path = apiMatch[2] || '';
            return bucketInfo;
        }

        // https://storage.cloud.google.com/bucket-name/path
        const downloadMatch = url.match(/^https?:\/\/storage\.cloud\.google\.com\/([a-z0-9][a-z0-9\-_\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (downloadMatch) {
            bucketInfo.bucketName = downloadMatch[1];
            bucketInfo.path = downloadMatch[2] || '';
            return bucketInfo;
        }

        throw new Error('Invalid Google Cloud Storage URL format');
    }

    /**
     * Parse Azure Blob Storage URLs
     */
    static _parseAzureUrl(url, bucketInfo) {
        // https://account.blob.core.windows.net/container/path
        const azureMatch = url.match(/^https?:\/\/([a-z0-9]{3,24})\.blob\.core\.(?:windows\.net|chinacloudapi\.cn|usgovcloudapi\.net)\/([a-z0-9][a-z0-9\-]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (azureMatch) {
            bucketInfo.accountName = azureMatch[1];
            bucketInfo.bucketName = azureMatch[2]; // Container name
            bucketInfo.path = azureMatch[3] || '';
            
            // Determine region based on endpoint
            if (url.includes('chinacloudapi.cn')) {
                bucketInfo.region = 'china';
            } else if (url.includes('usgovcloudapi.net')) {
                bucketInfo.region = 'usgov';
            } else {
                bucketInfo.region = 'global';
            }
            
            return bucketInfo;
        }

        throw new Error('Invalid Azure Blob Storage URL format');
    }

    /**
     * Parse DigitalOcean Spaces URLs
     */
    static _parseDigitalOceanUrl(url, bucketInfo) {
        // https://bucket-name.region.digitaloceanspaces.com/path
        const spacesMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.(nyc3|ams3|sgp1|sfo2|fra1|blr1|syd1)\.(?:cdn\.)?digitaloceanspaces\.com(?:\/(.*))?$/i);
        if (spacesMatch) {
            bucketInfo.bucketName = spacesMatch[1];
            bucketInfo.region = spacesMatch[2];
            bucketInfo.path = spacesMatch[3] || '';
            bucketInfo.isCdn = url.includes('.cdn.');
            return bucketInfo;
        }

        throw new Error('Invalid DigitalOcean Spaces URL format');
    }

    /**
     * Parse Alibaba Cloud OSS URLs
     */
    static _parseAlibabaUrl(url, bucketInfo) {
        // https://bucket-name.oss-region.aliyuncs.com/path
        const ossMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.oss-([a-z0-9\-]+?)(?:-internal)?\.aliyuncs\.com(?:\/(.*))?$/i);
        if (ossMatch) {
            bucketInfo.bucketName = ossMatch[1];
            bucketInfo.region = ossMatch[2];
            bucketInfo.path = ossMatch[3] || '';
            bucketInfo.isInternal = url.includes('-internal');
            return bucketInfo;
        }

        throw new Error('Invalid Alibaba Cloud OSS URL format');
    }

    /**
     * Parse IBM Cloud Object Storage URLs
     */
    static _parseIbmUrl(url, bucketInfo) {
        // https://bucket-name.s3.region.cloud-object-storage.appdomain.cloud/path
        const ibmMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.s3\.([a-z\-0-9]+)\.cloud-object-storage\.appdomain\.cloud(?:\/(.*))?$/i);
        if (ibmMatch) {
            bucketInfo.bucketName = ibmMatch[1];
            bucketInfo.region = ibmMatch[2];
            bucketInfo.path = ibmMatch[3] || '';
            return bucketInfo;
        }

        throw new Error('Invalid IBM Cloud Object Storage URL format');
    }

    /**
     * Parse Oracle Cloud Infrastructure Object Storage URLs
     */
    static _parseOracleUrl(url, bucketInfo) {
        // https://objectstorage.region.oraclecloud.com/n/namespace/b/bucket-name/o/path
        const oracleMatch = url.match(/^https?:\/\/objectstorage\.([a-z\-0-9]+)\.oraclecloud\.com\/n\/([^\/\s"'<>]+)\/b\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])(?:\/o\/(.*))?$/i);
        if (oracleMatch) {
            bucketInfo.region = oracleMatch[1];
            bucketInfo.namespace = oracleMatch[2];
            bucketInfo.bucketName = oracleMatch[3];
            bucketInfo.path = oracleMatch[4] || '';
            return bucketInfo;
        }

        throw new Error('Invalid Oracle Cloud Infrastructure Object Storage URL format');
    }

    /**
     * Parse Wasabi Hot Cloud Storage URLs
     */
    static _parseWasabiUrl(url, bucketInfo) {
        // https://bucket-name.s3.region.wasabisys.com/path
        const wasabiMatch = url.match(/^https?:\/\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])\.s3\.([a-z\-0-9]+)\.wasabisys\.com(?:\/(.*))?$/i);
        if (wasabiMatch) {
            bucketInfo.bucketName = wasabiMatch[1];
            bucketInfo.region = wasabiMatch[2];
            bucketInfo.path = wasabiMatch[3] || '';
            return bucketInfo;
        }

        throw new Error('Invalid Wasabi Hot Cloud Storage URL format');
    }

    /**
     * Parse Backblaze B2 Cloud Storage URLs
     */
    static _parseBackblazeUrl(url, bucketInfo) {
        // https://f003.backblazeb2.com/file/bucket-name/path
        const backblazeMatch = url.match(/^https?:\/\/(f[0-9]{3})\.backblazeb2\.com\/file\/([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])(?:\/(.*))?$/i);
        if (backblazeMatch) {
            bucketInfo.endpoint = backblazeMatch[1];
            bucketInfo.bucketName = backblazeMatch[2];
            bucketInfo.path = backblazeMatch[3] || '';
            return bucketInfo;
        }

        throw new Error('Invalid Backblaze B2 Cloud Storage URL format');
    }

    /**
     * Generate test URLs for bucket accessibility testing
     * @param {Object} bucketInfo - Parsed bucket information
     * @returns {Array} Array of test URLs to check for public access
     */
    static generateTestUrls(bucketInfo) {
        const testUrls = [];

        switch (bucketInfo.provider) {
            case 'aws':
                testUrls.push(...this._generateAwsTestUrls(bucketInfo));
                break;
            case 'gcp':
                testUrls.push(...this._generateGcpTestUrls(bucketInfo));
                break;
            case 'azure':
                testUrls.push(...this._generateAzureTestUrls(bucketInfo));
                break;
            case 'digitalocean':
                testUrls.push(...this._generateDigitalOceanTestUrls(bucketInfo));
                break;
            case 'alibaba':
                testUrls.push(...this._generateAlibabaTestUrls(bucketInfo));
                break;
            case 'ibm':
                testUrls.push(...this._generateIbmTestUrls(bucketInfo));
                break;
            case 'oracle':
                testUrls.push(...this._generateOracleTestUrls(bucketInfo));
                break;
            case 'wasabi':
                testUrls.push(...this._generateWasabiTestUrls(bucketInfo));
                break;
            case 'backblaze':
                testUrls.push(...this._generateBackblazeTestUrls(bucketInfo));
                break;
        }

        return testUrls;
    }

    /**
     * Generate AWS S3 test URLs
     */
    static _generateAwsTestUrls(bucketInfo) {
        const testUrls = [];
        const { bucketName, region } = bucketInfo;

        if (bucketInfo.isWebsite) {
            // S3 website endpoints don't support listing
            return testUrls;
        }

        // Virtual-hosted style (preferred)
        if (region && region !== 'us-east-1') {
            testUrls.push(`https://${bucketName}.s3.${region}.amazonaws.com/`);
        } else {
            testUrls.push(`https://${bucketName}.s3.amazonaws.com/`);
        }

        // Path style (legacy, but still works)
        if (region && region !== 'us-east-1') {
            testUrls.push(`https://s3.${region}.amazonaws.com/${bucketName}/`);
        } else {
            testUrls.push(`https://s3.amazonaws.com/${bucketName}/`);
        }

        return testUrls;
    }

    /**
     * Generate Google Cloud Storage test URLs
     */
    static _generateGcpTestUrls(bucketInfo) {
        const { bucketName } = bucketInfo;
        return [
            `https://storage.googleapis.com/${bucketName}/`,
            `https://storage.cloud.google.com/${bucketName}/`
        ];
    }

    /**
     * Generate Azure Blob Storage test URLs
     */
    static _generateAzureTestUrls(bucketInfo) {
        const { accountName, bucketName, region } = bucketInfo;
        const testUrls = [];

        let domain = 'windows.net';
        if (region === 'china') {
            domain = 'chinacloudapi.cn';
        } else if (region === 'usgov') {
            domain = 'usgovcloudapi.net';
        }

        testUrls.push(`https://${accountName}.blob.core.${domain}/${bucketName}?restype=container&comp=list`);
        
        return testUrls;
    }

    /**
     * Generate DigitalOcean Spaces test URLs
     */
    static _generateDigitalOceanTestUrls(bucketInfo) {
        const { bucketName, region } = bucketInfo;
        return [
            `https://${bucketName}.${region}.digitaloceanspaces.com/`
        ];
    }

    /**
     * Generate Alibaba Cloud OSS test URLs
     */
    static _generateAlibabaTestUrls(bucketInfo) {
        const { bucketName, region, isInternal } = bucketInfo;
        const endpoint = isInternal ? `oss-${region}-internal` : `oss-${region}`;
        return [
            `https://${bucketName}.${endpoint}.aliyuncs.com/`
        ];
    }

    /**
     * Generate IBM Cloud Object Storage test URLs
     */
    static _generateIbmTestUrls(bucketInfo) {
        const { bucketName, region } = bucketInfo;
        return [
            `https://${bucketName}.s3.${region}.cloud-object-storage.appdomain.cloud/`
        ];
    }

    /**
     * Generate Oracle Cloud Infrastructure test URLs
     */
    static _generateOracleTestUrls(bucketInfo) {
        const { bucketName, region, namespace } = bucketInfo;
        return [
            `https://objectstorage.${region}.oraclecloud.com/n/${namespace}/b/${bucketName}/o/`
        ];
    }

    /**
     * Generate Wasabi test URLs
     */
    static _generateWasabiTestUrls(bucketInfo) {
        const { bucketName, region } = bucketInfo;
        return [
            `https://${bucketName}.s3.${region}.wasabisys.com/`
        ];
    }

    /**
     * Generate Backblaze B2 test URLs
     */
    static _generateBackblazeTestUrls(bucketInfo) {
        // Backblaze B2 doesn't support direct bucket listing via HTTP
        // Would require API authentication
        return [];
    }

    /**
     * Normalize a URL for consistent processing
     * @param {string} url - The URL to normalize
     * @returns {string} Normalized URL
     */
    static normalizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        const trimmed = url.trim();
        if (trimmed === '') return '';
        
        // Remove trailing slashes
        let normalized = trimmed.replace(/\/+$/, '');
        
        // Ensure protocol is present for URLs that don't have special protocols
        if (!/^https?:\/\//.test(normalized) && !normalized.startsWith('s3://') && !normalized.startsWith('gs://')) {
            // Only add https if it looks like a domain/URL
            if (normalized.includes('.') || normalized.includes('/')) {
                normalized = 'https://' + normalized;
            }
        }
        
        return normalized;
    }

    /**
     * Validate if a URL appears to be a valid cloud storage URL
     * @param {string} url - The URL to validate
     * @returns {boolean} True if URL appears valid
     */
    static isValidCloudStorageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Basic URL structure validation
        if (url.length > 2048) return false;
        // Allow encoded spaces (%20) but reject unencoded spaces
        if (url.includes(' ') && !url.includes('%20')) return false;
        
        const normalized = this.normalizeUrl(url);
        
        // Additional security checks
        if (this._containsSuspiciousPatterns(normalized)) {
            return false;
        }

        // Check against known cloud storage patterns
        const patterns = [
            // AWS S3
            /^(?:s3:\/\/|https?:\/\/(?:[\w\-]+\.)?s3(?:[\w\-\.]*)?\.amazonaws\.com)/i,
            // Google Cloud Storage
            /^(?:gs:\/\/|https?:\/\/storage\.(?:googleapis|cloud\.google)\.com)/i,
            // Azure Blob Storage
            /^https?:\/\/[\w\-]+\.blob\.core\.(?:windows\.net|chinacloudapi\.cn|usgovcloudapi\.net)/i,
            // DigitalOcean Spaces
            /^https?:\/\/[\w\-]+\.(?:nyc3|ams3|sgp1|sfo2|fra1|blr1|syd1)\.(?:cdn\.)?digitaloceanspaces\.com/i,
            // Alibaba Cloud OSS
            /^https?:\/\/[\w\-]+\.oss-[\w\-]+(?:-internal)?\.aliyuncs\.com/i,
            // IBM Cloud Object Storage
            /^https?:\/\/[\w\-]+\.s3\.[\w\-]+\.cloud-object-storage\.appdomain\.cloud/i,
            // Oracle Cloud Infrastructure
            /^https?:\/\/objectstorage\.[\w\-]+\.oraclecloud\.com/i,
            // Wasabi
            /^https?:\/\/[\w\-]+\.s3\.[\w\-]+\.wasabisys\.com/i,
            // Backblaze B2
            /^https?:\/\/f[0-9]{3}\.backblazeb2\.com/i
        ];
        
        return patterns.some(pattern => pattern.test(normalized));
    }

    /**
     * Check for suspicious patterns that might indicate malicious URLs
     * @private
     */
    static _containsSuspiciousPatterns(url) {
        const suspiciousPatterns = [
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /<script/i,
            /onload=/i,
            /onerror=/i,
            /\.\.\/\.\.\//,  // Path traversal
            /%2e%2e%2f/i,    // Encoded path traversal
            /localhost/i,
            /127\.0\.0\.1/,
            /192\.168\./,
            /10\./,
            /172\.(1[6-9]|2[0-9]|3[0-1])\./  // Private IP ranges
        ];

        return suspiciousPatterns.some(pattern => pattern.test(url));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BucketParser;
}

// For browser environment
if (typeof window !== 'undefined') {
    window.BucketParser = BucketParser;
}