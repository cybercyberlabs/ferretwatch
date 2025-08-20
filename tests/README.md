# Firefox Credential Scanner - Testing Guide

## Overview

The Firefox Credential Scanner Extension includes a comprehensive testing framework to ensure reliability, performance, and security. This testing suite covers unit tests, integration tests, and performance benchmarks.

## Test Structure

```
tests/
├── framework.js              # Custom testing framework
├── test-runner.js           # Master test orchestrator
├── test-runner.html         # Browser-based test interface
├── unit/                    # Unit tests
│   ├── patterns.test.js     # Pattern validation tests
│   └── utils.test.js        # Utility function tests
├── integration/             # Integration tests
│   └── scanning.test.js     # Full pipeline tests
└── performance/             # Performance tests
    └── benchmarks.test.js   # Performance benchmarks
```

## Running Tests

### Option 1: Browser-Based Testing (Recommended)

1. Open `test-runner.html` in Firefox
2. Click "Run All Tests" to execute the complete test suite
3. View results in real-time with detailed reporting
4. Export test reports as JSON files

**Features:**
- Interactive UI with progress tracking
- Real-time test results and error details
- Performance metrics visualization
- Test report export functionality
- Selective test suite execution

### Option 2: Node.js Testing

```bash
# Run all tests
node tests/test-runner.js

# Run specific test suites
node tests/test-runner.js --unit-only
node tests/test-runner.js --no-performance
node tests/test-runner.js --continue-on-failure

# Run individual test files
node tests/unit/patterns.test.js
node tests/integration/scanning.test.js
node tests/performance/benchmarks.test.js
```

**Command Line Options:**
- `--unit-only`: Run only unit tests
- `--no-performance`: Skip performance benchmarks
- `--continue-on-failure`: Continue running tests even if some fail
- `--quiet`: Suppress verbose output

## Test Framework Features

### Custom TestFramework Class

Our custom testing framework provides:

- **Async/await support** for modern JavaScript testing
- **Comprehensive assertions** with detailed error messages
- **Performance timing** built into every test
- **Browser extension mocking** via MockHelpers
- **Detailed reporting** with success/failure statistics

### Assert Methods

```javascript
Assert.equal(actual, expected, message)
Assert.notEqual(actual, expected, message)
Assert.true(value, message)
Assert.false(value, message)
Assert.arrayLength(array, expectedLength, message)
Assert.arrayIncludes(array, value, message)
Assert.objectHasProperty(obj, property, message)
Assert.throws(fn, message)
Assert.ok(value, message)
```

### MockHelpers

The MockHelpers class provides browser extension testing utilities:

```javascript
MockHelpers.mockBrowserAPI()        // Mock browser.* APIs
MockHelpers.mockDOM()               // Mock DOM manipulation
MockHelpers.mockNotifications()     // Mock notification system
MockHelpers.mockStorage()           // Mock browser storage
```

## Test Suites

### Unit Tests

#### Pattern Validation (`patterns.test.js`)
Tests all 60+ security pattern detections including:
- AWS credentials (access keys, secret keys, session tokens)
- GitHub tokens (personal, fine-grained, app tokens)
- API keys (generic patterns, service-specific)
- Database credentials (MySQL, PostgreSQL, MongoDB)
- Certificates and private keys
- Cloud provider credentials (Azure, GCP)
- Messaging platform tokens (Slack, Discord)

**Key Tests:**
- Pattern accuracy validation
- Risk level assignment verification
- False positive filtering
- Performance benchmarking per pattern

#### Utility Functions (`utils.test.js`)
Tests core utility functions:
- Entropy calculation accuracy
- Secret masking functionality
- Context filtering (script tags, CSS, minified code)
- Storage operations
- Configuration management

### Integration Tests

#### Scanning Pipeline (`scanning.test.js`)
End-to-end testing of the complete scanning workflow:
- Multi-pattern detection in complex content
- Export functionality (JSON/CSV formats)
- Session history management
- Error handling and recovery
- Configuration updates
- Performance under load

**Mock Components:**
- MockScanner: Simulates the scanning engine
- MockExportManager: Tests export functionality
- TestDataGenerator: Creates realistic test content

### Performance Tests

#### Benchmarks (`benchmarks.test.js`)
Comprehensive performance analysis:

**Performance Metrics:**
- Execution time measurement
- Memory usage tracking
- Pattern matching efficiency
- DOM manipulation performance
- Export performance with large datasets

**Benchmark Categories:**
- Small content (1KB): < 100ms target
- Medium content (10KB): < 250ms target  
- Large content (100KB): < 500ms target
- Very large content (1MB): Performance analysis
- Concurrent scanning: Multiple simultaneous scans
- Memory efficiency: Leak detection

**Test Data Sizes:**
- Small: 1,000 characters
- Medium: 10,000 characters
- Large: 100,000 characters
- XLarge: 1,000,000 characters

## Performance Thresholds

The testing framework includes performance thresholds to ensure production readiness:

- **Scan Time**: Maximum 500ms for large content
- **Memory Usage**: Maximum 50MB delta per operation
- **Pattern Matching**: Maximum 100ms per pattern
- **Concurrent Performance**: Support for 5+ simultaneous scans

## Test Coverage

Current test coverage includes:

### ✅ Unit Test Coverage
- **Patterns**: 60+ security patterns validated
- **Risk Levels**: Critical, high, medium, low classifications
- **Entropy Analysis**: Shannon entropy calculations
- **Masking Functions**: Secret value protection
- **Context Filtering**: Smart content exclusions

### ✅ Integration Test Coverage
- **Scanning Pipeline**: Full end-to-end workflow
- **Export Functionality**: JSON/CSV export with metadata
- **Configuration Management**: Settings persistence and updates
- **Error Handling**: Graceful failure recovery
- **Session Management**: History tracking and cleanup

### ✅ Performance Test Coverage
- **Scalability**: Large content handling (up to 1MB)
- **Memory Management**: Leak detection and efficiency
- **Concurrency**: Multiple simultaneous operations
- **DOM Operations**: Element highlighting performance
- **Export Performance**: Large dataset handling

## Continuous Integration

### Test Automation
The test suite is designed for CI/CD integration:

```bash
# CI/CD command
node tests/test-runner.js --quiet --continue-on-failure

# Check exit code for success/failure
echo $? # 0 = success, 1 = failure
```

### Report Generation
Automatic test report generation includes:
- Test execution summary
- Performance metrics
- Memory usage analysis
- Failure details with stack traces
- Recommendations for improvements

## Browser Compatibility Testing

The test framework supports:
- **Firefox**: Primary target platform
- **Chrome**: Via Chromium compatibility layer
- **Node.js**: For CI/CD and development testing

## Development Workflow

### Adding New Tests

1. **Unit Tests**: Add to `tests/unit/` for individual functions
2. **Integration Tests**: Add to `tests/integration/` for workflows
3. **Performance Tests**: Add to `tests/performance/` for benchmarks

### Test Development Pattern
```javascript
// Example test case
testFramework.test('Description of test case', async () => {
    // Arrange: Set up test conditions
    const testData = createTestData();
    
    // Act: Execute the functionality
    const result = await functionToTest(testData);
    
    // Assert: Verify the results
    Assert.equal(result.status, 'success', 'Should return success');
    Assert.ok(result.data.length > 0, 'Should return data');
});
```

## Troubleshooting

### Common Issues

**Browser Permission Errors**
- Ensure the test page has necessary permissions
- Check browser security settings
- Use HTTPS for advanced browser APIs

**Performance Test Failures**
- Check available system memory
- Close other browser tabs during testing
- Adjust performance thresholds if needed

**Pattern Test Failures**
- Verify regex patterns are correctly escaped
- Check for browser-specific regex differences
- Update test expectations for pattern changes

### Debug Mode
Enable detailed logging:
```javascript
// In browser console
window.testDebug = true;

// In Node.js
process.env.TEST_DEBUG = 'true';
```

## Best Practices

### Writing Tests
- Use descriptive test names
- Include both positive and negative test cases
- Test edge cases and error conditions
- Keep tests independent and isolated
- Use appropriate assertion methods

### Performance Testing
- Test with realistic data sizes
- Monitor memory usage patterns
- Set appropriate performance thresholds
- Test concurrent operations
- Validate scalability assumptions

### Maintenance
- Update tests when adding new features
- Review and update performance thresholds
- Keep mock implementations in sync
- Regular performance baseline updates
- Monitor for test flakiness

## Contributing

When contributing to the test suite:

1. **Follow naming conventions**: `feature.test.js`
2. **Add appropriate test types**: Unit, integration, or performance
3. **Include documentation**: Comment complex test logic
4. **Update thresholds**: Adjust performance expectations as needed
5. **Test cross-browser**: Verify compatibility across platforms

## Conclusion

The Firefox Credential Scanner testing framework provides comprehensive coverage to ensure the extension's reliability, performance, and security. The combination of unit tests, integration tests, and performance benchmarks creates a robust quality assurance foundation for production deployment.
