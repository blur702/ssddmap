# SSDD Map API Reference

Complete API documentation for the US Congressional Districts Map application.

## 🌐 Base URL

```
Production: https://kevinalthaus.com/apps/ssddmap/api
Development: http://localhost:3001/ssddmap/api
```

## 📋 Authentication

Most endpoints are public and don't require authentication. USPS OAuth integration handles authentication automatically for address validation features.

## 🏛️ Congressional Districts API

### Get All States

```http
GET /api/states
```

Returns list of all states with their district counts.

**Response:**
```json
[
  {
    "state_code": "AL",
    "district_count": 7
  },
  {
    "state_code": "AK", 
    "district_count": 1,
    "is_at_large": true
  }
]
```

### Get State Districts

```http
GET /api/state/{stateCode}
```

Returns all districts for a specific state.

**Parameters:**
- `stateCode` (string): Two-letter state code (e.g., "CA", "TX")

**Response:**
```json
{
  "state": "CA",
  "districts": [
    {
      "district_number": 1,
      "is_at_large": false,
      "representative": {
        "name": "Doug LaMalfa",
        "party": "Republican",
        "office": "322 Cannon House Office Building"
      }
    }
  ]
}
```

### Get District Details

```http
GET /api/district/{state}/{district}
```

Returns detailed information and geometry for a specific district.

**Parameters:**
- `state` (string): Two-letter state code
- `district` (string): District number or "0" for at-large

**Response:**
```json
{
  "district": {
    "state": "CA",
    "district_number": 1,
    "is_at_large": false,
    "geometry": {
      "type": "Feature",
      "geometry": { ... },
      "properties": { ... }
    }
  },
  "representative": {
    "name": "Doug LaMalfa",
    "party": "Republican",
    "office": "322 Cannon House Office Building",
    "phone": "(202) 225-3076",
    "website": "https://lamalfa.house.gov"
  }
}
```

### Get All Districts

```http
GET /api/all-districts
```

Returns GeoJSON FeatureCollection of all congressional districts.

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { ... },
      "properties": {
        "state": "AL",
        "district": "1",
        "representative": "Jerry Carl",
        "party": "Republican"
      }
    }
  ]
}
```

## 👥 Representatives API

### Get All Representatives

```http
GET /api/members
```

Returns information for all House members with 24-hour caching.

**Response:**
```json
[
  {
    "name": "Doug LaMalfa",
    "state": "CA",
    "district": "1",
    "party": "Republican",
    "office": "322 Cannon House Office Building",
    "phone": "(202) 225-3076",
    "website": "https://lamalfa.house.gov",
    "photo_url": "https://...",
    "social_media": {
      "twitter": "@RepLaMalfa",
      "facebook": "..."
    }
  }
]
```

### Refresh Member Cache

```http
POST /api/refresh-cache
```

Forces refresh of House member data from official XML feed.

**Response:**
```json
{
  "success": true,
  "message": "Member data refreshed successfully",
  "count": 435,
  "updated_at": "2025-01-15T10:30:00Z"
}
```

## 📍 Address Validation API

### Validate Address

```http
POST /api/validate-address
Content-Type: application/json

{
  "address": "2330 McCulloch Blvd, Lake Havasu City, AZ"
}
```

Validates address using multiple methods and returns district information.

**Request Body:**
```json
{
  "address": "string (required)",
  "method": "usps|census|google|both (optional, default: both)"
}
```

**Response:**
```json
{
  "originalInput": "2330 McCulloch Blvd, Lake Havasu City, AZ",
  "parsedAddress": {
    "street": "2330 McCulloch Blvd",
    "city": "Lake Havasu City",
    "state": "AZ",
    "zip": ""
  },
  "methods": {
    "usps": {
      "success": true,
      "standardized": {
        "street": "2330 MCCULLOCH BLVD N",
        "city": "LK HAVASU CTY",
        "state": "AZ",
        "zipCode": "86403",
        "zipPlus4": "5950"
      },
      "district": {
        "state": "AZ",
        "district": "2"
      },
      "additionalInfo": {
        "DPVConfirmation": "Y",
        "business": "Y"
      }
    },
    "census": {
      "success": true,
      "coordinates": {
        "lat": 34.4835,
        "lon": -114.3226
      },
      "district": {
        "state": "AZ",
        "district": "2"
      }
    }
  },
  "analysis": {
    "consistency": "consistent",
    "issues": [],
    "recommendations": ["All methods agree on district assignment"]
  }
}
```

### Batch Address Validation

```http
POST /api/batch-validate
Content-Type: application/json

{
  "addresses": [
    "123 Main St, City, State",
    "456 Oak Ave, City, State"
  ],
  "method": "both"
}
```

Processes multiple addresses with progress tracking.

**Response:**
```json
{
  "batch_id": "batch_12345",
  "total_addresses": 2,
  "status": "processing",
  "progress": {
    "completed": 0,
    "total": 2,
    "errors": 0
  },
  "results_url": "/api/batch-results/batch_12345"
}
```

### Get Batch Results

```http
GET /api/batch-results/{batchId}
```

Returns results for a batch validation request.

**Response:**
```json
{
  "batch_id": "batch_12345",
  "status": "completed",
  "results": [
    {
      "address": "123 Main St, City, State",
      "validation": { ... },
      "district": "TX-10",
      "success": true
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "consistent": 2,
    "inconsistent": 0
  }
}
```

### Test USPS Connection

```http
GET /api/test-usps
```

Tests USPS OAuth API connectivity and configuration.

**Response:**
```json
{
  "configured": true,
  "connected": true,
  "token_valid": true,
  "message": "USPS API connection successful",
  "api_version": "v3",
  "available_scopes": ["addresses", "domestic-prices"]
}
```

## 🗺️ Geographic API

### Find Location

```http
GET /api/find-location?lat={latitude}&lon={longitude}
```

Finds congressional district and county for given coordinates.

**Parameters:**
- `lat` (number): Latitude coordinate
- `lon` (number): Longitude coordinate

**Response:**
```json
{
  "district": {
    "state": "CA",
    "district": "1",
    "is_at_large": false,
    "representative": "Doug LaMalfa",
    "party": "Republican"
  },
  "county": {
    "name": "Butte County",
    "state": "CA",
    "fips": "06007"
  },
  "coordinates": {
    "lat": 39.7391,
    "lon": -121.8375
  }
}
```

### Get County Boundaries

```http
GET /api/county-boundaries
```

Returns GeoJSON of all US county boundaries with political control data.

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { ... },
      "properties": {
        "name": "Butte County",
        "state": "CA",
        "fips": "06007",
        "political_control": "republican",
        "district_breakdown": {
          "republican": 1,
          "democrat": 0,
          "split": false
        }
      }
    }
  ]
}
```

### Get County Politics

```http
GET /api/county-politics
```

Returns county political control analysis.

**Response:**
```json
{
  "summary": {
    "total_counties": 3234,
    "republican_controlled": 2107,
    "democrat_controlled": 701,
    "split_control": 426
  },
  "counties": [
    {
      "name": "Butte County",
      "state": "CA",
      "fips": "06007",
      "control": "republican",
      "districts": ["CA-1"]
    }
  ]
}
```

## 📊 Legislative Data API

### Get State Representative Counts

```http
GET /api/state-rep-counts
```

Returns representative counts by state for visualization.

**Response:**
```json
{
  "CA": 52,
  "TX": 38,
  "FL": 28,
  "NY": 26,
  "PA": 17,
  "IL": 17,
  "OH": 15
}
```

### Get Bill Votes

```http
GET /api/bill-votes/{billId}
```

Returns voting patterns for specific legislation.

**Parameters:**
- `billId` (string): Bill identifier (e.g., "hr1")

**Response:**
```json
{
  "bill": {
    "id": "hr1",
    "title": "One Big Beautiful Bill Act",
    "congress": 119,
    "vote_date": "2025-07-03",
    "result": "Passed"
  },
  "votes": {
    "yes": 218,
    "no": 214,
    "not_voting": 3
  },
  "district_votes": {
    "AL-1": "yes",
    "AL-2": "no",
    "AK-0": "yes"
  }
}
```

## 🔧 Configuration API

### Get API Configuration

```http
GET /api/config
```

Returns current API configuration and available services.

**Response:**
```json
{
  "services": {
    "usps": {
      "enabled": true,
      "configured": true,
      "status": "active"
    },
    "google": {
      "enabled": false,
      "configured": false,
      "status": "disabled"
    },
    "smarty": {
      "enabled": false,
      "configured": false,
      "status": "disabled"
    }
  },
  "default_method": "both",
  "features": {
    "address_validation": true,
    "batch_processing": true,
    "comparison_mode": true
  }
}
```

### Update Configuration

```http
POST /api/config
Content-Type: application/json

{
  "default_method": "usps",
  "usps_client_id": "new_client_id",
  "usps_client_secret": "new_client_secret"
}
```

Updates API configuration (requires admin access).

## 📈 Analytics API

### Get Usage Statistics

```http
GET /api/stats
```

Returns API usage statistics and performance metrics.

**Response:**
```json
{
  "requests": {
    "total": 15432,
    "today": 234,
    "success_rate": 0.987
  },
  "endpoints": {
    "/api/validate-address": 8234,
    "/api/district/": 4123,
    "/api/find-location": 2341
  },
  "validation_methods": {
    "usps": 0.623,
    "census": 0.234,
    "both": 0.143
  },
  "performance": {
    "avg_response_time": 245,
    "cache_hit_rate": 0.834
  }
}
```

## 🚨 Error Handling

### Standard Error Response

```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation details"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (API key issues)
- `404` - Not Found (district/address not found)
- `429` - Rate Limited
- `500` - Internal Server Error

### Common Error Codes

- `INVALID_ADDRESS` - Address format is invalid
- `DISTRICT_NOT_FOUND` - No district found for coordinates
- `USPS_API_ERROR` - USPS service unavailable
- `RATE_LIMITED` - Too many requests
- `VALIDATION_FAILED` - Address validation failed

## 🔄 Rate Limiting

### Limits
- **Address Validation**: 100 requests per minute
- **Batch Processing**: 10 batches per hour
- **Geographic Lookups**: 200 requests per minute
- **General API**: 1000 requests per hour

### Headers
Rate limit information is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642234567
```

## 📝 Request/Response Examples

### cURL Examples

```bash
# Validate an address
curl -X POST "https://kevinalthaus.com/apps/ssddmap/api/validate-address" \
  -H "Content-Type: application/json" \
  -d '{"address": "1600 Pennsylvania Ave, Washington, DC"}'

# Get district information
curl "https://kevinalthaus.com/apps/ssddmap/api/district/DC/0"

# Find location by coordinates
curl "https://kevinalthaus.com/apps/ssddmap/api/find-location?lat=38.8977&lon=-77.0365"
```

### JavaScript Examples

```javascript
// Validate address
const response = await fetch('/api/validate-address', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: '1600 Pennsylvania Ave, Washington, DC' })
});
const result = await response.json();

// Get all districts
const districts = await fetch('/api/all-districts').then(r => r.json());

// Find district by coordinates
const location = await fetch('/api/find-location?lat=38.8977&lon=-77.0365')
  .then(r => r.json());
```

## 📚 Additional Resources

- [USPS OAuth Setup Guide](./USPS_OAUTH_SETUP.md)
- [Address Validation Guide](./ADDRESS_VALIDATION_GUIDE.md)
- [Main Documentation](./README.md)

---

**API Version**: 2.0.0  
**Last Updated**: January 2025  
**Documentation**: https://kevinalthaus.com/apps/ssddmap/docs