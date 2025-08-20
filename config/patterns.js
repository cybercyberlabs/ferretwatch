/**
 * Security Pattern Configurations
 * Organized by category for better maintainability
 */

const SECURITY_PATTERNS = {
    // AWS Credentials
    aws: {
        accessKey: {
            pattern: /AKIA[0-9A-Z]{16}/gi,
            description: "AWS Access Key ID",
            riskLevel: "high"
        },
        secretKey: {
            pattern: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9\/+=]{40})['"]?/gi,
            description: "AWS Secret Access Key",
            riskLevel: "critical"
        }
    },

    // GitHub Tokens
    github: {
        classicToken: {
            pattern: /ghp_[a-zA-Z0-9]{36}/gi,
            description: "GitHub Personal Access Token",
            riskLevel: "high"
        },
        fineGrainedToken: {
            pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/gi,
            description: "GitHub Fine-grained Token",
            riskLevel: "high"
        },
        appToken: {
            pattern: /ghs_[a-zA-Z0-9]{36}/gi,
            description: "GitHub App Token",
            riskLevel: "high"
        }
    },

    // Slack Tokens
    slack: {
        botToken: {
            pattern: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/gi,
            description: "Slack Bot Token",
            riskLevel: "high"
        },
        userToken: {
            pattern: /xoxp-[0-9]{11,13}-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{32}/gi,
            description: "Slack User Token",
            riskLevel: "high"
        },
        appToken: {
            pattern: /xapp-[0-9]-[A-Z0-9]{8,14}-[0-9]{10,13}-[a-f0-9]{64}/gi,
            description: "Slack App Token",
            riskLevel: "medium"
        }
    },

    // Discord Tokens
    discord: {
        botToken: {
            pattern: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/gi,
            description: "Discord Bot Token",
            riskLevel: "high"
        }
    },

    // API Keys (Generic)
    apiKeys: {
        quoted: {
            pattern: null, // Will be generated dynamically
            description: "API Key (Quoted)",
            riskLevel: "medium"
        },
        urlParam: {
            pattern: null, // Will be generated dynamically
            description: "API Key (URL Parameter)",
            riskLevel: "medium"
        }
    },


    // Cloud Provider Keys
    azure: {
        storageKey: {
            pattern: /[a-zA-Z0-9+\/]{88}==/gi,
            description: "Azure Storage Account Key",
            riskLevel: "high"
        },
        clientSecret: {
            pattern: /(?:azure[_-]?client[_-]?secret|AZURE[_-]?CLIENT[_-]?SECRET)\s*[:=]\s*['"]?([a-zA-Z0-9~._-]{34,40})['"]?/gi,
            description: "Azure Client Secret",
            riskLevel: "high"
        },
        connectionString: {
            pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/gi,
            description: "Azure Connection String",
            riskLevel: "critical"
        }
    },

    gcp: {
        serviceAccount: {
            pattern: /"type"\s*:\s*"service_account"[\s\S]*?"private_key"\s*:\s*"-----BEGIN\s+PRIVATE\s+KEY-----[^"]+-----END\s+PRIVATE\s+KEY-----"/gi,
            description: "Google Cloud Service Account Key",
            riskLevel: "critical"
        },
        apiKey: {
            pattern: /AIza[0-9A-Za-z\-_]{35}/gi,
            description: "Google API Key",
            riskLevel: "medium"
        }
    },

    // JWT Tokens
    jwt: {
        token: {
            pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
            description: "JWT Token",
            riskLevel: "medium"
        }
    },

    // Additional API Keys
    services: {
        stripeKey: {
            pattern: /(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}/gi,
            description: "Stripe API Key",
            riskLevel: "high"
        },
        twilioSid: {
            pattern: /AC[a-z0-9]{32}/gi,
            description: "Twilio Account SID",
            riskLevel: "medium"
        },
        twilioToken: {
            pattern: /(?:twilio[_-]?(?:auth[_-]?)?token|TWILIO[_-]?(?:AUTH[_-]?)?TOKEN)\s*[:=]\s*['"]?([a-f0-9]{32})['"]?/gi,
            description: "Twilio Auth Token",
            riskLevel: "high"
        },
        sendgridKey: {
            pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/gi,
            description: "SendGrid API Key",
            riskLevel: "high"
        },
        mailgunKey: {
            pattern: /key-[a-f0-9]{32}/gi,
            description: "Mailgun API Key",
            riskLevel: "medium"
        }
    },

    // Passwords
    passwords: {
        quoted: {
            pattern: /password\s*[:=]\s*['"]([a-zA-Z0-9_\-\.]{8,})['"]/gi,
            description: "Password",
            riskLevel: "high"
        }
    },
    
    // Certificates and Private Keys
    keys_and_certificates: {
        privateKey: {
            pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/gi,
            description: "Private Key",
            riskLevel: "critical"
        },
        certificate: {
            pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gi,
            description: "X.509 Certificate",
            riskLevel: "high"
        },
        opensshPrivateKey: {
            pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/gi,
            description: "OpenSSH Private Key",
            riskLevel: "critical"
        },
        pgpPrivateKey: {
            pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/gi,
            description: "PGP Private Key",
            riskLevel: "critical"
        },
        sshPrivateKey: {
            pattern: /-----BEGIN\s+(?:RSA\s+|DSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|DSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
            description: "SSH Private Key",
            riskLevel: "critical"
        }
    },
    
    // Database Connection Strings
    database: {
        connectionString: {
            pattern: /(?:mongodb(?:\+srv)?:\/\/|mysql:\/\/|postgres:\/\/|postgresql:\/\/|redis:\/\/)[^"%'\s]+/gi,
            description: "Database Connection String",
            riskLevel: "critical"
        },
        mysql: {
            pattern: /mysql:\/\/[^:\s]+:[^@\s]+@[^\/\s]+\/[^\s]+/gi,
            description: "MySQL Connection String",
            riskLevel: "critical"
        },
        postgres: {
            pattern: /postgres:\/\/[^:\s]+:[^@\s]+@[^\/\s]+\/[^\s]+/gi,
            description: "PostgreSQL Connection String", 
            riskLevel: "critical"
        },
        mongodb: {
            pattern: /mongodb:\/\/[^:\s]+:[^@\s]+@[^\/\s]+\/[^\s]+/gi,
            description: "MongoDB Connection String",
            riskLevel: "critical"
        },
        sqlServer: {
            pattern: /Server=[\w\-\.]+;Database=[\w\-\.]+;User Id=[\w\-\.]+;Password=[\w\-\.]+/gi,
            description: "SQL Server Connection String",
            riskLevel: "critical"
        }
    },
    
    // Environment Variables and Config
    environment: {
        envSecret: {
            pattern: /(?:^|\s)(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE)_[A-Z_0-9]+=[\w\-\.\/\+=]{10,}/gim,
            description: "Environment Variable Secret",
            riskLevel: "high"
        },
        dotenv: {
            pattern: /(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*[^\s\n]+/gi,
            description: "Environment File Secret",
            riskLevel: "high"
        }
    }
};

// Key names for dynamic pattern generation
const API_KEY_NAMES = [
    'api[_\\-]?key',
    'access[_\\-]?token',
    'secret[_\\-]?key',
    'auth[_\\-]?token',
    'client[_\\-]?secret',
    'jwt[_\\-]?token',
    'aws[_\\-]?key',
    'consumer[_\\-]?key',
    'consumer[_\\-]?secret',
    'cloud[_\\-]?api[_\\-]?key',
    'firebase[_\\-]?token',
    'google[_\\-]?api[_\\-]?key',
    'stripe[_\\-]?key',
    'cloudflare[_\\-]?api[_\\-]?key',
    'datadog[_\\-]?api[_\\-]?key',
    'heroku[_\\-]?api[_\\-]?key',
    's3[_\\-]?access[_\\-]?key',
    'mongodb[_\\-]?uri'
];

// Generate dynamic patterns
function generateDynamicPatterns() {
    const keyNames = API_KEY_NAMES.join('|');
    
    SECURITY_PATTERNS.apiKeys.quoted.pattern = new RegExp(
        `(?:${keyNames})\\s*[:=]\\s*['"]([a-zA-Z0-9_\\-.]{16,})['"]`, 'gi'
    );
    
    SECURITY_PATTERNS.apiKeys.urlParam.pattern = new RegExp(
        `(?:${keyNames})=([a-zA-Z0-9_\\-.]{20,})`, 'gi'
    );
}

// Initialize dynamic patterns
generateDynamicPatterns();

// Common false positive patterns
const FALSE_POSITIVE_PATTERNS = [
    // Common placeholders
    /(?:YOUR_|your_|example|test|dummy|placeholder|sample|demo)/i,
    // UI-related false positives
    /(?:key|token):\s*(?:"|%27)(?:_|\w{1,15}(?:Cell|Column|Height|Width|Size|Position|Count|Cache|Data|Ref|Change|View|Scroll|Index|Range))(?:"|%27)/i,
    // Short or obvious fake values
    /^[a-z]{1,5}$/i,
    /^(test|demo|example|fake|mock)$/i
];

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SECURITY_PATTERNS, FALSE_POSITIVE_PATTERNS };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.SECURITY_PATTERNS = SECURITY_PATTERNS;
    window.FALSE_POSITIVE_PATTERNS = FALSE_POSITIVE_PATTERNS;
}
