# USPS Web Tools Setup for Free ZIP+4

## Steps to Get Free ZIP+4 Lookup:

### 1. Register for USPS Web Tools (Free)
1. Go to: https://www.usps.com/business/web-tools-apis/
2. Click "Register" for Web Tools API
3. Fill out the form:
   - Use your real information
   - For "How will you use the APIs?": Select "Customer Service"
   - Expected volume: "Less than 50,000 requests per day"
4. Submit and wait 1-2 business days

### 2. You'll Receive:
- Username (like "123YOURC456")
- Password (currently not used for API)
- Documentation links

### 3. Test Your Access:
```bash
# Test URL (replace YOUR_USER_ID)
curl "http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=<AddressValidateRequest USERID='YOUR_USER_ID'><Address><Address1>1600 Pennsylvania Ave NW</Address1><City>Washington</City><State>DC</State><Zip5>20500</Zip5></Address></AddressValidateRequest>"
```

### 4. What You Get:
```xml
<AddressValidateResponse>
  <Address>
    <Address2>1600 PENNSYLVANIA AVE NW</Address2>
    <City>WASHINGTON</City>
    <State>DC</State>
    <Zip5>20500</Zip5>
    <Zip4>0003</Zip4>  <!-- This is what we want! -->
  </Address>
</AddressValidateResponse>
```

## Integration Code:

```javascript
// Add to your server.js
const parseXML = require('xml2js').parseString;

async function getZip4FromUSPS(street, city, state, zip5) {
    const xml = `<AddressValidateRequest USERID="${process.env.USPS_USER_ID}">
        <Address>
            <Address1>${street}</Address1>
            <City>${city}</City>
            <State>${state}</State>
            <Zip5>${zip5}</Zip5>
        </Address>
    </AddressValidateRequest>`;
    
    const response = await fetch(
        `http://production.shippingapis.com/ShippingAPI.dll?API=Verify&XML=${encodeURIComponent(xml)}`
    );
    
    const xmlText = await response.text();
    
    return new Promise((resolve, reject) => {
        parseXML(xmlText, (err, result) => {
            if (err) reject(err);
            const addr = result.AddressValidateResponse.Address[0];
            resolve({
                zip5: addr.Zip5[0],
                zip4: addr.Zip4[0],
                standardized: `${addr.Address2[0]}, ${addr.City[0]}, ${addr.State[0]} ${addr.Zip5[0]}-${addr.Zip4[0]}`
            });
        });
    });
}
```

## Limits:
- No published rate limits
- Generally allows 5,000-10,000 requests per day
- Don't hammer the API - add delays for bulk processing

## Cost: FREE
No charges, no credit card required!