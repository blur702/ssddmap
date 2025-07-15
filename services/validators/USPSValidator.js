const USPSOAuthService = require('../uspsOAuthService');

/**
 * USPS Validation Module
 * Handles all USPS-specific validation logic independently
 */
class USPSValidator {
    constructor(pool) {
        this.pool = pool;
        this.usps = new USPSOAuthService();
        this.name = 'USPS';
        this.id = 'usps';
    }

    /**
     * Check if USPS is configured and ready
     */
    isConfigured() {
        return this.usps.isConfigured();
    }

    /**
     * Get configuration status
     */
    getStatus() {
        return {
            configured: this.usps.isConfigured(),
            tokenValid: this.usps.isTokenValid(),
            name: this.name
        };
    }

    /**
     * Validate address using USPS API
     */
    async validate(parsedAddress) {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'USPS API not configured',
                source: 'usps_standardization'
            };
        }

        try {
            // Call USPS standardization
            const uspsResult = await this.usps.standardizeAddress(parsedAddress);
            
            if (!uspsResult.success) {
                return {
                    success: false,
                    error: uspsResult.error,
                    source: 'usps_standardization'
                };
            }

            // Try ZIP+4 district lookup
            let district = null;
            if (uspsResult.standardized.zipCode && uspsResult.standardized.zipPlus4) {
                const zip4Lookup = await this.lookupDistrictFromZip4(
                    uspsResult.standardized.zipCode,
                    uspsResult.standardized.zipPlus4
                );
                if (zip4Lookup.success) {
                    district = zip4Lookup.district;
                }
            }

            // Get coordinates by geocoding the standardized address
            let coordinates = null;
            if (!district) {
                // Use Census geocoder to get coordinates for USPS address
                const geocodeResult = await this.geocodeAddress({
                    street: uspsResult.standardized.street,
                    city: uspsResult.standardized.city,
                    state: uspsResult.standardized.state,
                    zip: uspsResult.standardized.zipCode
                });
                
                if (geocodeResult.success) {
                    coordinates = geocodeResult.coordinates;
                    
                    // Get district from coordinates
                    const districtLookup = await this.findDistrictByCoordinates(
                        geocodeResult.coordinates.lat,
                        geocodeResult.coordinates.lon
                    );
                    
                    if (districtLookup.found) {
                        district = {
                            state: districtLookup.state,
                            district: districtLookup.district,
                            isAtLarge: districtLookup.isAtLarge
                        };
                    }
                } else {
                    coordinates = null;
                }
            }

            return {
                success: true,
                standardized: uspsResult.standardized,
                district: district,
                coordinates: coordinates,
                additionalInfo: uspsResult.additionalInfo,
                corrections: uspsResult.corrections,
                matches: uspsResult.matches,
                warnings: uspsResult.warnings,
                source: 'usps_standardization'
            };

        } catch (error) {
            console.error('USPS validation error:', error);
            return {
                success: false,
                error: error.message,
                source: 'usps_standardization'
            };
        }
    }

    /**
     * Lookup district from ZIP+4 using local database
     */
    async lookupDistrictFromZip4(zip5, zip4) {
        try {
            const result = await this.pool.query(`
                SELECT state_code, district_number, county_fips
                FROM zip4_districts 
                WHERE zip5 = $1 AND zip4 = $2
                LIMIT 1
            `, [zip5, zip4]);

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    success: true,
                    district: {
                        state: row.state_code,
                        district: row.district_number.toString(),
                        countyFips: row.county_fips
                    },
                    source: 'local_zip4'
                };
            }

            return {
                success: false,
                error: 'ZIP+4 not found in local database',
                source: 'local_zip4'
            };

        } catch (error) {
            console.error('ZIP+4 lookup error:', error);
            return {
                success: false,
                error: error.message,
                source: 'local_zip4'
            };
        }
    }

    /**
     * Geocode address using Census Geocoder (for coordinates)
     */
    async geocodeAddress(address) {
        try {
            const fetch = require('node-fetch');
            const addressStr = `${address.street}, ${address.city}, ${address.state}${address.zip ? ' ' + address.zip : ''}`;
            const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(addressStr)}&benchmark=Public_AR_Current&format=json`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.result && data.result.addressMatches && data.result.addressMatches.length > 0) {
                const match = data.result.addressMatches[0];
                return {
                    success: true,
                    coordinates: {
                        lat: match.coordinates.y,
                        lon: match.coordinates.x
                    }
                };
            }
            
            return {
                success: false,
                error: 'Address not found by geocoder'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find congressional district by coordinates
     */
    async findDistrictByCoordinates(lat, lon) {
        try {
            const result = await this.pool.query(`
                SELECT 
                    d.state_code,
                    d.district_number,
                    d.is_at_large
                FROM districts d
                WHERE ST_Contains(d.geometry, ST_SetSRID(ST_MakePoint($2, $1), 4326))
                LIMIT 1
            `, [lat, lon]);

            if (result.rows.length > 0) {
                const district = result.rows[0];
                return {
                    found: true,
                    state: district.state_code,
                    district: district.district_number.toString(),
                    isAtLarge: district.is_at_large
                };
            }

            return { found: false };

        } catch (error) {
            console.error('Error finding district by coordinates:', error);
            throw error;
        }
    }

    /**
     * Test USPS connection
     */
    async test() {
        return await this.usps.testConnection();
    }
}

module.exports = USPSValidator;