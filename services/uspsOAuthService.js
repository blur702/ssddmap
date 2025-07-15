const fetch = require('node-fetch');

class USPSOAuthService {
    constructor() {
        this.clientId = process.env.USPS_CLIENT_ID;
        this.clientSecret = process.env.USPS_CLIENT_SECRET;
        this.baseUrl = process.env.USPS_BASE_URL || 'https://api.usps.com';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Check if we have valid configuration
     */
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    /**
     * Check if current token is valid
     */
    isTokenValid() {
        return !!(this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry);
    }

    /**
     * Get OAuth 2.0 access token
     */
    async getAccessToken() {
        if (this.isTokenValid()) {
            return this.accessToken;
        }

        if (!this.isConfigured()) {
            throw new Error('USPS OAuth not configured - missing client ID or secret');
        }

        try {
            const response = await fetch(`${this.baseUrl}/oauth2/v3/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=client_credentials&client_id=${encodeURIComponent(this.clientId)}&client_secret=${encodeURIComponent(this.clientSecret)}&scope=addresses`
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`USPS OAuth failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            this.accessToken = data.access_token;
            // Set expiry with 5 minute buffer
            this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);
            
            return this.accessToken;

        } catch (error) {
            console.error('USPS OAuth error:', error);
            throw error;
        }
    }

    /**
     * Standardize address using USPS Addresses API v3
     */
    async standardizeAddress(address) {
        const token = await this.getAccessToken();
        
        const params = new URLSearchParams({
            streetAddress: address.street,
            state: address.state ? address.state.toUpperCase() : ''
        });

        if (address.city) params.append('city', address.city);
        if (address.zip) params.append('ZIPCode', address.zip);
        if (address.firm) params.append('firm', address.firm);
        if (address.secondaryAddress) params.append('secondaryAddress', address.secondaryAddress);

        try {
            const response = await fetch(`${this.baseUrl}/addresses/v3/address?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`USPS API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.address) {
                return {
                    success: true,
                    standardized: {
                        firm: data.firm || '',
                        street: data.address.streetAddress || '',
                        streetAbbreviation: data.address.streetAddressAbbreviation || '',
                        secondaryAddress: data.address.secondaryAddress || '',
                        city: data.address.city || '',
                        cityAbbreviation: data.address.cityAbbreviation || '',
                        state: data.address.state || '',
                        zipCode: data.address.ZIPCode || '',
                        zipPlus4: data.address.ZIPPlus4 || ''
                    },
                    additionalInfo: data.additionalInfo || {},
                    corrections: data.corrections || [],
                    matches: data.matches || [],
                    warnings: data.warnings || []
                };
            } else {
                return {
                    success: false,
                    error: 'No address data returned from USPS'
                };
            }

        } catch (error) {
            console.error('USPS standardization error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get city and state for ZIP code
     */
    async getCityState(zipCode) {
        const token = await this.getAccessToken();
        
        try {
            const response = await fetch(`${this.baseUrl}/addresses/v3/city-state?ZIPCode=${zipCode}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`USPS API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return {
                success: true,
                city: data.city,
                state: data.state,
                zipCode: data.ZIPCode
            };

        } catch (error) {
            console.error('USPS city-state lookup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get ZIP code for address
     */
    async getZipCode(address) {
        const token = await this.getAccessToken();
        
        const params = new URLSearchParams({
            streetAddress: address.street,
            city: address.city,
            state: address.state
        });

        if (address.firm) params.append('firm', address.firm);
        if (address.secondaryAddress) params.append('secondaryAddress', address.secondaryAddress);

        try {
            const response = await fetch(`${this.baseUrl}/addresses/v3/zipcode?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`USPS API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.address) {
                return {
                    success: true,
                    firm: data.firm || '',
                    address: data.address
                };
            } else {
                return {
                    success: false,
                    error: 'No ZIP code data returned from USPS'
                };
            }

        } catch (error) {
            console.error('USPS ZIP lookup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test the USPS connection
     */
    async testConnection() {
        try {
            const token = await this.getAccessToken();
            return {
                success: true,
                configured: true,
                tokenValid: true,
                message: 'USPS API connection successful'
            };
        } catch (error) {
            return {
                success: false,
                configured: this.isConfigured(),
                tokenValid: false,
                error: error.message
            };
        }
    }
}

module.exports = USPSOAuthService;