const USPSValidator = require('./validators/USPSValidator');
const CensusValidator = require('./validators/CensusValidator');
const GoogleValidator = require('./validators/GoogleValidator');

/**
 * Validation Orchestrator
 * Manages all validation modules and coordinates validation requests
 */
class ValidationOrchestrator {
    constructor(pool) {
        this.pool = pool;
        
        // Initialize validators
        this.validators = {
            usps: new USPSValidator(pool),
            census: new CensusValidator(pool),
            google: new GoogleValidator(pool)
        };
    }

    /**
     * Parse address string into components
     */
    parseAddress(addressString) {
        if (!addressString || typeof addressString !== 'string' || !addressString.trim()) {
            throw new Error('Address is required');
        }
        
        let parts = addressString.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        // If no commas found, try to parse based on common patterns
        if (parts.length < 2) {
            const normalized = addressString.trim();
            
            // Try to match state abbreviation at the end
            const stateMatch = normalized.match(/\b([A-Z]{2})\\s*(\\d{5})?(?:-\\d{4})?\\s*$/i);
            if (stateMatch) {
                const beforeState = normalized.substring(0, stateMatch.index).trim();
                const state = stateMatch[1];
                const zip = stateMatch[2] || '';
                
                // Try to find city name (usually after street address)
                const streetMatch = beforeState.match(/^(.*?\\d+.*?(?:st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|way|ct|court|pl|place|cir|circle|pkwy|parkway))\\s+(.+)$/i);
                
                if (streetMatch) {
                    parts = [streetMatch[1].trim(), streetMatch[2].trim(), state + (zip ? ' ' + zip : '')];
                } else {
                    // Fallback: assume last 2-3 words before state are city
                    const words = beforeState.split(/\\s+/);
                    if (words.length >= 3) {
                        const cityWords = Math.min(3, Math.floor(words.length / 2));
                        const street = words.slice(0, -cityWords).join(' ');
                        const city = words.slice(-cityWords).join(' ');
                        parts = [street, city + ', ' + state + (zip ? ' ' + zip : '')];
                    } else {
                        throw new Error('Address must include at least street and city/state');
                    }
                }
            } else {
                throw new Error('Address must include at least street and city/state');
            }
        }

        const street = parts[0];
        const lastPart = parts[parts.length - 1];
        
        // Extract ZIP, state, and city
        const zipMatch = lastPart.match(/\\b(\\d{5}(-\\d{4})?)\\b/);
        let zip = zipMatch ? zipMatch[1].split('-')[0] : '';
        let state = '';
        let city = '';

        if (zipMatch) {
            const withoutZip = lastPart.replace(zipMatch[0], '').trim();
            const stateMatch = withoutZip.match(/\\b([A-Z]{2})\\b$/i);
            if (stateMatch) {
                state = stateMatch[1];
                city = withoutZip.replace(stateMatch[0], '').trim();
            } else {
                state = withoutZip;
            }
        } else {
            const stateMatch = lastPart.match(/\\b([A-Z]{2})\\b$/i);
            if (stateMatch) {
                state = stateMatch[1];
                city = lastPart.replace(stateMatch[0], '').trim();
            } else {
                state = lastPart;
            }
        }

        // Handle middle parts as city if needed
        if (!city && parts.length > 2) {
            city = parts[1];
        }

        return {
            street: street || '',
            city: city || '',
            state: state ? state.toUpperCase() : '',
            zip: zip || ''
        };
    }

    /**
     * Get status of all validators
     */
    getStatus() {
        const status = {};
        for (const [key, validator] of Object.entries(this.validators)) {
            status[key] = validator.getStatus();
        }
        return status;
    }

    /**
     * Validate address with specific validators
     */
    async validateWithMethods(addressString, methods) {
        const parsedAddress = this.parseAddress(addressString);
        
        const results = {
            originalInput: addressString,
            parsedAddress: parsedAddress,
            methods: {}
        };

        // Validate with each requested method
        const validationPromises = methods.map(async (method) => {
            if (this.validators[method]) {
                try {
                    results.methods[method] = await this.validators[method].validate(parsedAddress);
                } catch (error) {
                    results.methods[method] = {
                        success: false,
                        error: error.message,
                        source: method
                    };
                }
            }
        });

        await Promise.all(validationPromises);

        // Analyze results if multiple methods were used
        if (Object.keys(results.methods).length > 1) {
            results.analysis = this.analyzeResults(results.methods);
        }

        return results;
    }

    /**
     * Validate address with all available validators
     */
    async validateWithAll(addressString) {
        const availableMethods = [];
        
        // Check which validators are configured
        for (const [key, validator] of Object.entries(this.validators)) {
            if (validator.isConfigured()) {
                availableMethods.push(key);
            }
        }

        return this.validateWithMethods(addressString, availableMethods);
    }

    /**
     * Test a specific validator
     */
    async testValidator(validatorId) {
        if (this.validators[validatorId]) {
            return await this.validators[validatorId].test();
        }
        throw new Error(`Unknown validator: ${validatorId}`);
    }

    /**
     * Save USPS configuration
     */
    saveUSPSConfig(clientId, clientSecret) {
        // This would typically update the .env file
        // For now, just update the environment variables
        process.env.USPS_CLIENT_ID = clientId;
        process.env.USPS_CLIENT_SECRET = clientSecret;
        
        // Reinitialize USPS validator
        this.validators.usps = new USPSValidator(this.pool);
    }

    /**
     * Save Google configuration
     */
    saveGoogleConfig(apiKey) {
        process.env.GOOGLE_MAPS_API_KEY = apiKey;
        
        // Reinitialize Google validator
        this.validators.google = new GoogleValidator(this.pool);
    }

    /**
     * Analyze and compare results from different methods
     */
    analyzeResults(methods) {
        const analysis = {
            consistency: 'unknown',
            issues: [],
            recommendations: []
        };

        const districts = [];
        const coordinates = [];

        // Collect successful results
        Object.values(methods).forEach(method => {
            if (method.success && method.district) {
                districts.push(`${method.district.state}-${method.district.district}`);
            }
            if (method.success && method.coordinates) {
                coordinates.push(method.coordinates);
            }
        });

        // Check district consistency
        const uniqueDistricts = [...new Set(districts)];
        if (uniqueDistricts.length === 0) {
            analysis.consistency = 'no_results';
            analysis.issues.push('No successful district assignments found');
        } else if (uniqueDistricts.length === 1) {
            analysis.consistency = 'consistent';
            analysis.recommendations.push('All methods agree on district assignment');
        } else {
            analysis.consistency = 'inconsistent';
            analysis.issues.push(`District mismatch: ${uniqueDistricts.join(', ')}`);
            analysis.recommendations.push('Review address for accuracy, check if near district boundary');
        }

        // Check coordinate consistency
        if (coordinates.length > 1) {
            const latDiff = Math.abs(coordinates[0].lat - coordinates[1].lat);
            const lonDiff = Math.abs(coordinates[0].lon - coordinates[1].lon);
            
            if (latDiff > 0.001 || lonDiff > 0.001) {
                analysis.issues.push('Significant coordinate difference between geocoding services');
            }
        }

        // Check boundary proximity
        Object.values(methods).forEach(method => {
            if (method.distanceToBoundary && method.distanceToBoundary.distanceMeters < 100) {
                analysis.issues.push('Address is very close to district boundary (< 100m)');
                analysis.recommendations.push('Manual verification recommended for boundary-adjacent addresses');
            }
        });

        return analysis;
    }
}

module.exports = ValidationOrchestrator;