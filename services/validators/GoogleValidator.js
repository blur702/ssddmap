const fetch = require('node-fetch');

/**
 * Google Maps Validation Module
 * Handles all Google Maps-specific validation logic independently
 */
class GoogleValidator {
  constructor (pool) {
    this.pool = pool;
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.name = 'Google Maps';
    this.id = 'google';
  }

  /**
     * Check if Google Maps is configured
     */
  isConfigured () {
    return !!(this.apiKey && this.apiKey.trim());
  }

  /**
     * Get configuration status
     */
  getStatus () {
    return {
      configured: this.isConfigured(),
      tokenValid: this.isConfigured(),
      name: this.name
    };
  }

  /**
     * Validate address using Google Maps API
     */
  async validate (parsedAddress) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Google Maps API key not configured',
        source: 'google'
      };
    }

    try {
      // Geocode the address
      const geocodeResult = await this.geocode(parsedAddress);

      if (!geocodeResult.success) {
        return geocodeResult;
      }

      // Find district from coordinates
      const districtLookup = await this.findDistrictByCoordinates(
        geocodeResult.coordinates.lat,
        geocodeResult.coordinates.lon
      );

      let distanceToBoundary = null;
      if (districtLookup.found) {
        distanceToBoundary = await this.getDistanceToBoundary(
          geocodeResult.coordinates.lat,
          geocodeResult.coordinates.lon,
          districtLookup.state,
          districtLookup.district
        );
      }

      return {
        success: true,
        coordinates: geocodeResult.coordinates,
        standardized: geocodeResult.standardized,
        formatted: geocodeResult.formatted,
        district: districtLookup.found
          ? {
            state: districtLookup.state,
            district: districtLookup.district,
            isAtLarge: districtLookup.isAtLarge
          }
          : null,
        distanceToBoundary,
        nearestDistrict: districtLookup.found ? null : districtLookup.nearest,
        source: 'google_geocoding'
      };
    } catch (error) {
      console.error('Google validation error:', error);
      return {
        success: false,
        error: error.message,
        source: 'google_geocoding'
      };
    }
  }

  /**
     * Geocode address using Google Maps
     */
  async geocode (address) {
    try {
      const addressStr = `${address.street}, ${address.city}, ${address.state}${address.zip ? ' ' + address.zip : ''}`;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;

        // Extract components
        const components = {};
        result.address_components.forEach(comp => {
          if (comp.types.includes('street_number')) {
            components.streetNumber = comp.long_name;
          } else if (comp.types.includes('route')) {
            components.streetName = comp.long_name;
          } else if (comp.types.includes('locality')) {
            components.city = comp.long_name;
          } else if (comp.types.includes('administrative_area_level_1')) {
            components.state = comp.short_name;
          } else if (comp.types.includes('postal_code')) {
            components.zip = comp.long_name;
          }
        });

        return {
          success: true,
          coordinates: {
            lat: location.lat,
            lon: location.lng
          },
          standardized: {
            street: `${components.streetNumber || ''} ${components.streetName || ''}`.trim(),
            city: components.city || address.city,
            state: components.state || address.state,
            zip: components.zip || address.zip
          },
          formatted: result.formatted_address,
          source: 'google'
        };
      }

      return {
        success: false,
        error: data.error_message || 'Address not found by Google Maps',
        source: 'google'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source: 'google'
      };
    }
  }

  /**
     * Find congressional district by coordinates
     */
  async findDistrictByCoordinates (lat, lon) {
    try {
      const result = await this.pool.query(`
                SELECT 
                    d.state_code,
                    d.district_number,
                    d.is_at_large,
                    ST_Distance(
                        ST_Transform(d.geometry, 3857),
                        ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
                    ) as distance_meters
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
          isAtLarge: district.is_at_large,
          distanceToCenter: parseFloat(district.distance_meters)
        };
      }

      // If not found inside any district, find the nearest one
      const nearestResult = await this.pool.query(`
                SELECT 
                    d.state_code,
                    d.district_number,
                    d.is_at_large,
                    ST_Distance(
                        ST_Transform(d.geometry, 3857),
                        ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
                    ) as distance_meters
                FROM districts d
                ORDER BY d.geometry <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
                LIMIT 1
            `, [lat, lon]);

      if (nearestResult.rows.length > 0) {
        const nearest = nearestResult.rows[0];
        return {
          found: false,
          nearest: {
            state: nearest.state_code,
            district: nearest.district_number.toString(),
            isAtLarge: nearest.is_at_large,
            distanceMeters: parseFloat(nearest.distance_meters)
          }
        };
      }

      return { found: false };
    } catch (error) {
      console.error('Error finding district by coordinates:', error);
      throw error;
    }
  }

  /**
     * Get distance to nearest district boundary
     */
  async getDistanceToBoundary (lat, lon, state, district) {
    try {
      const result = await this.pool.query(`
                SELECT 
                    ST_Distance(
                        ST_Transform(ST_Boundary(d.geometry), 3857),
                        ST_Transform(ST_SetSRID(ST_MakePoint($2, $1), 4326), 3857)
                    ) as distance_to_boundary_meters
                FROM districts d
                WHERE d.state_code = $3 AND d.district_number = $4
            `, [lat, lon, state, parseInt(district)]);

      if (result.rows.length > 0) {
        return {
          distanceMeters: parseFloat(result.rows[0].distance_to_boundary_meters),
          distanceKm: parseFloat(result.rows[0].distance_to_boundary_meters) / 1000,
          distanceMiles: parseFloat(result.rows[0].distance_to_boundary_meters) / 1609.34
        };
      }

      return null;
    } catch (error) {
      console.error('Error calculating distance to boundary:', error);
      return null;
    }
  }

  /**
     * Test Google Maps connection
     */
  async test () {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        tokenValid: false,
        error: 'Google Maps API key not configured'
      };
    }

    try {
      // Test with a simple geocode request
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Pennsylvania+Ave+NW,+Washington,+DC&key=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return {
          success: true,
          configured: true,
          tokenValid: true,
          message: 'Google Maps API connection successful'
        };
      } else {
        return {
          success: false,
          configured: true,
          tokenValid: false,
          error: data.error_message || data.status
        };
      }
    } catch (error) {
      return {
        success: false,
        configured: true,
        tokenValid: false,
        error: error.message
      };
    }
  }
}

module.exports = GoogleValidator;
