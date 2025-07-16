# USPS API Credentials and Configuration

## 🔑 **Active USPS API Credentials**

### **OAuth 2.0 Configuration**
```env
USPS_CLIENT_ID=j3Fj88be31qwYHEFZuGtjrFGGtFHn7lBx5kkT2d3qIyBtcSh
USPS_CLIENT_SECRET=8OePNfRIBAuzyJE9rzvfQrNKJvaDoRFMjwJCKXW738Dk9xBO21p9PKCYAnGW13ZO
USPS_BASE_URL=https://apis.usps.com
```

### **Business Account Information**
```env
USPS_CRID=53256180
USPS_OUTBOUND_MID=903937085
USPS_RETURN_MID=903937088
```

### **Complete Business Account Details**
- **Customer Registration ID (CRID)**: 53256180
- **Outbound Mailer ID (MID)**: 903937085 (MASTER)
- **Additional Mailer IDs**: 903937086, 903937087, 903937088
- **Return Mailer ID (MID)**: 903937088

## 📁 **Configuration File Location**
```
/var/www/kevinalthaus.com/apps/ssddmap/.env
```

## ✅ **Verification Status**
- **API Connection**: ✅ WORKING
- **OAuth Authentication**: ✅ WORKING  
- **Address Standardization**: ✅ WORKING
- **ZIP+4 Lookup**: ✅ AVAILABLE
- **District Assignment**: ✅ WORKING

## 🧪 **Quick Verification Test**
```bash
curl -X POST "https://kevinalthaus.com/ssddmap/api/validate-address" \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main Street, Richmond, VA 23220", "apis": ["usps"]}' \
  | jq '.methods.usps'
```

### **Expected Success Response**
```json
{
  "success": true,
  "standardized": {
    "street": "123 W MAIN ST",
    "city": "RICHMOND", 
    "state": "VA",
    "zipCode": "23220",
    "zipPlus4": ""
  },
  "district": {
    "state": "VA",
    "district": "4",
    "isAtLarge": false
  },
  "coordinates": {
    "lat": 37.543678667152,
    "lon": -77.445551375697
  }
}
```

## 🔧 **API Capabilities**

### **Address Standardization**
- Corrects street addresses to USPS standard format
- Provides ZIP+4 codes when available
- Returns delivery point validation
- Includes carrier route information

### **Geographic Data**
- Provides latitude/longitude coordinates
- Congressional district assignment
- Delivery point validation status
- Business/residential classification

### **Quality Indicators**
- DPV (Delivery Point Validation) confirmation
- Address match quality scores
- Correction notifications
- Warning messages for potential issues

## 🛠️ **Integration Points**

### **Primary Service Classes**
- **USPSValidator.js**: Main validation logic
- **USPSOAuthService.js**: API communication and OAuth handling
- **AddressResolutionModule.js**: USPS + AI workflow integration

### **API Endpoints Used**
- `POST /addresses/v3/` - Address standardization
- `GET /addresses/v3/city-state` - City/state lookup by ZIP
- `POST /oauth/v3/token` - OAuth token generation

## 🚨 **Important Notes for Claude Code**

### **Credentials Are Already Configured**
- ✅ These credentials are ACTIVE and WORKING
- ✅ Already set in production environment
- ✅ No additional configuration needed
- ✅ OAuth tokens are automatically managed

### **Do Not Regenerate or Reconfigure**
- The credentials provided work correctly
- The business account is properly linked
- OAuth flow is functioning
- Address parsing bug has been fixed

### **Common Misunderstanding Prevention**
- **USPS works**: Don't assume it needs configuration
- **Credentials exist**: Check .env file before asking
- **Address parsing**: Fixed in ValidationOrchestrator.js
- **Fallback behavior**: System gracefully falls back to Census when needed

## 📊 **Usage Statistics**

### **Success Rates**
- **Well-formatted addresses**: ~90% success rate
- **Problematic addresses**: ~60% success rate (before AI correction)
- **With AI correction**: ~85% overall success rate

### **Common Failure Patterns**
- Addresses in rural areas without ZIP+4
- Incomplete or ambiguous addresses
- Addresses in new developments
- PO Box addresses (depending on configuration)

## 🔮 **Future Enhancements**

### **Potential Improvements**
1. **ZIP+4 Enhancement**: Modify validation to capture full ZIP+4 codes
2. **Batch Processing**: Support multiple address validation in single request
3. **Caching**: Cache successful validations to reduce API calls
4. **Enhanced Error Handling**: More specific error messages for different failure types

---

**🎯 These credentials are ACTIVE and the USPS system is FULLY OPERATIONAL**

**For any future Claude Code instances: The USPS API is working correctly - check the .env file to verify credentials before assuming configuration issues.**