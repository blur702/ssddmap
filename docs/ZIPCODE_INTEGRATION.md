# ZIP+4 to Congressional District Integration Plan

## Overview
Add USPS ZIP+4 lookup as an alternative/complementary method to the current point-in-polygon Census approach.

## Architecture

### 1. USPS Address Standardization
First, standardize the address and get ZIP+4:
```javascript
// Endpoint: /api/usps-standardize
async function standardizeAddress(address) {
    const uspsUrl = `http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=...`;
    // Returns standardized address with ZIP+4
}
```

### 2. ZIP+4 to District Mapping Options

#### Option A: Smarty API (Recommended)
```javascript
// Endpoint: /api/smarty-lookup
async function smartyLookup(address) {
    const response = await fetch('https://us-street.api.smartystreets.com/street-address', {
        headers: {
            'Auth-ID': process.env.SMARTY_AUTH_ID,
            'Auth-Token': process.env.SMARTY_AUTH_TOKEN
        },
        // Returns ZIP+4 AND congressional district
    });
}
```

#### Option B: Local ZIP+4 Database
- Download USPS ZIP+4 to District file (updated quarterly)
- Store in PostgreSQL/SQLite
- Query locally for fast lookups

#### Option C: House.gov Internal API
If you have access to the House's internal systems, they might have an API endpoint.

## Implementation Steps

### 1. Add Configuration
```javascript
// config.js
module.exports = {
    lookupMethod: process.env.LOOKUP_METHOD || 'census', // 'census', 'zip4', 'both'
    usps: {
        userId: process.env.USPS_USER_ID,
        apiUrl: 'http://production.shippingapis.com/ShippingAPI.dll'
    },
    smarty: {
        authId: process.env.SMARTY_AUTH_ID,
        authToken: process.env.SMARTY_AUTH_TOKEN
    }
};
```

### 2. Add New Endpoints
```javascript
// server.js
app.get('/api/address-lookup', async (req, res) => {
    const { address, method } = req.query;
    
    if (method === 'zip4' || method === 'both') {
        // 1. Standardize via USPS
        const standardized = await standardizeAddress(address);
        
        // 2. Get district from ZIP+4
        const districtInfo = await getDistrictFromZip4(standardized.zip4);
        
        // 3. If method === 'both', also do Census lookup
        if (method === 'both') {
            const censusResult = await getCensusDistrict(standardized.lat, standardized.lon);
            return res.json({
                address: standardized,
                zip4District: districtInfo,
                censusDistrict: censusResult,
                match: districtInfo.district === censusResult.district
            });
        }
        
        return res.json(districtInfo);
    }
    
    // Default to Census method
    // ... existing geocoding logic
});
```

### 3. Add Comparison View
```javascript
// public/app.js
function compareMethodsForAddress(address) {
    const results = await Promise.all([
        fetch(`/api/address-lookup?address=${address}&method=zip4`),
        fetch(`/api/address-lookup?address=${address}&method=census`)
    ]);
    
    // Display both results side-by-side
    showComparisonResults(results);
}
```

## Database Schema for Local ZIP+4

If storing ZIP+4 data locally:

```sql
CREATE TABLE zip4_districts (
    zip5 CHAR(5) NOT NULL,
    plus4_low CHAR(4) NOT NULL,
    plus4_high CHAR(4) NOT NULL,
    state_code CHAR(2) NOT NULL,
    district_number CHAR(2) NOT NULL,
    updated_date DATE,
    PRIMARY KEY (zip5, plus4_low, plus4_high)
);

CREATE INDEX idx_zip4_lookup ON zip4_districts(zip5, plus4_low, plus4_high);
```

## Accuracy Considerations

### Census Point-in-Polygon
- ✅ Most accurate for exact coordinates
- ✅ Works for any location (parks, landmarks, etc.)
- ❌ Requires geocoding (can be inaccurate)
- ❌ Doesn't handle P.O. Boxes

### ZIP+4 Method
- ✅ Very accurate for mailing addresses
- ✅ Handles P.O. Boxes
- ✅ Faster (no geocoding needed)
- ❌ Only works for valid USPS addresses
- ❌ Requires regular database updates

## Recommended Approach

1. **Primary**: Use ZIP+4 method for standard addresses
2. **Fallback**: Use Census method if ZIP+4 fails
3. **Validation**: Compare both methods for quality control
4. **Special Cases**: 
   - P.O. Boxes → ZIP+4 only
   - Landmarks/Parks → Census only
   - New developments → May need manual override

## Cost Analysis

- **USPS API**: Free (requires registration)
- **Smarty**: ~$79/month for 5,000 lookups
- **Local Database**: One-time setup + quarterly updates
- **Census Method**: Free (current implementation)

## UI Enhancement

Add a toggle for lookup method:
```html
<div class="lookup-method">
    <label>
        <input type="radio" name="method" value="census" checked> 
        Geographic (Census)
    </label>
    <label>
        <input type="radio" name="method" value="zip4"> 
        Postal (ZIP+4)
    </label>
    <label>
        <input type="radio" name="method" value="both"> 
        Compare Both
    </label>
</div>
```