# Changelog

## [2.2.0] - Console Output Improvements & Debug Mode

### Added
- **Debug Mode Toggle**: Added debug mode setting in extension popup
  - Accessible via Settings → "Enable detailed console output"
  - Shows comprehensive scan results, low-risk findings, and technical details
  - Persists across browser sessions

### Fixed
- **Duplicate Console Messages**: Eliminated duplicate security alert messages
- **Missing Finding Values**: Console now shows actual URLs and credential values
- **Improved Information Display**: 
  - Normal mode shows concise, actionable findings with actual values
  - Debug mode provides detailed technical information
  - Clear status indicators (PUBLIC LISTING, ACCESSIBLE, SECURED)

### Changed
- **Console Output Format**:
  - **Normal Mode**: `[FerretWatch] ⚠️ AWS S3 Bucket: https://example.com (PUBLIC LISTING)`
  - **Debug Mode**: Detailed scan results with styled output, individual finding breakdowns, and low-risk findings
- **Settings UI**: Added debug mode section to settings modal with proper styling

### Technical Details
- Updated `content.js` to fix duplicate `lowRiskFindings` variable declaration
- Enhanced `popup.js` with debug mode persistence logic
- Added CSS styles for debug mode toggle in `popup.css`
- Improved `utils/scanner.js` to reduce duplicate logging
- Updated settings loading to include debug mode from browser storage

### Developer Experience
- Removed development test files and spec documentation
- Clean codebase ready for production
- Debug mode provides detailed information for troubleshooting and analysis