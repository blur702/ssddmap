module.exports = {
    // Lookup method: 'census', 'zip4', 'smarty', or 'both'
    defaultLookupMethod: process.env.LOOKUP_METHOD || 'census',
    
    // USPS Web Tools API (free, requires registration)
    usps: {
        userId: process.env.USPS_USER_ID || '',
        apiUrl: 'http://production.shippingapis.com/ShippingAPI.dll'
    },
    
    // Smarty (formerly SmartyStreets) - commercial service
    smarty: {
        authId: process.env.SMARTY_AUTH_ID || '',
        authToken: process.env.SMARTY_AUTH_TOKEN || ''
    },
    
    // Google Civic API (free tier available)
    google: {
        apiKey: process.env.GOOGLE_API_KEY || ''
    },
    
    // Database for local ZIP+4 storage (if implemented)
    database: {
        type: 'sqlite', // or 'postgresql'
        path: './data/zip4_districts.db'
    },
    
    // Comparison settings
    comparison: {
        enabled: process.env.ENABLE_COMPARISON === 'true',
        showConfidenceScore: true,
        flagMismatches: true
    }
};