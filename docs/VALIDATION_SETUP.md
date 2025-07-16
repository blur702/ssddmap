# Address Validation Setup Guide

## Overview

The SSDD Map application supports three different address validation methods:
1. **Census Geocoding** (Free, no configuration required)
2. **USPS Address Standardization** (Requires USPS Web Tools API credentials)
3. **Google Maps Geocoding** (Requires Google Maps API key)

## Current Status

✅ **Census Geocoding**: Working correctly
❌ **USPS OAuth**: Not configured
❌ **Google Maps**: Not configured

## Setting Up USPS Address Validation

### 1. Register for USPS Web Tools API

1. Go to https://developers.usps.com/
2. Click "Sign Up" and create an account
3. Once registered, navigate to your dashboard
4. Create a new application to get your credentials

### 2. Configure USPS OAuth Credentials

Add your USPS credentials to the `.env` file:

```bash
USPS_CLIENT_ID=your_client_id_here
USPS_CLIENT_SECRET=your_client_secret_here
```

### 3. USPS OAuth Flow

The USPS API uses OAuth 2.0 with client credentials flow. The application will:
1. Use your client ID and secret to request an access token
2. Use the access token to make API calls
3. Automatically refresh the token when it expires

**Note**: USPS does NOT use Google OAuth. It has its own OAuth system.

## Setting Up Google Maps Geocoding

### 1. Get a Google Maps API Key

1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the "Geocoding API"
4. Go to "Credentials" and create an API key
5. (Optional) Restrict the API key to specific IPs or referrers

### 2. Configure Google Maps API Key

Add your API key to the `.env` file:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Testing the Configuration

### 1. Restart the Application

After updating the `.env` file, restart the application:

```bash
pm2 restart ssddmap
```

### 2. Test via UI

1. Navigate to https://kevinalthaus.com/ssddmap
2. Enable "Validation Mode" toggle
3. Enter the test address: `2139 north pima drive, lake havasu city, arizona, 86403`
4. Click "Validate"

### 3. Test via API

Run the test script:

```bash
node test-validation-api.js
```

Expected results:
- Address should be in Arizona District 9
- Census method should show success
- USPS method should show success (if configured)
- Google method should show success (if configured)

## Validation Methods Comparison

| Method | Pros | Cons | Cost |
|--------|------|------|------|
| Census | Free, No API key required | Basic standardization | Free |
| USPS | Official postal data, ZIP+4 lookup | Requires registration | Free (with limits) |
| Google | High accuracy, Global coverage | Requires API key | Pay per use |

## Using the Configuration UI

1. Click the settings icon (⚙️) in the application
2. Select your preferred lookup method:
   - **Census Geocoder**: Free option, no configuration needed
   - **ZIP+4 (USPS)**: Requires USPS credentials
   - **Compare Both**: Runs both methods and compares results
3. Enter your API credentials if using USPS
4. Click "Test Connection" to verify
5. Save your configuration

## Troubleshooting

### USPS Authentication Issues

If you see "USPS OAuth failed":
1. Verify your client ID and secret are correct
2. Check if your USPS account is active
3. Ensure the API endpoint is correct (https://apis.usps.com)

### Google Maps API Issues

If you see "REQUEST_DENIED":
1. Verify your API key is correct
2. Check if the Geocoding API is enabled in Google Cloud Console
3. Verify billing is set up (Google requires a billing account)

### Address Parsing Issues

The validation expects addresses in this format:
```
street, city, state ZIP
```

Examples:
- `123 Main St, Phoenix, AZ 85001`
- `1600 Pennsylvania Ave, Washington, DC 20500`
- `2139 north pima drive, lake havasu city, arizona, 86403`

## Next Steps

1. Configure at least one additional validation method (USPS or Google)
2. Test the validation with various addresses
3. Use "Compare Both" mode to verify accuracy between methods
4. Monitor the validation results for consistency