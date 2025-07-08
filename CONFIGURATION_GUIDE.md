# ZIP+4 Integration Configuration Guide

## Required Configuration

### 1. USPS Web Tools API (Free)
**Purpose**: Address standardization and ZIP+4 lookup

**How to obtain**:
1. Visit https://www.usps.com/business/web-tools-apis/
2. Click "Register" for Web Tools API
3. Fill out the registration form
4. You'll receive a USPS User ID via email
5. No API key/token needed - just the User ID

**Configuration**:
```bash
export USPS_USER_ID="your_usps_user_id"
```

**Limitations**:
- Free tier: 5 requests per second
- Must be used for shipping/mailing purposes
- Test server available for development

### 2. Smarty (formerly SmartyStreets) API (Commercial)
**Purpose**: ZIP+4 to congressional district mapping

**How to obtain**:
1. Visit https://www.smarty.com/
2. Sign up for account (free trial available)
3. Get Auth ID and Auth Token from dashboard
4. Choose plan based on lookup volume

**Configuration**:
```bash
export SMARTY_AUTH_ID="your_smarty_auth_id"
export SMARTY_AUTH_TOKEN="your_smarty_auth_token"
```

**Pricing** (as of 2024):
- Free: 250 lookups/month
- Starter: $50/month for 5,000 lookups
- Basic: $100/month for 15,000 lookups
- Business: Custom pricing

### 3. ZIP+4 Database Population
**Purpose**: Local database for offline lookups

**Options**:

#### Option A: USPS CASS Certified Database (Commercial)
- Purchase from certified vendors
- Quarterly updates available
- Includes all ZIP+4 ranges
- Cost: $1,000-5,000/year

#### Option B: Build from Public Sources
```javascript
// Example data structure needed:
{
    zip5: "20500",           // 5-digit ZIP
    plus4_low: "0001",       // ZIP+4 range start
    plus4_high: "0004",      // ZIP+4 range end
    state_code: "DC",        // State abbreviation
    district_number: "00",   // Congressional district (00 for at-large)
    county_fips: "11001"     // County FIPS code
}
```

#### Option C: Use Smarty API to Build Cache
- Query addresses systematically
- Store results in local database
- Build over time as addresses are looked up

### 4. Alternative Free Options

#### A. Google Civic Information API (Free tier)
```bash
export GOOGLE_API_KEY="your_google_api_key"
```
- Get from: https://console.cloud.google.com/
- Enable "Google Civic Information API"
- 25,000 requests/day free
- Includes congressional district info

#### B. Geocod.io (Freemium)
```bash
export GEOCODIO_API_KEY="your_geocodio_key"
```
- Get from: https://www.geocod.io/
- 2,500 lookups/day free
- Includes congressional districts
- $0.50 per 1,000 after free tier

## Quick Start Configuration

### Minimal Setup (Census-only mode):
```bash
# No additional configuration needed
# Uses existing OpenStreetMap geocoding + Census boundaries
npm start
```

### Basic ZIP+4 Setup:
```bash
# 1. Get USPS account (free)
export USPS_USER_ID="your_usps_id"

# 2. Get Smarty trial (250 free lookups/month)
export SMARTY_AUTH_ID="your_auth_id"
export SMARTY_AUTH_TOKEN="your_auth_token"

# 3. Start server
npm start
```

### Production Setup:
```bash
# Create .env file
cat > .env << EOF
# USPS Configuration
USPS_USER_ID=your_usps_id

# Smarty Configuration (or alternative)
SMARTY_AUTH_ID=your_auth_id
SMARTY_AUTH_TOKEN=your_auth_token

# Optional: Google Civic API
GOOGLE_API_KEY=your_google_key

# Optional: Geocod.io
GEOCODIO_API_KEY=your_geocodio_key

# Default lookup method
LOOKUP_METHOD=both
EOF

# Install dotenv
npm install dotenv

# Update server.js to load .env
# Add at top: require('dotenv').config();
```

## Testing Your Configuration

1. **Test USPS API**:
```bash
curl "http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=<AddressValidateRequest USERID='YOUR_ID'><Address><Address1></Address1><Address2>1600 Pennsylvania Ave NW</Address2><City>Washington</City><State>DC</State><Zip5>20500</Zip5><Zip4></Zip4></Address></AddressValidateRequest>"
```

2. **Test Smarty API**:
```bash
curl "https://us-street.api.smartystreets.com/street-address?auth-id=YOUR_ID&auth-token=YOUR_TOKEN&street=1600+Pennsylvania+Ave+NW&city=Washington&state=DC"
```

## Data Sources for ZIP+4 Mappings

### Official Sources:
1. **USPS AMS API** (requires special approval)
2. **L2 Political Data** (commercial)
3. **Melissa Data** (commercial)
4. **CD2 ZIP4 File** from Census (discontinued)

### Build Your Own:
1. Use Smarty/Geocod.io API to lookup addresses
2. Store results in local database
3. Build comprehensive coverage over time

## Configuration Priority

For House of Representatives use:
1. **Required**: Either Smarty or alternative API for ZIP+4 lookups
2. **Recommended**: Local database for performance
3. **Optional**: USPS for address standardization
4. **Nice to have**: Comparison capability with Census method

## Security Notes

- Never commit API keys to git
- Use environment variables or .env files
- Add .env to .gitignore
- Consider using a secrets management service
- Rotate keys regularly
- Monitor usage to avoid overages