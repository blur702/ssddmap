# USPS OAuth API v3 Setup Guide

This guide walks you through setting up the USPS OAuth API v3 integration for address validation and ZIP+4 lookup functionality.

## 🎯 Overview

The USPS OAuth API v3 provides:
- **Address standardization** and correction
- **ZIP+4 code lookup** for precise district mapping
- **Address validation** with delivery point confirmation
- **City/state lookup** by ZIP code

## 📋 Prerequisites

### Business Requirements
- **Valid business need** for address validation
- **Customer Registration ID (CRID)** from USPS Business Customer Gateway
- **Mailer ID (MID)** associated with your CRID
- **Business System Administrator (BSA)** access for authorization

### Technical Requirements
- **HTTPS domain** for production use
- **OAuth 2.0 client credentials** flow implementation
- **Token refresh** mechanism for expired tokens

## 🚀 Step-by-Step Setup

### Step 1: Register for USPS Developer Account

1. **Visit USPS Developer Portal**: https://developer.usps.com/
2. **Create Account** or sign in with existing credentials
3. **Verify Email** and complete account setup
4. **Note**: As of January 2025, the registration process moved to the Cloud USPS Developer Portal

### Step 2: Create Application

1. **Navigate to Applications** in the developer portal
2. **Click "Add App"** to create a new application
3. **Configure Application**:
   ```
   App Name: SSDD Congressional District Mapper
   Description: Congressional district mapping application that performs 
                address validation and ZIP+4 lookups to determine district 
                boundaries for US addresses. Used for political research 
                and civic engagement tools.
   Callback URL: https://kevinalthaus.com/apps/ssddmap/callback
   Public Access: No - Private/Internal Use
   ```
4. **Select APIs**: Choose "Addresses" API
5. **Environment**: Production (not Sandbox)
6. **Submit Application** for review

### Step 3: Obtain OAuth Credentials

After application approval, you'll receive:
- **Consumer Key** (Client ID)
- **Consumer Secret** (Client Secret)

Example credentials (replace with your actual values):
```
Consumer Key: j3Fj88be31qwYHEFZuGtjrFGGtFHn7lBx5kkT2d3qIyBtcSh
Consumer Secret: 8OePNfRIBAuzyJE9rzvfQrNKJvaDoRFMjwJCKXW738Dk9xBO21p9PKCYAnGW13ZO
```

### Step 4: Link Business Account

1. **Contact Your BSA** to obtain:
   - **Customer Registration ID (CRID)**
   - **Outbound Mailer ID (MID)**
   - **Return Mailer ID (MID)**

2. **Example Business Information**:
   ```
   Customer Registration ID (CRID): 53256180
   Outbound Mailer ID (MID): 903937085 (MASTER)
   Additional MIDs: 903937086, 903937087, 903937088
   Return Mailer ID (MID): 903937088
   ```

### Step 5: Authorize Application

1. **Navigate to USPS Customer Onboarding Portal**
2. **Authorize your registered application** to access business resources
3. **Link your application** to your CRID and MIDs
4. **Complete activation process** (this step is crucial for OAuth to work)

## ⚙️ Environment Configuration

### Update .env File

Add the following configuration to your `.env` file:

```bash
# USPS OAuth Configuration
USPS_CLIENT_ID=j3Fj88be31qwYHEFZuGtjrFGGtFHn7lBx5kkT2d3qIyBtcSh
USPS_CLIENT_SECRET=8OePNfRIBAuzyJE9rzvfQrNKJvaDoRFMjwJCKXW738Dk9xBO21p9PKCYAnGW13ZO
USPS_BASE_URL=https://apis.usps.com

# USPS Business Account Information
USPS_CRID=53256180
USPS_OUTBOUND_MID=903937085
USPS_RETURN_MID=903937088
```

### Security Notes
- **Never commit** these credentials to version control
- **Use environment variables** for all sensitive configuration
- **Rotate credentials** if compromised
- **Use HTTPS** for all API communications

## 🔧 Implementation Details

### OAuth 2.0 Flow

The USPS API uses **Client Credentials Grant** flow:

```javascript
// Token Request
POST https://apis.usps.com/oauth2/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=your_client_id&
client_secret=your_client_secret
```

### Token Response
```json
{
  "access_token": "eyJraWQiOiJIdWpzX2F6UnFJUzBpSE5YNEZIRk...",
  "token_type": "Bearer",
  "expires_in": 28799,
  "scope": "addresses domestic-prices international-prices...",
  "status": "approved"
}
```

### API Usage
```javascript
// Address Validation Request
GET https://apis.usps.com/addresses/v3/address?streetAddress=123%20Main%20St&city=Lake%20Havasu%20City&state=AZ
Authorization: Bearer your_access_token
Accept: application/json
```

## 🧪 Testing Your Setup

### Test OAuth Connection

Use the provided test script to verify your configuration:

```bash
# Run the test script
node /tmp/test-usps-oauth.js
```

Expected successful output:
```
✅ OAuth token generated successfully
Token (first 20 chars): eyJraWQiOiJIdWpzX2F6...
✅ API call completed
```

### Test Address Validation

Test with a known address:

```bash
curl -X GET "https://apis.usps.com/addresses/v3/address?streetAddress=2330%20McCulloch%20Blvd&city=Lake%20Havasu%20City&state=AZ" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

Expected response:
```json
{
  "address": {
    "streetAddress": "2330 MCCULLOCH BLVD N",
    "city": "LK HAVASU CTY",
    "state": "AZ",
    "ZIPCode": "86403",
    "ZIPPlus4": "5950"
  },
  "additionalInfo": {
    "DPVConfirmation": "Y",
    "business": "Y"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Invalid Client Error (401)
```json
{
  "error": "invalid_client",
  "error_description": "InvalidApiKey: The client application credentials provided in the request are missing, invalid, inactive or not approved for access."
}
```

**Solutions**:
- Verify OAuth credentials are correct
- Check if application is approved and activated
- Complete the Customer Onboarding Portal authorization
- Ensure business account is properly linked

#### 2. Address Not Found (400)
```json
{
  "error": {
    "code": "400",
    "message": "Address Not Found"
  }
}
```

**Solutions**:
- Verify address format and spelling
- Use real, deliverable addresses for testing
- Check if address exists in USPS database

#### 3. Token Expired (401)
```json
{
  "error": "invalid_token",
  "error_description": "The access token expired"
}
```

**Solutions**:
- Implement automatic token refresh
- Check token expiry before making requests
- Store tokens with expiration timestamps

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   echo $USPS_CLIENT_ID
   echo $USPS_CLIENT_SECRET
   ```

2. **Test Token Generation**:
   ```bash
   curl -X POST "https://apis.usps.com/oauth2/v3/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
   ```

3. **Verify Application Status**:
   - Log into USPS Developer Portal
   - Check application approval status
   - Verify business account linking

## 📊 Rate Limits and Best Practices

### Rate Limits
- **Token requests**: Limited per hour
- **API calls**: Rate limits vary by endpoint
- **Batch processing**: Implement delays between requests

### Best Practices
1. **Cache tokens** until expiration
2. **Implement retry logic** for transient errors
3. **Use exponential backoff** for rate limiting
4. **Monitor API usage** and error rates
5. **Validate input** before making API calls

## 🔄 Token Management

### Automatic Refresh Implementation

```javascript
class USPSOAuthService {
    async getAccessToken() {
        if (this.isTokenValid()) {
            return this.accessToken;
        }
        
        // Refresh token if expired
        const response = await fetch(`${this.baseUrl}/oauth2/v3/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}`
        });
        
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);
        
        return this.accessToken;
    }
}
```

## 📈 Monitoring and Logging

### Application Logs
Monitor these events:
- **Token generation** success/failure
- **API response times**
- **Error rates** by endpoint
- **Rate limit** encounters

### Example Logging
```javascript
console.log('USPS OAuth token generated:', {
    status: 'success',
    expiresIn: data.expires_in,
    scope: data.scope,
    timestamp: new Date().toISOString()
});
```

## 🔐 Security Considerations

### Credential Protection
- **Environment variables** only, never hardcode
- **Secure key storage** in production
- **Regular rotation** of credentials
- **Audit access** to sensitive configuration

### Network Security
- **HTTPS only** for all API communications
- **Firewall rules** to restrict access
- **Input validation** to prevent injection attacks
- **Rate limiting** to prevent abuse

## 📚 Additional Resources

### Official Documentation
- [USPS Developer Portal](https://developer.usps.com/)
- [OAuth 2.0 Specification](https://developer.usps.com/oauth)
- [Addresses API v3](https://developer.usps.com/apis)

### Support Channels
- **USPS Developer Support**: Contact through developer portal
- **Business Customer Gateway**: For CRID and MID issues
- **Technical Documentation**: Available in developer portal

## 🎯 Next Steps

1. **Complete setup** using this guide
2. **Test thoroughly** with various addresses
3. **Implement error handling** for production use
4. **Monitor usage** and performance
5. **Plan for scale** with rate limiting and caching

---

**Last Updated**: January 2025  
**USPS API Version**: v3  
**OAuth Version**: 2.0