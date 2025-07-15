# USPS Addresses API v3 Registration and Setup Guide

## Overview

This guide will walk you through the process of registering for USPS Developer Portal and obtaining OAuth 2.0 credentials for the USPS Addresses API v3, which validates and corrects address information for improved package delivery service.

The USPS Addresses API v3 provides:
- **Address Standardization**: Validates USPS domestic addresses with ZIP+4 delivery point validation
- **City/State Lookup**: Provides valid cities and states for a ZIP Code
- **ZIP Code Lookup**: Finds valid ZIP Codes for a City and State

## Important: 2025 USPS API Changes

As of January 6th, 2025, USPS has migrated to a new Cloud Developer Portal. The registration process has changed significantly.

## Step 1: Create USPS Developer Account

1. **Navigate to Cloud USPS Developer Portal**
   - Go to the new Cloud USPS Developer Portal (linked from https://developer.usps.com/)
   - Look for "Get Started" or "Register" button
   - Note: The old registration system is no longer available

2. **Fill out Registration Form**
   - Enter your email address
   - Create a password (must meet security requirements)
   - Provide your name and company information
   - Accept the Terms of Service
   - Complete any CAPTCHA verification

3. **Verify Your Email**
   - Check your email for a verification message from USPS
   - Click the verification link to activate your account

## Step 2: Log Into Developer Portal

1. **Sign In**
   - Go to https://developer.usps.com/
   - Click "Sign In"
   - Enter your email and password

2. **Complete Your Profile** (if prompted)
   - Add any additional required information
   - Set up two-factor authentication if required

## Step 3: Register Your Application

1. **Navigate to Applications**
   - Once logged in, look for "Add App" in the dashboard
   - This will register your application and generate OAuth credentials

2. **Configure Your Application**
   - **Application Name**: Enter a descriptive name (e.g., "SSDD Map Address Validation")
   - **Description**: Brief description of your application
   - **Default APIs Included**:
     - OAuth API
     - Addresses API v3
     - Domestic Pricing
     - International Pricing
     - Locations
     - Service Standards
     - Shipping Options
   - **Default Quota**: 60 calls per hour for each API

3. **Submit Application**
   - Review your settings
   - Click "Create" or "Submit"

## Step 4: Obtain OAuth 2.0 Credentials

1. **View Application Details**
   - After adding your app, you'll receive your OAuth credentials
   - The credentials will be displayed on screen

2. **Find Your Credentials**
   - **Consumer Key** = Your Client ID
   - **Consumer Secret** = Your Client Secret
   - These are required for generating OAuth tokens

3. **Copy Your Credentials**
   - Click the "Show" or eye icon to reveal the secret
   - Copy both the Consumer Key and Consumer Secret
   - Store them securely - you won't be able to view the secret again

## Step 5: Understanding OAuth 2.0 Flow

The USPS API uses OAuth 2.0 client credentials flow:

1. **Token Request**
   ```bash
   POST https://api.usps.com/oauth2/v3/token
   Authorization: Basic [base64(client_id:client_secret)]
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials&scope=addresses
   ```

2. **Token Response**
   ```json
   {
     "access_token": "your_access_token",
     "token_type": "Bearer",
     "expires_in": 3600
   }
   ```

3. **API Request with Token**
   ```bash
   GET https://api.usps.com/addresses/v3/address?streetAddress=...
   Authorization: Bearer your_access_token
   ```

## Step 7: Configure Your Application

1. **Update the .env File**
   ```bash
   # Edit the .env file
   nano /var/www/kevinalthaus.com/apps/ssddmap/.env
   ```

2. **Add Your Credentials**
   ```
   USPS_CLIENT_ID=your_consumer_key_here
   USPS_CLIENT_SECRET=your_consumer_secret_here
   USPS_BASE_URL=https://api.usps.com
   ```
   Note: The base URL has changed from apis.usps.com to api.usps.com

3. **Save and Exit**
   - Press Ctrl+X, then Y, then Enter to save

## Step 8: Restart the Application

```bash
# Restart the SSDD Map application
pm2 restart ssddmap

# Check the logs to ensure it started correctly
pm2 logs ssddmap
```

## Step 6: Additional Authorization (REQUIRED for v3 APIs)

**IMPORTANT**: This step is required to access all Version 3 APIs including Addresses API v3.

1. **Navigate to USPS Customer Onboarding Portal**
   - This is a separate portal from the Developer Portal
   - You must authorize your client application here

2. **Authorize Your Application**
   - Link your application to your USPS resources:
     - Payment accounts
     - Permits
     - CRIDs (Customer Registration IDs)
     - MIDs (Mailer IDs)
     - Subscriptions

3. **Complete Authorization**
   - Without this step, your API calls will fail even with valid OAuth tokens

## Step 9: Test Your Configuration

1. **Run the API Test**
   ```bash
   cd /var/www/kevinalthaus.com/apps/ssddmap
   node test-validation-api.js
   ```

2. **Test via Web Interface**
   - Go to https://kevinalthaus.com/ssddmap
   - Enable "Validation Mode"
   - Enter test address: `2139 north pima drive, lake havasu city, arizona, 86403`
   - Click "Validate"
   - Check if USPS method returns results

## Common Issues and Solutions

### Issue: "Invalid Client" Error
- **Cause**: Incorrect Client ID or Secret
- **Solution**: Double-check your credentials, ensure no extra spaces

### Issue: "Unauthorized" Error
- **Cause**: Application not approved or API not enabled
- **Solution**: Check your USPS developer dashboard, ensure APIs are enabled

### Issue: "Rate Limit Exceeded"
- **Cause**: Too many requests
- **Solution**: USPS has rate limits; wait and try again

### Issue: No Response from USPS
- **Cause**: Network issues or incorrect base URL
- **Solution**: Verify USPS_BASE_URL is set to https://apis.usps.com

## API Limits and Pricing

- **Default Quota**: 60 calls per hour for each API
- **Quota Increases**: Contact USPS via service request to increase quotas
- **All v3 APIs**: Require OAuth 2.0 access token in Authorization header
- **Token Format**: Bearer token scheme

## Additional Resources

- **USPS Developer Portal**: https://developer.usps.com/
- **OAuth 2.0 Documentation**: https://developer.usps.com/oauth
- **API Examples on GitHub**: https://github.com/USPS/api-examples
- **Support Email**: APISupport@usps.gov
- **Getting Started Guide**: https://developer.usps.com/getting-started

## Next Steps

After successfully configuring USPS:

1. Consider also setting up Google Maps API for comparison
2. Test with various addresses to ensure accuracy
3. Monitor API usage to stay within limits
4. Implement error handling for when APIs are unavailable

## Security Notes

- Never commit your credentials to version control
- Keep your .env file secure with proper permissions
- Rotate your credentials periodically
- Use environment-specific credentials (dev/prod)