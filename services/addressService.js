const fetch = require('node-fetch');
const xml2js = require('xml2js');
const DatabaseService = require('./databaseService');

class AddressService {
    constructor(config) {
        this.config = config;
        this.parser = new xml2js.Parser({ explicitArray: false });
        this.db = new DatabaseService();
        this.dbInitialized = false;
    }

    async initDatabase() {
        if (!this.dbInitialized) {
            await this.db.initialize();
            this.dbInitialized = true;
        }
    }

    /**
     * Standardize address using USPS API and get ZIP+4
     */
    async standardizeUSPS(address) {
        if (!this.config.usps.userId) {
            return { 
                success: false, 
                error: 'USPS API not configured. Please set USPS_USER_ID environment variable.' 
            };
        }
        
        const { street, city, state, zip } = address;
        
        // Build USPS XML request
        const xml = `
            <AddressValidateRequest USERID="${this.config.usps.userId}">
                <Revision>1</Revision>
                <Address ID="0">
                    <Address1></Address1>
                    <Address2>${street}</Address2>
                    <City>${city}</City>
                    <State>${state}</State>
                    <Zip5>${zip || ''}</Zip5>
                    <Zip4></Zip4>
                </Address>
            </AddressValidateRequest>
        `.trim();

        try {
            const url = `${this.config.usps.apiUrl}?API=Verify&XML=${encodeURIComponent(xml)}`;
            const response = await fetch(url);
            const xmlResponse = await response.text();
            const result = await this.parser.parseStringPromise(xmlResponse);

            if (result.AddressValidateResponse?.Address) {
                const addr = result.AddressValidateResponse.Address;
                return {
                    success: true,
                    address: {
                        street: addr.Address2,
                        city: addr.City,
                        state: addr.State,
                        zip5: addr.Zip5,
                        zip4: addr.Zip4,
                        full: `${addr.Address2}, ${addr.City}, ${addr.State} ${addr.Zip5}-${addr.Zip4}`
                    }
                };
            }

            return { success: false, error: 'Invalid address' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Look up congressional district using Smarty API
     */
    async lookupDistrictSmarty(address) {
        if (!this.config.smarty.authId || !this.config.smarty.authToken) {
            return { 
                success: false, 
                error: 'Smarty API not configured. Please set SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN environment variables.' 
            };
        }
        
        const { street, city, state, zip } = address;
        
        const url = 'https://us-street.api.smartystreets.com/street-address';
        const params = new URLSearchParams({
            street: street,
            city: city,
            state: state,
            zipcode: zip,
            candidates: 1
        });

        try {
            const response = await fetch(`${url}?${params}`, {
                headers: {
                    'Auth-ID': this.config.smarty.authId,
                    'Auth-Token': this.config.smarty.authToken,
                }
            });

            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const metadata = result.metadata;
                
                return {
                    success: true,
                    district: {
                        state: result.components.state_abbreviation,
                        district: metadata.congressional_district,
                        countyFips: metadata.county_fips,
                        countyName: metadata.county_name
                    },
                    standardized: {
                        street: result.delivery_line_1,
                        city: result.components.city_name,
                        state: result.components.state_abbreviation,
                        zip5: result.components.zipcode,
                        zip4: result.components.plus4_code,
                        lat: metadata.latitude,
                        lon: metadata.longitude
                    }
                };
            }

            return { success: false, error: 'Address not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Look up district from ZIP+4 using local database
     */
    async lookupDistrictFromZip4(zip5, zip4) {
        await this.initDatabase();
        
        try {
            const result = await this.db.lookupDistrict(zip5, zip4);
            
            if (result) {
                // Log successful lookup
                await this.db.logLookup({
                    zip5,
                    zip4,
                    state_code: result.state_code,
                    district_number: result.district_number,
                    method: 'local_db',
                    success: true
                });
                
                return {
                    success: true,
                    district: {
                        state: result.state_code,
                        district: result.district_number,
                        countyFips: result.county_fips
                    },
                    source: 'local_database'
                };
            }
            
            // Log failed lookup
            await this.db.logLookup({
                zip5,
                zip4,
                method: 'local_db',
                success: false
            });
            
            return null;
        } catch (error) {
            console.error('Database lookup error:', error);
            return null;
        }
    }

    /**
     * Combined lookup - try multiple methods
     */
    async lookupDistrict(address, method = 'smarty') {
        switch (method) {
            case 'usps-local':
                // First standardize with USPS
                const uspsResult = await this.standardizeUSPS(address);
                if (!uspsResult.success) return uspsResult;
                
                // Then lookup in local database
                const localResult = await this.lookupDistrictFromZip4(
                    uspsResult.address.zip5, 
                    uspsResult.address.zip4
                );
                
                if (localResult) {
                    return {
                        success: true,
                        method: 'usps-local',
                        ...localResult
                    };
                }
                return { success: false, error: 'District not found in local database' };

            case 'smarty':
                const smartyResult = await this.lookupDistrictSmarty(address);
                return { ...smartyResult, method: 'smarty' };

            default:
                return { success: false, error: 'Unknown method' };
        }
    }
}

module.exports = AddressService;