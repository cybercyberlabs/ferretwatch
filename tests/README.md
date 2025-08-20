# FerretWatch - Testing Guide

## Overview

Comprehensive testing framework for the FerretWatch extension covering unit tests, integration tests, and performance benchmarks.

## Test Structure

```
tests/
├── framework.js              # Custom testing framework
├── test-runner.js           # Test orchestrator
├── test-runner.html         # Browser test interface
├── unit/                    # Unit tests
├── integration/             # Integration tests
├── performance/             # Performance tests
└── cross-browser/           # Cross-browser compatibility
```

## Running Tests

### Browser-Based Testing
1. Open `test-runner.html` in Firefox
2. Click "Run All Tests"
3. View results and export reports

### Command Line Testing
```bash
# Run all tests
node tests/test-runner.js

# Run specific suites
node tests/test-runner.js --unit-only
node tests/test-runner.js --no-performance
```

## Test Coverage

- **Pattern Validation**: 60+ security patterns
- **Risk Assessment**: Critical, high, medium, low classifications  
- **Export Functionality**: JSON/CSV export with metadata
- **Performance**: Scalability up to 1MB content
- **Cross-browser**: Firefox, Chrome, Edge compatibility

## Performance Thresholds

- Small content (1KB): < 100ms
- Medium content (10KB): < 250ms  
- Large content (100KB): < 500ms
- Memory usage: < 50MB delta per operation

## Development

### Adding Tests
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Performance tests: `tests/performance/`

### Test Pattern
```javascript
testFramework.test('Test description', async () => {
    // Arrange
    const testData = createTestData();
    
    // Act
    const result = await functionToTest(testData);
    
    // Assert
    Assert.equal(result.status, 'success', 'Should return success');
});
```

## CI/CD Integration

```bash
# Automated testing
node tests/test-runner.js --quiet --continue-on-failure
```

Exit code: 0 = success, 1 = failure
