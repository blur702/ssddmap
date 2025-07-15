module.exports = {
    // Lookup method: 'census', 'zip4', 'smarty', or 'both'
    defaultLookupMethod: process.env.LOOKUP_METHOD || 'census',
    
    // USPS OAuth API v3 (requires registration at developers.usps.com)
    usps: {
        clientId: process.env.USPS_CLIENT_ID || '',
        clientSecret: process.env.USPS_CLIENT_SECRET || '',
        baseUrl: process.env.USPS_BASE_URL || 'https://api.usps.com',
        tokenUrl: 'https://api.usps.com/oauth2/v3/token',
        crid: process.env.USPS_CRID || '',
        outboundMid: process.env.USPS_OUTBOUND_MID || '',
        returnMid: process.env.USPS_RETURN_MID || ''
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