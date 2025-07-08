# USPS OAuth Setup for ZIP+4 Address Verification

This guide explains how to set up USPS OAuth for official House of Representatives constituent address verification with ZIP+4 data.

## Why ZIP+4 is Required

The House of Representatives uses ZIP+4 codes to match addresses to State Senate District Divisions (SSDDs) for constituent verification. This ensures that only verified constituents can contact their representatives.

## Setup Instructions

### 1. Register with USPS Developer Portal

1. Go to https://developers.usps.com/
2. Click "Sign Up" to create an account
3. After verification, log in to the developer portal

### 2. Create an Application

1. In the developer portal, go to "My Apps"
2. Click "Create New App"
3. Fill in the application details:
   - **App Name**: Congressional District Mapper (or your choice)
   - **Description**: Address verification for constituent services
   - **Callback URL**: 
     - Development: `http://localhost:3000/callback`
     - Production: `https://yourdomain.com/callback`

### 3. Get Your Credentials

After creating the app, you'll receive:
- **Client ID**: Your application's public identifier
- **Client Secret**: Your application's private key (keep secure!)

### 4. Update Your .env File

```bash
# USPS OAuth Credentials
USPS_CLIENT_ID=your_actual_client_id_here
USPS_CLIENT_SECRET=your_actual_client_secret_here

# Set lookup method to use ZIP+4
LOOKUP_METHOD=zip4
```

### 5. OAuth Flow in the Application

The application now includes:

1. **OAuth Initiation**: Visit `/api/usps-auth` to get the authorization URL
2. **Callback Handler**: `/callback` exchanges the authorization code for access tokens
3. **Token Storage**: Tokens are stored in memory (use Redis/database in production)

### 6. First-Time Authorization

```javascript
// In your browser console or as a test:
fetch('/api/usps-auth')
  .then(res => res.json())
  .then(data => window.open(data.authUrl));
```

This will:
1. Open USPS login page
2. After login, redirect to your callback URL
3. Store the access token for API calls

## Production Considerations

### 1. Callback URL
- In production, update the callback URL in both:
  - USPS Developer Portal app settings
  - Your server.js OAuth configuration

### 2. Token Storage
- Replace in-memory storage with:
  - Redis for distributed systems
  - Database for persistence
  - Encrypted session storage

### 3. Security
- Use HTTPS in production
- Store client secret in secure vault
- Implement token refresh logic

### 4. Environment Variables
```bash
# Production example
USPS_CLIENT_ID=prod_client_id
USPS_CLIENT_SECRET=prod_client_secret
USPS_CALLBACK_URL=https://yourdomain.gov/callback
```

## Testing the Integration

1. Start your server: `npm start`
2. Navigate to `http://localhost:3000`
3. Use the address search with a real US address
4. Select "ZIP+4 (USPS)" as the lookup method
5. The system will:
   - Standardize the address via USPS
   - Extract ZIP+4
   - Match to congressional district
   - Return SSDD information

## Troubleshooting

### "Authorization Required"
- Run the OAuth flow via `/api/usps-auth`
- Check tokens haven't expired

### "Invalid Callback URL"
- Ensure callback URL in app matches server configuration
- Use exact URL including protocol and port

### "Access Denied"
- Verify client credentials are correct
- Check API scopes include "addresses"

## Alternative: Smarty API

If USPS OAuth is too complex for development, consider Smarty:
1. Sign up at https://www.smarty.com/
2. Get instant API credentials (no OAuth)
3. 250 free lookups/month
4. Returns ZIP+4 and congressional district

Update .env:
```bash
SMARTY_AUTH_ID=your_smarty_id
SMARTY_AUTH_TOKEN=your_smarty_token
LOOKUP_METHOD=smarty
```

## Support

For House IT support with USPS integration:
- Contact your House IT administrator
- Reference: Address Verification for Constituent Services
- Mention: ZIP+4 to SSDD matching requirement