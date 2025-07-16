const fetch = require('node-fetch');

/**
 * Census Validation Module
 * Handles all Census Geocoder-specific validation logic independently
 */
class CensusValidator {
  constructor (pool) {
    this.pool = pool;
    this.name = 'Census Geocoder';
    this.id = 'census';
  }

  /**
     * Check if Census is configured (always true - it's free)
     */
  isConfigured () {
    return true;
  }

  /**
     * Get configuration status
     */
  getStatus () {
    return {
      configured: true,
      tokenValid: true,
      name: this.name
    };
  }

  /**
     * Validate address using Census Geocoder
     */
  async validate (parsedAddress) {
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
        district: districtLookup.found
          ? {
            state: districtLookup.state,
            district: districtLookup.district,
            isAtLarge: districtLookup.isAtLarge
          }
          : null,
        distanceToBoundary,
        nearestDistrict: districtLookup.found ? null : districtLookup.nearest,
        source: 'census_geocoding'
      };
    } catch (error) {
      console.error('Census validation error:', error);
      return {
        success: false,
        error: error.message,
        source: 'census_geocoding'
      };
    }
  }

  /**
     * Geocode address using Census Geocoder
     */
  async geocode (address) {
    try {
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
          },
          standardized: {
            street: match.matchedAddress,
            city: match.addressComponents?.city || address.city,
            state: match.addressComponents?.state || address.state,
            zip: match.addressComponents?.zip || address.zip
          },
          source: 'census'
        };
      }

      return {
        success: false,
        error: 'Address not found by Census geocoder',
        source: 'census'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source: 'census'
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
     * Test Census connection
     */
  async test () {
    try {
      // Test with a known address
      const testAddress = {
        street: '1600 Pennsylvania Ave NW',
        city: 'Washington',
        state: 'DC',
        zip: '20500'
      };

      const result = await this.geocode(testAddress);

      return {
        success: result.success,
        configured: true,
        tokenValid: true,
        message: result.success ? 'Census Geocoder connection successful' : 'Census Geocoder test failed'
      };
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

module.exports = CensusValidator;
