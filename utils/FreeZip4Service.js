// Free ZIP+4 to Congressional District Service
// Uses Census Geocoder API (free, no API key required)

const https = require('https');

class FreeZip4Service {
    constructor() {
        this.censusBaseUrl = 'https://geocoding.geo.census.gov/geocoder';
    }

    // Parse address into components
    parseAddress(addressString) {
        // Handle "123 Main St, City, ST 12345-6789" format
        const parts = addressString.split(',').map(s => s.trim());
        if (parts.length < 3) return null;
        
        const street = parts[0];
        const city = parts[1];
        const stateZip = parts[2].split(' ');
        const state = stateZip[0];
        const zipParts = (stateZip[1] || '').split('-');
        const zip5 = zipParts[0] || '';
        const zip4 = zipParts[1] || '';
        
        return { street, city, state, zip5, zip4 };
    }

    // Call Census Geocoder API (FREE - no key needed)
    async geocodeAddress(street, city, state, zip) {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                street: street,
                city: city,
                state: state,
                zip: zip,
                benchmark: 'Public_AR_Current',
                format: 'json'
            });

            const url = `${this.censusBaseUrl}/locations/address?${params}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.result && result.result.addressMatches && result.result.addressMatches.length > 0) {
                            const match = result.result.addressMatches[0];
                            resolve({
                                success: true,
                                coordinates: match.coordinates,
                                matchedAddress: match.matchedAddress,
                                tigerLine: match.tigerLine,
                                geographies: match.geographies
                            });
                        } else {
                            resolve({ success: false, error: 'No matches found' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    // Get ZIP+4 from Census data if available
    extractZip4FromCensus(censusResult) {
        // Census sometimes returns ZIP+4 in the matched address
        if (censusResult.matchedAddress) {
            const zipMatch = censusResult.matchedAddress.match(/(\d{5})-(\d{4})/);
            if (zipMatch) {
                return {
                    zip5: zipMatch[1],
                    zip4: zipMatch[2]
                };
            }
        }
        return null;
    }

    // Main lookup function
    async lookupDistrict(addressString) {
        try {
            // Parse address
            const parsed = this.parseAddress(addressString);
            if (!parsed) {
                return { success: false, error: 'Invalid address format' };
            }

            // Geocode with Census API
            const geocoded = await this.geocodeAddress(
                parsed.street,
                parsed.city,
                parsed.state,
                parsed.zip5
            );

            if (!geocoded.success) {
                return geocoded;
            }

            // Extract ZIP+4 if available
            const zip4Data = this.extractZip4FromCensus(geocoded);

            // Return data for PostGIS lookup
            return {
                success: true,
                address: geocoded.matchedAddress,
                coordinates: {
                    lat: geocoded.coordinates.y,
                    lon: geocoded.coordinates.x
                },
                zip4: zip4Data,
                censusBlock: geocoded.geographies?.['Census Blocks']?.[0]?.GEOID,
                county: geocoded.geographies?.Counties?.[0]?.BASENAME,
                // Note: Congressional district must be looked up via PostGIS
                // using the coordinates returned here
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = FreeZip4Service;

/* Usage Example:

const service = new FreeZip4Service();

// No API key needed!
const result = await service.lookupDistrict('1600 Pennsylvania Ave NW, Washington, DC 20500');

if (result.success) {
    // Use coordinates to query PostGIS for congressional district
    const district = await queryPostGIS(result.coordinates.lat, result.coordinates.lon);
}
*/