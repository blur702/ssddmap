# Modular Validation Architecture

## Overview
The validation system has been refactored into a modular architecture where each API service (USPS, Census, Google Maps) operates as an independent module. This design ensures that changes to one module don't affect others, providing stability and maintainability.

## Architecture

```
ValidationOrchestrator
    ├── USPSValidator     (Independent module)
    ├── CensusValidator   (Independent module)
    └── GoogleValidator   (Independent module)
```

## Module Structure

### USPSValidator (`/services/validators/USPSValidator.js`)
- **Purpose**: Handles all USPS-specific validation logic
- **Dependencies**: USPSOAuthService for API communication
- **Key Features**:
  - OAuth token management
  - Address standardization
  - ZIP+4 lookup
  - District determination
  - Fallback to Census geocoding for coordinates

### CensusValidator (`/services/validators/CensusValidator.js`)
- **Purpose**: Handles Census Geocoder validation
- **Dependencies**: None (uses public API)
- **Key Features**:
  - Always available (no API key required)
  - Geographic coordinate lookup
  - District boundary calculations
  - Distance to boundary measurements

### GoogleValidator (`/services/validators/GoogleValidator.js`)
- **Purpose**: Handles Google Maps validation
- **Dependencies**: Google Maps API key
- **Key Features**:
  - High-accuracy geocoding
  - Address component parsing
  - Formatted address output
  - Commercial-grade reliability

## ValidationOrchestrator (`/services/ValidationOrchestrator.js`)
The orchestrator manages all validators and provides:
- Unified interface for validation requests
- Module status checking
- Multi-API validation coordination
- Result comparison and analysis
- Configuration management

## Key Benefits

### 1. **Module Independence**
Each validator operates independently:
```javascript
// Each module can be tested separately
const uspsValidator = new USPSValidator(pool);
const result = await uspsValidator.validate(parsedAddress);
```

### 2. **Fault Isolation**
If one API fails, others continue working:
```javascript
// Request specific validators
const results = await orchestrator.validateWithMethods(address, ['census', 'usps']);
// If USPS fails, Census results are still returned
```

### 3. **Easy Maintenance**
Changes to one module don't affect others:
- Update USPS API version? Only modify USPSValidator.js
- Add new Google feature? Only touch GoogleValidator.js
- Fix Census bug? Isolated to CensusValidator.js

### 4. **Configuration Preservation**
USPS configuration is maintained separately:
- OAuth credentials stored in .env
- Configuration UI preserved in modal
- Test endpoints remain functional

## API Endpoints

### Status Check
```
GET /api/validation-status
```
Returns configuration status for all validators

### Address Validation
```
POST /api/validate-address
{
  "address": "123 Main St, City, State",
  "methods": ["usps", "census", "google"]  // Optional
}
```

### Test Specific Validator
```
GET /api/test-usps
GET /api/test-census  // Could be added
GET /api/test-google  // Could be added
```

## Usage Examples

### Validate with Specific APIs
```javascript
// Frontend
const response = await fetch('/api/validate-address', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '2131 N Pima Drive, Lake Havasu City, AZ',
    methods: ['usps']  // Only use USPS
  })
});
```

### Check API Status
```javascript
// Frontend
const status = await fetch('/api/validation-status').then(r => r.json());
console.log(status.usps.configured);   // true/false
console.log(status.census.configured); // always true
console.log(status.google.configured); // true/false
```

## Adding New Validators

To add a new validation service:

1. Create new validator in `/services/validators/`:
```javascript
class NewValidator {
  constructor(pool) { }
  isConfigured() { }
  getStatus() { }
  async validate(parsedAddress) { }
  async test() { }
}
```

2. Add to ValidationOrchestrator:
```javascript
this.validators = {
  usps: new USPSValidator(pool),
  census: new CensusValidator(pool),
  google: new GoogleValidator(pool),
  new: new NewValidator(pool)  // Add here
};
```

3. Update frontend to show new option

## Testing

Each module can be tested independently:
```bash
# Test USPS module
curl -X POST https://kevinalthaus.com/ssddmap/api/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Main St, Anytown, USA", "methods":["usps"]}'

# Test Census module  
curl -X POST https://kevinalthaus.com/ssddmap/api/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Main St, Anytown, USA", "methods":["census"]}'
```

## Error Handling

Each module handles its own errors gracefully:
- Configuration errors return clear messages
- API failures don't crash the system
- Timeouts are handled per module
- Results show which APIs succeeded/failed

## Future Enhancements

1. **Caching Layer**: Add result caching per validator
2. **Rate Limiting**: Implement per-API rate limits
3. **Retry Logic**: Add configurable retry strategies
4. **Webhook Support**: Notify on validation completion
5. **Batch Processing**: Process multiple addresses efficiently

The modular architecture ensures the validation system remains robust, maintainable, and extensible.