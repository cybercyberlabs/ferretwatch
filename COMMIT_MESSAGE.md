fix: resolve console output issues and add debug mode toggle

## Problem
- Duplicate security messages appeared in console
- Finding values were missing, making output unusable
- No way to get detailed debug information

## Solution
- Fixed duplicate message logging in scanner and content script
- Enhanced console output to show actual URLs and values
- Added debug mode toggle in extension settings
- Improved information display with clear status indicators

## Changes
- content.js: Fixed duplicate variable declaration, improved output logic
- popup/*: Added debug mode UI, persistence, and styling  
- utils/scanner.js: Reduced duplicate logging
- Cleaned up development files and documentation

## Output Examples
Normal: `[FerretWatch] ⚠️ AWS S3 Bucket: https://example.com (PUBLIC LISTING)`
Debug: Detailed scan results with technical information

Fixes console output usability and adds developer debugging capabilities.