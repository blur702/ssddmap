# Free ZIP+4 to Congressional District Setup

## Overview
This setup uses 100% free government data sources with no API keys required.

## Components

### 1. Census Geocoder API (FREE)
- No API key needed
- No rate limits published (be respectful)
- Returns coordinates + census geography
- Sometimes includes ZIP+4

### 2. TIGER/Line Shapefiles (FREE)
- Congressional districts
- ZIP Code Tabulation Areas (ZCTA)
- County boundaries
- Already in your PostGIS database

### 3. Optional Enhancement: USPS Web Tools (FREE with registration)
- Requires free USPS Web Tools account
- Address standardization
- ZIP+4 lookup
- Rate limited but generous for most uses

## Implementation Steps

### Step 1: Add Census Geocoding Endpoint
```javascript
// server.js
app.get('/api/address-lookup-free', async (req, res) => {
    const { street, city, state, zip } = req.query;
    
    // 1. Call Census Geocoder
    const census = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/address?street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${state}&zip=${zip}&benchmark=Public_AR_Current&format=json`);
    
    const result = await census.json();
    
    if (result.result.addressMatches.length > 0) {
        const match = result.result.addressMatches[0];
        const coords = match.coordinates;
        
        // 2. Query your PostGIS for district
        const district = await pool.query(`
            SELECT state_code, district_number 
            FROM districts 
            WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        `, [coords.x, coords.y]);
        
        return res.json({
            success: true,
            address: match.matchedAddress,
            coordinates: { lat: coords.y, lon: coords.x },
            district: district.rows[0]
        });
    }
});
```

### Step 2: Add USPS Address Standardization (Optional)
```javascript
// Get free USPS Web Tools account at:
// https://www.usps.com/business/web-tools-apis/

const uspsUserId = process.env.USPS_USER_ID; // Free after registration

async function standardizeAddress(address) {
    const xml = `
        <AddressValidateRequest USERID="${uspsUserId}">
            <Revision>1</Revision>
            <Address ID="0">
                <Address1>${address.street}</Address1>
                <City>${address.city}</City>
                <State>${address.state}</State>
                <Zip5>${address.zip5}</Zip5>
                <Zip4></Zip4>
            </Address>
        </AddressValidateRequest>
    `;
    
    const response = await fetch(`http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=${encodeURIComponent(xml)}`);
    // Parse XML response for ZIP+4
}
```

### Step 3: Cache Results Locally
```sql
-- Cache geocoding results to minimize API calls
CREATE TABLE geocode_cache (
    address_hash VARCHAR(64) PRIMARY KEY,
    street VARCHAR(255),
    city VARCHAR(100),
    state CHAR(2),
    zip5 CHAR(5),
    zip4 CHAR(4),
    lat DECIMAL(10, 8),
    lon DECIMAL(11, 8),
    district_state CHAR(2),
    district_number VARCHAR(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geocode_zip ON geocode_cache(zip5, zip4);
```

## Cost Comparison

| Service | Cost | ZIP+4? | Limits |
|---------|------|--------|---------|
| Census Geocoder | FREE | Sometimes | None published |
| USPS Web Tools | FREE | Yes | ~5-10k/day |
| Smarty | $79/mo | Yes | 250/mo free |
| Google Maps | $200 credit | No | $5/1000 |
| HERE | $0-250 | No | 250/day free |

## Building Your Own ZIP+4 Database

Over time, you can build your own ZIP+4 mapping:

1. **Collect from users**: When users search addresses, cache the results
2. **FEC data mining**: Download contribution data with ZIP+4
3. **Voter files**: Some states provide voter addresses with ZIP+4
4. **OpenAddresses**: Contribute back to the community

## Performance Tips

1. **Cache everything**: Store all lookups in your database
2. **Batch at night**: Process bulk lookups during off-hours
3. **Use multiple sources**: Fall back between services
4. **Progressive enhancement**: Start with ZIP5, add ZIP+4 when available

## Legal Note

All these data sources are public domain or freely licensed for any use.