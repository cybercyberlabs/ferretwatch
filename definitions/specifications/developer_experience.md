---
layout: spec
title: Developer Experience Documentation
description: Development environment, tools, processes, and documentation for productive development with high-quality contributions
date: 2025-09-25
version: 1.0
toc: true
---
# 👨‍💻 Developer Experience Documentation

## 1. Purpose & Scope
This document defines the development environment, tools, processes, and documentation needed to ensure productive development of FerretWatch Enhanced with high-quality contributions from both internal and external developers.

## 2. Development Environment Setup

### 2.1 Prerequisites
**Required Software**:
- Node.js >= 18.0.0 (LTS recommended)
- npm >= 9.0.0 or yarn >= 3.0.0
- Git >= 2.35.0
- Docker >= 20.10.0 (for local services)
- Chrome/Firefox/Edge for testing

**Recommended Tools**:
- Visual Studio Code with recommended extensions
- Chrome DevTools for extension debugging
- Postman/Insomnia for API testing
- Docker Compose for service orchestration

### 2.2 Quick Start Guide
```bash
# Clone the repository
git clone https://github.com/ferretwatch/extension.git
cd extension

# Install dependencies
npm install

# Set up local environment
npm run setup

# Start development mode
npm run dev

# Build for testing
npm run build:dev

# Load unpacked extension in browser
# Chrome: chrome://extensions/ > Load unpacked > dist/
# Firefox: about:debugging > This Firefox > Load Temporary Add-on
```

### 2.3 Project Structure
```
ferretwatch-extension/
├── src/                    # Source code
│   ├── background/         # Service worker/background scripts
│   ├── content/           # Content scripts
│   ├── popup/             # Extension popup UI
│   ├── options/           # Settings page
│   ├── detection/         # Threat detection modules
│   │   ├── heuristics/    # Detection algorithms
│   │   ├── yara/          # YARA integration
│   │   ├── scoring/       # Threat scoring engine
│   │   └── rules/         # Rule management
│   ├── utils/             # Shared utilities
│   └── types/             # TypeScript definitions
├── tests/                 # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
├── config/                # Configuration files
└── dist/                  # Build output
```

## 3. Development Workflow

### 3.1 Git Workflow
**Branch Strategy**:
- `main` → Production-ready code
- `develop` → Integration branch for features
- `feature/*` → Feature development branches
- `hotfix/*` → Critical bug fixes
- `release/*` → Release preparation

**Commit Standards**:
```
type(scope): description

feat(detection): add IDN homograph detection
fix(popup): resolve UI alignment issue
docs(api): update rule authoring guide
test(scoring): add edge case coverage
perf(yara): optimize rule compilation
```

### 3.2 Code Review Process
**Review Requirements**:
- All changes require peer review
- Security-sensitive changes require security team review
- Performance changes require performance review
- UI changes require UX review

**Review Checklist**:
- [ ] Code follows style guide and linting rules
- [ ] Tests added/updated with adequate coverage
- [ ] Documentation updated if needed
- [ ] Performance impact assessed
- [ ] Security implications considered
- [ ] Accessibility requirements met

### 3.3 Testing During Development
**Local Testing**:
```bash
# Run unit tests
npm run test

# Run unit tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run all tests
npm run test:all
```

**Manual Testing**:
- Test with known phishing samples
- Verify performance on high-traffic sites
- Test across different browsers
- Validate accessibility with screen readers

## 4. Rule Development

### 4.1 YARA Rule Authoring
**Rule Structure**:
```yara
rule PhishingKit_GenericLogin
{
    meta:
        description = "Detects generic phishing login forms"
        severity = "medium"
        category = "phishing"
        author = "FerretWatch Team"

    strings:
        $login_form = /<form[^>]*action\s*=\s*["'][^"']*login/
        $password_field = /<input[^>]*type\s*=\s*["']password["']/
        $suspicious_js = /document\.location\s*=\s*["'][^"']*\/\w+\.php/

    condition:
        $login_form and $password_field and $suspicious_js
}
```

**Testing Rules**:
```bash
# Validate rule syntax
npm run yara:validate rules/phishing.yar

# Test rule against sample set
npm run yara:test rules/phishing.yar tests/samples/

# Benchmark rule performance
npm run yara:benchmark rules/phishing.yar
```

### 4.2 Heuristic Development
**Detection Module Template**:
```typescript
import { DetectionModule, DetectionResult } from '../types';

export class IDNHomographDetector implements DetectionModule {
  name = 'idn_homograph';

  async detect(context: PageContext): Promise<DetectionResult> {
    // Implementation
    return {
      findings: [{
        key: 'idn_homograph_medium',
        evidence: 'Domain contains confusable characters',
        confidence: 0.85
      }],
      metadata: {
        processingTime: Date.now() - startTime
      }
    };
  }
}
```

### 4.3 Rule Pack Generation
**Build Process**:
```bash
# Generate rule pack from sources
npm run rules:build

# Validate rule pack integrity
npm run rules:validate dist/rules.json

# Test rule pack against sample corpus
npm run rules:test dist/rules.json tests/corpus/

# Sign rule pack for distribution
npm run rules:sign dist/rules.json
```

## 5. API Documentation

### 5.1 Extension APIs
**Detection Engine API**:
```typescript
// Register custom detection module
engine.registerModule(new CustomDetector());

// Run detection on current page
const result = await engine.detect(window.location.href);

// Subscribe to detection results
engine.onDetection((result) => {
  console.log('Threat detected:', result);
});
```

**Settings API**:
```typescript
// Get user settings
const settings = await Settings.get();

// Update threshold
await Settings.update({ alertThreshold: 60 });

// Listen for settings changes
Settings.onChange((changes) => {
  console.log('Settings updated:', changes);
});
```

### 5.2 Admin API Documentation
**Report Management**:
```javascript
// Get pending reports
GET /api/reports?status=pending&limit=50

// Update report status
PATCH /api/reports/{id}
{
  "status": "verified",
  "reviewer": "admin@ferretwatch.com",
  "notes": "Confirmed phishing site"
}
```

**Rule Management**:
```javascript
// Publish new rule pack
POST /api/rules/publish
{
  "version": "2025.09.25.1",
  "rules": [/* rule definitions */],
  "signature": "..."
}
```

## 6. Debugging and Troubleshooting

### 6.1 Debug Configuration
**Development Build**:
- Source maps enabled for stack traces
- Detailed logging to browser console
- Performance timing instrumentation
- Debug UI panels for detection results

**Debug Tools**:
```typescript
// Enable debug mode
localStorage.setItem('ferretwatch:debug', 'true');

// Access debug API
window.__ferretwatch__.debug.getLastDetection();
window.__ferretwatch__.debug.simulateDetection('phishing');
window.__ferretwatch__.debug.clearCache();
```

### 6.2 Common Issues
**Extension Not Loading**:
- Check manifest.json syntax
- Verify all required permissions
- Check browser console for errors
- Ensure all files are included in build

**Detection Not Working**:
- Verify rule pack loaded successfully
- Check detection module registration
- Review content script injection
- Test with known positive samples

**Performance Issues**:
- Profile with browser DevTools
- Check for memory leaks
- Monitor CPU usage during detection
- Optimize YARA rule complexity

### 6.3 Logging and Monitoring
**Development Logging**:
```typescript
import { Logger } from '../utils/logger';

const log = Logger.getLogger('IDNDetector');

log.debug('Processing domain:', domain);
log.info('Detection completed:', result);
log.warn('Performance threshold exceeded:', timing);
log.error('Detection failed:', error);
```

**Production Monitoring**:
- Error tracking with stack traces
- Performance metric collection
- Feature usage analytics
- A/B test result tracking

## 7. Documentation Standards

### 7.1 Code Documentation
**JSDoc Standards**:
```typescript
/**
 * Detects IDN homograph attacks in domain names
 * @param domain - The domain to analyze
 * @param brandList - Known legitimate brands to compare against
 * @returns Detection result with confidence score
 * @throws {ValidationError} When domain format is invalid
 * @example
 * const result = await detectHomograph('xn--80ak6aa92e.com', brands);
 */
async function detectHomograph(
  domain: string,
  brandList: Brand[]
): Promise<DetectionResult> {
  // Implementation
}
```

**README Templates**:
- Module purpose and scope
- Installation and setup instructions
- Usage examples with code snippets
- API reference with parameters
- Contributing guidelines
- License and attribution

### 7.2 Technical Specifications
**Architecture Decision Records (ADR)**:
```markdown
# ADR-001: WASM YARA Engine Integration

## Status
Accepted

## Context
Need efficient malware signature matching...

## Decision
Implement YARA engine in WebAssembly...

## Consequences
+ Performance benefits
+ Existing rule compatibility
- Increased bundle size
- WASM debugging complexity
```

### 7.3 User Documentation
**User Guide Topics**:
- Getting started and installation
- Understanding threat alerts
- Configuring settings and thresholds
- Reporting false positives
- Privacy and data handling
- Troubleshooting common issues

## 8. Testing Support

### 8.1 Test Development
**Test Framework Setup**:
```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IDNDetector } from '../src/detection/idn';

describe('IDNDetector', () => {
  let detector: IDNDetector;

  beforeEach(() => {
    detector = new IDNDetector();
  });

  it('should detect homograph attacks', async () => {
    const result = await detector.detect('pаypal.com'); // Cyrillic 'а'
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        key: 'idn_homograph_high'
      })
    );
  });
});
```

**Mock Services**:
```typescript
// Mock threat intelligence API
const mockThreatIntel = {
  checkReputation: jest.fn().mockResolvedValue({
    reputation: 'clean',
    sources: ['phishtank']
  })
};
```

### 8.2 Test Data Management
**Sample Generation**:
```bash
# Generate phishing samples
npm run samples:generate -- --type=phishing --count=100

# Create test corpus from feeds
npm run corpus:update phishtank urlhaus

# Anonymize production data for testing
npm run data:anonymize prod-logs.json test-data.json
```

## 9. Build and Deployment

### 9.1 Build Configuration
**Development Build**:
```json
{
  "name": "ferretwatch-dev",
  "version": "0.0.0-dev",
  "permissions": ["*://*/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'unsafe-eval'"
  }
}
```

**Production Build**:
```json
{
  "name": "FerretWatch Enhanced",
  "version": "2.1.0",
  "permissions": ["activeTab", "storage"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'"
  }
}
```

### 9.2 Deployment Scripts
```bash
# Build for all browsers
npm run build:all

# Package for store submission
npm run package:chrome
npm run package:firefox
npm run package:edge

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## 10. Community Contribution

### 10.1 Contribution Guidelines
**Getting Started**:
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Participate in code review

**Types of Contributions**:
- Bug fixes and improvements
- New detection modules
- YARA rule contributions
- Documentation improvements
- Translation contributions
- User interface enhancements

### 10.2 Recognition and Support
**Contributor Recognition**:
- Contributors file maintenance
- GitHub contributor statistics
- Release notes acknowledgments
- Community showcase features

**Support Channels**:
- GitHub Discussions for questions
- Discord server for real-time chat
- Weekly developer office hours
- Monthly community calls

## 11. Success Metrics

### 11.1 Developer Productivity
- **Setup Time**: < 15 minutes from clone to running locally
- **Build Speed**: < 2 minutes for full production build
- **Test Execution**: < 30 seconds for unit test suite
- **Hot Reload**: < 3 seconds for development changes

### 11.2 Code Quality
- **Test Coverage**: > 90% for all modules
- **Documentation Coverage**: 100% of public APIs documented
- **Code Style**: 100% compliance with automated linting
- **Security Scan**: Zero high/critical vulnerabilities

### 11.3 Community Health
- **Contribution Rate**: > 10 external contributions per month
- **Issue Response**: < 48 hours for initial response
- **Pull Request Review**: < 72 hours for review completion
- **Documentation Quality**: > 4.0/5.0 developer satisfaction rating