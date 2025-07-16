const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
// const turf = require('@turf/turf'); // Unused, commented out
const fetch = require('node-fetch');
const ValidationService = require('./services/validationService');
const USPSOAuthService = require('./services/uspsOAuthService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ssddmap',
  user: process.env.DB_USER || 'ssddmap_user',
  password: process.env.DB_PASSWORD || 'ssddmap123'
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0].now);
  }
});

// Serve static files from public directory
app.use('/ssddmap', express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Create router for /ssddmap prefix
const router = express.Router();

// Initialize services
const validationService = new ValidationService(pool);
const uspsService = new USPSOAuthService();

// Get all available states
router.get('/api/states', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT state_code FROM states ORDER BY state_code'
    );
    res.json(result.rows.map(row => row.state_code));
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get representative count per state
router.get('/api/state-rep-counts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT state_code, representative_count FROM states'
    );
    const counts = {};
    result.rows.forEach(row => {
      counts[row.state_code] = row.representative_count;
    });
    res.json(counts);
  } catch (error) {
    console.error('Error fetching rep counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get districts for a specific state
router.get('/api/state/:stateCode', async (req, res) => {
  try {
    const { stateCode } = req.params;

    const result = await pool.query(`
            SELECT 
                d.state_code as state,
                d.district_number::text as district,
                d.is_at_large as "isAtLarge",
                CASE WHEN d.is_at_large THEN NULL ELSE d.state_code || '-' || d.district_number || '.kml' END as filename,
                json_build_object(
                    'name', m.full_name,
                    'bioguideId', m.bioguide_id,
                    'party', m.party,
                    'phone', m.phone,
                    'website', m.website,
                    'contactForm', m.contact_form_url,
                    'photo', m.photo_url,
                    'state', s.state_name,
                    'district', d.district_number,
                    'office', CONCAT(m.office_room, ' ', m.office_building),
                    'social', json_build_object(
                        'facebook', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'facebook'),
                        'twitter', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'twitter'),
                        'youtube', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'youtube'),
                        'instagram', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'instagram')
                    ),
                    'committees', (
                        SELECT json_agg(json_build_object(
                            'name', c.committee_name,
                            'code', c.committee_code,
                            'role', mc.role
                        ) ORDER BY mc.rank, c.committee_name)
                        FROM member_committees mc
                        JOIN committees c ON mc.committee_id = c.id
                        WHERE mc.member_id = m.id
                    )
                ) as member
            FROM districts d
            JOIN states s ON d.state_code = s.state_code
            LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
            WHERE d.state_code = $1
            ORDER BY d.district_number
        `, [stateCode]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching state districts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get GeoJSON for a specific district
router.get('/api/district/:stateCode/:districtNumber', async (req, res) => {
  try {
    const { stateCode, districtNumber } = req.params;

    const result = await pool.query(`
            SELECT 
                d.state_code as state,
                d.district_number::text as district,
                d.is_at_large as "isAtLarge",
                ST_AsGeoJSON(d.geometry)::json as geometry,
                json_build_object(
                    'name', m.full_name,
                    'party', m.party,
                    'phone', m.phone,
                    'website', m.website,
                    'contactForm', m.contact_form_url,
                    'photo', m.photo_url,
                    'state', s.state_name,
                    'district', d.district_number,
                    'office', CONCAT(m.office_room, ' ', m.office_building),
                    'social', json_build_object(
                        'facebook', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'facebook'),
                        'twitter', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'twitter'),
                        'youtube', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'youtube'),
                        'instagram', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'instagram')
                    )
                ) as member
            FROM districts d
            JOIN states s ON d.state_code = s.state_code
            LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
            WHERE d.state_code = $1 AND d.district_number = $2
        `, [stateCode, parseInt(districtNumber)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'District not found' });
    }

    const district = result.rows[0];

    // Convert to GeoJSON FeatureCollection format
    res.json({
      state: district.state,
      district: district.district,
      isAtLarge: district.isAtLarge,
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: district.geometry,
          properties: {
            state: district.state,
            district: district.district
          }
        }]
      },
      member: district.member
    });
  } catch (error) {
    console.error('Error fetching district:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all districts as GeoJSON (optimized with simplified geometries)
router.get('/api/all-districts', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                d.state_code as state,
                d.district_number::text as district,
                CONCAT(d.state_code, '-', d.district_number) as id,
                d.is_at_large as "isAtLarge",
                ST_AsGeoJSON(ST_Simplify(d.geometry, 0.01))::json as geometry,
                m.party
            FROM districts d
            LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
            ORDER BY d.state_code, d.district_number
        `);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        state: row.state,
        district: row.district,
        id: row.id,
        isAtLarge: row.isAtLarge,
        party: row.party
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error fetching all districts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all House members
router.get('/api/members', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                CONCAT(m.state_code, '-', m.district_number) as key,
                m.full_name as name,
                m.bioguide_id as "bioguideId",
                m.party,
                m.phone,
                m.website,
                m.contact_form_url as "contactForm",
                m.photo_url as photo,
                s.state_name as state,
                m.district_number as district,
                CONCAT(m.office_room, ' ', m.office_building) as office,
                json_build_object(
                    'facebook', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'facebook'),
                    'twitter', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'twitter'),
                    'youtube', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'youtube'),
                    'instagram', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'instagram')
                ) as social,
                (
                    SELECT json_agg(json_build_object(
                        'name', c.committee_name,
                        'code', c.committee_code,
                        'role', mc.role
                    ) ORDER BY mc.rank, c.committee_name)
                    FROM member_committees mc
                    JOIN committees c ON mc.committee_id = c.id
                    WHERE mc.member_id = m.id
                ) as committees
            FROM members m
            JOIN states s ON m.state_code = s.state_code
        `);

    // Convert to object keyed by state-district
    const members = {};
    result.rows.forEach(row => {
      members[row.key] = {
        name: row.name,
        bioguideId: row.bioguideId,
        party: row.party,
        phone: row.phone,
        website: row.website,
        contactForm: row.contactForm,
        photo: row.photo,
        state: row.state,
        district: row.district,
        office: row.office,
        social: row.social,
        committees: row.committees || []
      };
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get member by state and district
router.get('/api/member/:stateCode/:districtNumber', async (req, res) => {
  try {
    const { stateCode, districtNumber } = req.params;

    const result = await pool.query(`
            SELECT 
                m.full_name as name,
                m.bioguide_id as "bioguideId",
                m.party,
                m.phone,
                m.website,
                m.contact_form_url as "contactForm",
                m.photo_url as photo,
                s.state_name as state,
                m.district_number as district,
                CONCAT(m.office_room, ' ', m.office_building) as office,
                json_build_object(
                    'facebook', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'facebook'),
                    'twitter', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'twitter'),
                    'youtube', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'youtube'),
                    'instagram', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'instagram')
                ) as social
            FROM members m
            JOIN states s ON m.state_code = s.state_code
            WHERE m.state_code = $1 AND m.district_number = $2
        `, [stateCode, parseInt(districtNumber)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find district by coordinates
router.get('/api/find-district', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const result = await pool.query(`
            SELECT 
                d.state_code as state,
                d.district_number::text as district,
                d.is_at_large as "isAtLarge",
                CONCAT(d.state_code, '-', d.district_number, '.kml') as filename,
                json_build_object(
                    'name', m.full_name,
                    'party', m.party,
                    'phone', m.phone,
                    'website', m.website,
                    'contactForm', m.contact_form_url,
                    'photo', m.photo_url,
                    'state', s.state_name,
                    'district', d.district_number,
                    'office', CONCAT(m.office_room, ' ', m.office_building),
                    'social', json_build_object(
                        'facebook', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'facebook'),
                        'twitter', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'twitter'),
                        'youtube', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'youtube'),
                        'instagram', (SELECT url FROM member_social_media WHERE member_id = m.id AND platform = 'instagram')
                    )
                ) as member
            FROM districts d
            JOIN states s ON d.state_code = s.state_code
            LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
            WHERE ST_Contains(d.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            LIMIT 1
        `, [parseFloat(lon), parseFloat(lat)]);

    if (result.rows.length === 0) {
      return res.json({
        found: false,
        message: 'Location not found in any congressional district',
        point: { lat, lon }
      });
    }

    const district = result.rows[0];
    res.json({
      found: true,
      state: district.state,
      district: district.district,
      filename: district.filename,
      isAtLarge: district.isAtLarge,
      member: district.member
    });
  } catch (error) {
    console.error('Find district error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find location with district and county information, including distance to boundaries
router.get('/api/find-location', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const point = 'ST_SetSRID(ST_MakePoint($1, $2), 4326)';
    const pointGeog = 'ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography';

    // Find the district containing the point and calculate distance to its boundary
    const districtResult = await pool.query(`
            WITH point_location AS (
                SELECT ${point} as geom, ${pointGeog} as geog
            ),
            containing_district AS (
                SELECT 
                    d.state_code,
                    d.district_number,
                    d.is_at_large,
                    d.geometry,
                    m.full_name as member_name,
                    m.party,
                    m.phone,
                    m.website,
                    m.contact_form_url,
                    m.photo_url,
                    s.state_name,
                    m.office_room,
                    m.office_building,
                    m.id as member_id
                FROM districts d
                JOIN states s ON d.state_code = s.state_code
                LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
                CROSS JOIN point_location p
                WHERE ST_Contains(d.geometry, p.geom)
                LIMIT 1
            ),
            distance_calc AS (
                SELECT 
                    cd.*,
                    CASE 
                        WHEN cd.state_code IS NOT NULL THEN
                            ST_Distance(p.geog, ST_Boundary(cd.geometry)::geography)
                        ELSE NULL
                    END as distance_to_boundary,
                    CASE 
                        WHEN cd.state_code IS NOT NULL THEN
                            ST_AsGeoJSON(ST_ClosestPoint(ST_Boundary(cd.geometry), p.geom))::json
                        ELSE NULL
                    END as closest_boundary_point
                FROM containing_district cd
                CROSS JOIN point_location p
            )
            SELECT 
                dc.*,
                json_build_object(
                    'facebook', (SELECT url FROM member_social_media WHERE member_id = dc.member_id AND platform = 'facebook'),
                    'twitter', (SELECT url FROM member_social_media WHERE member_id = dc.member_id AND platform = 'twitter'),
                    'youtube', (SELECT url FROM member_social_media WHERE member_id = dc.member_id AND platform = 'youtube'),
                    'instagram', (SELECT url FROM member_social_media WHERE member_id = dc.member_id AND platform = 'instagram')
                ) as social_media
            FROM distance_calc dc
        `, [parseFloat(lon), parseFloat(lat)]);

    // Find the nearest district if point is outside all districts
    let nearestDistrict = null;
    if (districtResult.rows.length === 0) {
      const nearestResult = await pool.query(`
                WITH point_location AS (
                    SELECT ${point} as geom, ${pointGeog} as geog
                ),
                nearest_districts AS (
                    SELECT 
                        d.state_code,
                        d.district_number,
                        d.is_at_large,
                        d.geometry,
                        ST_Distance(p.geog, d.geometry::geography) as distance_to_district,
                        ST_AsGeoJSON(ST_ClosestPoint(d.geometry, p.geom))::json as closest_point,
                        m.full_name as member_name,
                        m.party,
                        s.state_name
                    FROM districts d
                    JOIN states s ON d.state_code = s.state_code
                    LEFT JOIN members m ON d.state_code = m.state_code AND d.district_number = m.district_number
                    CROSS JOIN point_location p
                    ORDER BY ST_Distance(p.geog, d.geometry::geography)
                    LIMIT 1
                )
                SELECT * FROM nearest_districts
            `, [parseFloat(lon), parseFloat(lat)]);

      if (nearestResult.rows.length > 0) {
        nearestDistrict = nearestResult.rows[0];
      }
    }

    // Find county information
    const countyResult = await pool.query(`
            SELECT 
                c.county_name,
                c.state_code,
                c.county_fips
            FROM counties c
            WHERE ST_Contains(c.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            LIMIT 1
        `, [parseFloat(lon), parseFloat(lat)]);

    // Prepare response
    const response = {
      location: { lat: parseFloat(lat), lon: parseFloat(lon) }
    };

    if (districtResult.rows.length > 0) {
      const district = districtResult.rows[0];
      response.district = {
        found: true,
        state: district.state_code,
        district: district.district_number.toString(),
        isAtLarge: district.is_at_large,
        distanceToBoundary: {
          meters: district.distance_to_boundary ? Math.round(district.distance_to_boundary) : 0,
          miles: district.distance_to_boundary ? Math.round(district.distance_to_boundary * 0.000621371 * 100) / 100 : 0
        },
        closestBoundaryPoint: district.closest_boundary_point,
        member: district.member_name
          ? {
            name: district.member_name,
            party: district.party,
            phone: district.phone,
            website: district.website,
            contactForm: district.contact_form_url,
            photo: district.photo_url,
            state: district.state_name,
            office: `${district.office_room || ''} ${district.office_building || ''}`.trim(),
            social: district.social_media
          }
          : null
      };
    } else {
      response.district = {
        found: false
      };

      if (nearestDistrict) {
        response.nearestDistrict = {
          state: nearestDistrict.state_code,
          district: nearestDistrict.district_number.toString(),
          isAtLarge: nearestDistrict.is_at_large,
          distance: {
            meters: Math.round(nearestDistrict.distance_to_district),
            miles: Math.round(nearestDistrict.distance_to_district * 0.000621371 * 100) / 100
          },
          closestPoint: nearestDistrict.closest_point,
          stateName: nearestDistrict.state_name,
          memberName: nearestDistrict.member_name,
          party: nearestDistrict.party
        };
      }
    }

    if (countyResult.rows.length > 0) {
      const county = countyResult.rows[0];
      response.county = {
        found: true,
        name: county.county_name,
        state: county.state_code,
        geoid: county.county_fips
      };
    } else {
      response.county = {
        found: false
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Find location error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Geocode addresses (same as original implementation)
router.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Congressional-Districts-Map/1.0'
      }
    });

    if (!response.ok) {
      throw new Error('Geocoding service error');
    }

    const results = await response.json();

    const formattedResults = results.map(result => ({
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      boundingbox: result.boundingbox,
      type: result.type,
      importance: result.importance
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Census Geocoder API endpoint with caching
router.get('/api/geocode-census', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }

    // Normalize address for cache key
    const normalizedAddress = address.toLowerCase().trim();

    // Check cache first
    const cacheResult = await pool.query(
      'SELECT results FROM geocode_cache WHERE address = $1 AND geocoder = $2 AND created_at > NOW() - INTERVAL \'7 days\'',
      [normalizedAddress, 'census']
    );

    if (cacheResult.rows.length > 0) {
      // Update accessed_at
      await pool.query(
        'UPDATE geocode_cache SET accessed_at = NOW() WHERE address = $1 AND geocoder = $2',
        [normalizedAddress, 'census']
      );
      return res.json(cacheResult.rows[0].results);
    }


    // Parse the address to extract components
    const addressParts = address.split(',').map(s => s.trim());
    let street = ''; let city = ''; let state = ''; let zip = '';

    if (addressParts.length === 1) {
      // Just a ZIP code or city/state
      const parts = addressParts[0].split(' ');
      if (/^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) {
        zip = parts[parts.length - 1];
      } else {
        city = addressParts[0];
      }
    } else if (addressParts.length === 2) {
      // Could be "City, State" or "Street, City State"
      const secondPart = addressParts[1].trim();
      const stateZipMatch = secondPart.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);

      if (stateZipMatch) {
        // Second part is "State ZIP" format
        city = addressParts[0];
        state = stateZipMatch[1];
        if (stateZipMatch[2]) zip = stateZipMatch[2];
      } else {
        // Assume it's "Street, City State"
        street = addressParts[0];
        const cityStateParts = secondPart.split(' ');
        if (cityStateParts.length >= 2) {
          city = cityStateParts.slice(0, -1).join(' ');
          state = cityStateParts[cityStateParts.length - 1];
        } else {
          city = secondPart;
        }
      }
    } else if (addressParts.length >= 3) {
      // Full address
      street = addressParts[0];
      city = addressParts[1];
      const stateZip = addressParts[2].split(' ');
      state = stateZip[0];
      if (stateZip[1]) zip = stateZip[1];
    }

    // Determine if we have enough information for Census API
    // Census API requires either:
    // 1. Street address with city/state or ZIP
    // 2. Just a ZIP code (for ZIP code centroid lookup)

    if (!street && !zip) {
      // Can't use Census API without street address or ZIP
      // Fall back to OSM Nominatim for city/state searches
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=5`;

      const osmResponse = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'Congressional-Districts-Map/1.0'
        }
      });

      if (!osmResponse.ok) {
        throw new Error('Geocoding service error');
      }

      const osmResults = await osmResponse.json();

      const formattedResults = osmResults.map(result => ({
        display_name: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        type: 'osm',
        importance: result.importance
      }));

      // Cache the results
      if (formattedResults.length > 0) {
        await pool.query(
          'INSERT INTO geocode_cache (address, geocoder, results) VALUES ($1, $2, $3) ON CONFLICT (address, geocoder) DO UPDATE SET results = $3, created_at = NOW(), accessed_at = NOW()',
          [normalizedAddress, 'census', JSON.stringify(formattedResults)]
        );
      }

      return res.json(formattedResults);
    }

    // Build Census Geocoder URL
    const params = new URLSearchParams({
      benchmark: 'Public_AR_Current',
      format: 'json'
    });

    if (street) params.append('street', street);
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    if (zip) params.append('zip', zip);

    const url = `https://geocoding.geo.census.gov/geocoder/locations/address?${params}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Congressional-Districts-Map/1.0'
      }
    });

    if (!response.ok) {
      console.error('Census API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Census API response:', errorText);

      // If Census API fails, fall back to OSM Nominatim
      console.log('Falling back to OSM Nominatim due to Census API error');
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=5`;

      const osmResponse = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'Congressional-Districts-Map/1.0'
        }
      });

      if (!osmResponse.ok) {
        throw new Error('Both geocoding services failed');
      }

      const osmResults = await osmResponse.json();

      const formattedResults = osmResults.map(result => ({
        display_name: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        type: 'osm',
        importance: result.importance
      }));

      // Cache the results
      if (formattedResults.length > 0) {
        await pool.query(
          'INSERT INTO geocode_cache (address, geocoder, results) VALUES ($1, $2, $3) ON CONFLICT (address, geocoder) DO UPDATE SET results = $3, created_at = NOW(), accessed_at = NOW()',
          [normalizedAddress, 'census', JSON.stringify(formattedResults)]
        );
      }

      return res.json(formattedResults);
    }

    const data = await response.json();

    // Format results to match our standard format
    const formattedResults = [];

    if (data.result && data.result.addressMatches && data.result.addressMatches.length > 0) {
      data.result.addressMatches.forEach(match => {
        formattedResults.push({
          display_name: match.matchedAddress,
          lat: parseFloat(match.coordinates.y),
          lon: parseFloat(match.coordinates.x),
          type: 'census',
          importance: 1.0,
          census_data: {
            tigerLineId: match.tigerLine?.tigerLineId,
            side: match.tigerLine?.side,
            geographies: match.geographies
          }
        });
      });
    }

    // Store in cache if we got results
    if (formattedResults.length > 0) {
      await pool.query(
        'INSERT INTO geocode_cache (address, geocoder, results) VALUES ($1, $2, $3) ON CONFLICT (address, geocoder) DO UPDATE SET results = $3, created_at = NOW(), accessed_at = NOW()',
        [normalizedAddress, 'census', JSON.stringify(formattedResults)]
      );
    }

    res.json(formattedResults);
  } catch (error) {
    console.error('Census geocoding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache status endpoint (simplified for DB version)
router.get('/api/cache-status', async (req, res) => {
  try {
    // Get accurate counts from database
    const memberCount = await pool.query('SELECT COUNT(*) FROM members');
    const districtCount = await pool.query('SELECT COUNT(*) FROM districts');
    const countyCount = await pool.query('SELECT COUNT(*) FROM counties');
    const committeeMemberCount = await pool.query('SELECT COUNT(*) FROM member_committees');

    // Get most recent sync information for accurate cache time
    const recentSync = await pool.query(`
      SELECT completed_at, sync_status 
      FROM sync_log 
      WHERE data_type = 'house_members' AND sync_status = 'completed'
      ORDER BY completed_at DESC 
      LIMIT 1
    `);

    // Get last House JSON cache entry
    const lastCache = await pool.query(`
      SELECT fetch_date, created_at
      FROM house_json_cache
      ORDER BY fetch_date DESC
      LIMIT 1
    `);

    // Determine actual last update time
    let lastUpdate = null;
    if (recentSync.rows.length > 0) {
      lastUpdate = recentSync.rows[0].completed_at;
    } else if (lastCache.rows.length > 0) {
      lastUpdate = lastCache.rows[0].created_at;
    }

    // Calculate accurate cache age
    let cacheAgeHours = 0;
    if (lastUpdate) {
      const ageMs = Date.now() - new Date(lastUpdate).getTime();
      cacheAgeHours = Math.floor(ageMs / (1000 * 60 * 60));
    }

    res.json({
      memberCount: parseInt(memberCount.rows[0].count),
      districtCount: parseInt(districtCount.rows[0].count),
      countyCount: parseInt(countyCount.rows[0].count),
      committeeMemberCount: parseInt(committeeMemberCount.rows[0].count),
      lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      cacheAgeHours,
      hasCachedData: parseInt(memberCount.rows[0].count) > 0,
      // Legacy format for backward compatibility
      members: {
        hasCachedData: parseInt(memberCount.rows[0].count) > 0,
        count: parseInt(memberCount.rows[0].count),
        cacheTime: lastUpdate ? lastUpdate.toISOString() : new Date().toISOString(),
        cacheAgeHours
      },
      districts: {
        hasCachedData: parseInt(districtCount.rows[0].count) > 0,
        count: parseInt(districtCount.rows[0].count)
      },
      counties: {
        hasCachedData: parseInt(countyCount.rows[0].count) > 0,
        count: parseInt(countyCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error checking cache status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detailed reporting endpoint for data management
router.get('/api/reporting/detailed-status', async (req, res) => {
  try {
    // Get comprehensive data counts
    const memberCount = await pool.query('SELECT COUNT(*) FROM members');
    const districtCount = await pool.query('SELECT COUNT(*) FROM districts');
    const countyCount = await pool.query('SELECT COUNT(*) FROM counties');
    const committeeMemberCount = await pool.query('SELECT COUNT(*) FROM member_committees');
    const subcommitteeMemberCount = await pool.query('SELECT COUNT(*) FROM member_subcommittees');

    // Get recent sync activity (last 10 imports)
    const recentSyncs = await pool.query(`
      SELECT data_type, sync_status, started_at, completed_at, records_processed, error_message
      FROM sync_log
      ORDER BY started_at DESC
      LIMIT 10
    `);

    // Get data quality metrics
    const membersWithBioguideId = await pool.query(`
      SELECT COUNT(*) FROM members WHERE bioguide_id IS NOT NULL AND bioguide_id != ''
    `);

    const membersWithCommittees = await pool.query(`
      SELECT COUNT(DISTINCT member_id) FROM member_committees
    `);

    // Get most recent House JSON cache
    const lastCache = await pool.query(`
      SELECT fetch_date, created_at
      FROM house_json_cache
      ORDER BY fetch_date DESC
      LIMIT 1
    `);

    res.json({
      timestamp: new Date().toISOString(),
      overview: {
        memberCount: parseInt(memberCount.rows[0].count),
        districtCount: parseInt(districtCount.rows[0].count),
        countyCount: parseInt(countyCount.rows[0].count),
        committeeMemberCount: parseInt(committeeMemberCount.rows[0].count),
        subcommitteeMemberCount: parseInt(subcommitteeMemberCount.rows[0].count)
      },
      dataQuality: {
        membersWithBioguideId: parseInt(membersWithBioguideId.rows[0].count),
        bioguideIdCoverage: memberCount.rows[0].count > 0
          ? Math.round((membersWithBioguideId.rows[0].count / memberCount.rows[0].count) * 100)
          : 0,
        membersWithCommittees: parseInt(membersWithCommittees.rows[0].count),
        committeeCoverage: memberCount.rows[0].count > 0
          ? Math.round((membersWithCommittees.rows[0].count / memberCount.rows[0].count) * 100)
          : 0
      },
      lastUpdate: {
        houseJsonCache: lastCache.rows.length > 0 ? lastCache.rows[0].created_at : null,
        fetchDate: lastCache.rows.length > 0 ? lastCache.rows[0].fetch_date : null
      },
      recentActivity: recentSyncs.rows.map(sync => ({
        dataType: sync.data_type,
        status: sync.sync_status,
        startedAt: sync.started_at,
        completedAt: sync.completed_at,
        recordsProcessed: sync.records_processed,
        errorMessage: sync.error_message,
        duration: sync.completed_at && sync.started_at
          ? Math.round((new Date(sync.completed_at) - new Date(sync.started_at)) / 1000)
          : null
      }))
    });
  } catch (error) {
    console.error('Error fetching detailed reporting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh members cache endpoint
router.post('/api/refresh-members-cache', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');

    // Trigger the import script to refresh House member data
    const importScript = path.join(__dirname, 'database', 'import-house-json.js');

    console.log('🔄 Manual cache refresh requested, triggering House data import...');

    // Run the import script asynchronously
    const importProcess = spawn('node', [importScript], {
      detached: true,
      stdio: 'ignore'
    });

    importProcess.unref();

    // Get current count for response
    const result = await pool.query('SELECT COUNT(*) FROM members');

    // Log the refresh request
    await pool.query(`
      INSERT INTO sync_log (data_type, sync_status, started_at)
      VALUES ('house_members_manual', 'requested', CURRENT_TIMESTAMP)
    `);

    res.json({
      success: true,
      message: 'House member data refresh initiated',
      memberCount: parseInt(result.rows[0].count),
      refreshTime: new Date().toISOString(),
      note: 'Import running in background - check status in a few minutes'
    });
  } catch (error) {
    console.error('Error triggering cache refresh:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// County boundaries endpoint
router.get('/api/counties/:stateCode', async (req, res) => {
  try {
    const { stateCode } = req.params;

    const result = await pool.query(`
            SELECT 
                county_fips as "GEOID",
                county_name as "NAME",
                state_code as "STUSPS",
                ST_AsGeoJSON(ST_Simplify(geometry, 0.01))::json as geometry
            FROM counties
            WHERE state_code = $1
        `, [stateCode]);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        GEOID: row.GEOID,
        NAME: row.NAME,
        STUSPS: row.STUSPS
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error fetching counties:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all county boundaries (simplified for performance)
router.get('/api/county-boundaries', async (req, res) => {
  try {
    // Get state filter from query params if provided
    const { states } = req.query;
    let whereClause = '';
    let params = [];

    if (states) {
      // Allow filtering by specific states for performance
      const stateList = states.split(',').map(s => s.trim().toUpperCase());
      whereClause = 'WHERE state_code = ANY($1)';
      params = [stateList];
    }

    const query = `
            SELECT 
                county_fips as "GEOID",
                county_name as "NAME",
                state_code as "STUSPS",
                ST_AsGeoJSON(ST_Simplify(geometry, 0.02))::json as geometry
            FROM counties
            ${whereClause}
            ORDER BY state_code, county_name
        `;

    const result = await pool.query(query, params);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        GEOID: row.GEOID,
        NAME: row.NAME,
        STUSPS: row.STUSPS
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error fetching all county boundaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
router.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// Configuration status endpoint
router.get('/api/config-status', async (req, res) => {
  try {
    // For now, return a basic config status
    // In a real implementation, this would check actual API configurations
    res.json({
      usps: {
        configured: false,
        tokenValid: false
      },
      smarty: {
        configured: false
      },
      defaultMethod: 'census'
    });
  } catch (error) {
    console.error('Error checking config status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save configuration endpoint (stub)
router.post('/api/save-config', async (req, res) => {
  try {
    // In a real implementation, this would save API credentials securely
    console.log('Config save requested (not implemented)');
    res.json({ success: true, message: 'Configuration saved (stub)' });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: error.message });
  }
});

// USPS auth endpoint (stub)
router.get('/api/usps-auth', async (req, res) => {
  try {
    // In a real implementation, this would initiate USPS OAuth
    res.json({
      authUrl: '#',
      message: 'USPS authentication not implemented'
    });
  } catch (error) {
    console.error('Error with USPS auth:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up old geocode cache entries
router.post('/api/cleanup-geocode-cache', async (req, res) => {
  try {
    // Delete entries older than 30 days that haven't been accessed in 14 days
    const result = await pool.query(
      'DELETE FROM geocode_cache WHERE created_at < NOW() - INTERVAL \'30 days\' OR accessed_at < NOW() - INTERVAL \'14 days\''
    );

    res.json({
      success: true,
      message: `Cleaned up ${result.rowCount} old cache entries`
    });
  } catch (error) {
    console.error('Error cleaning geocode cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// Address lookup endpoint for ZIP+4 and comparison methods
router.get('/api/address-lookup-zip4', async (req, res) => {
  try {
    const { street, city, state, zip, method } = req.query;

    if (!street || !city || !state) {
      return res.status(400).json({ error: 'Street, city, and state are required' });
    }

    // const address = { street, city, state, zip }; // Unused, using individual vars instead

    if (method === 'both') {
      // Compare both methods

      // Method 1: Census Geocoder
      let censusResult = { success: false };
      try {
        const addressStr = [street, city, state, zip].filter(Boolean).join(', ');
        const censusResponse = await fetch(`http://localhost:${PORT}/ssddmap/api/geocode-census?address=${encodeURIComponent(addressStr)}`);
        const censusGeocode = await censusResponse.json();

        if (censusGeocode && censusGeocode.length > 0) {
          const coords = censusGeocode[0];
          const locationResponse = await fetch(`http://localhost:${PORT}/ssddmap/api/find-location?lat=${coords.lat}&lon=${coords.lon}`);
          const locationData = await locationResponse.json();

          if (locationData.district && locationData.district.found) {
            censusResult = {
              success: true,
              district: locationData.district,
              county: locationData.county,
              location: locationData.location
            };
          }
        }
      } catch (error) {
        console.error('Census method error:', error);
      }

      // Method 2: Mock ZIP+4 result (would normally use USPS/Smarty)
      // In production, this would call the actual ZIP+4 lookup service
      const zip4Result = {
        success: false,
        error: 'ZIP+4 lookup requires USPS API configuration'
      };

      // Compare results
      const comparison = {
        match: false,
        confidence: 0
      };

      if (censusResult.success && zip4Result.success) {
        const match = censusResult.district.state === zip4Result.district.state &&
                             censusResult.district.district === zip4Result.district.district;
        comparison.match = match;
        comparison.confidence = match ? 100 : 50;
      } else if (censusResult.success || zip4Result.success) {
        comparison.confidence = 75;
      }

      res.json({
        censusMethod: censusResult,
        zip4Method: zip4Result,
        comparison
      });
    } else {
      // Single method lookup - for now just return error for non-census methods
      res.json({
        success: false,
        error: 'Only census method is currently implemented. Please select "Census Geocoder (Free)" option.'
      });
    }
  } catch (error) {
    console.error('Address lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Address Validation Endpoints

// Comprehensive address validation
router.post('/api/validate-address', async (req, res) => {
  try {
    const { address, methods } = req.body;

    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'Valid address is required' });
    }

    const trimmedAddress = address.trim();
    console.log('Validation request for:', trimmedAddress);

    // If specific methods requested, validate with only those
    if (methods && Array.isArray(methods) && methods.length > 0) {
      const results = await validationService.validateAddressWithMethods(trimmedAddress, methods);
      res.json(results);
    } else {
      // Otherwise use all available methods
      const results = await validationService.validateAddress(trimmedAddress);
      res.json(results);
    }
  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get USPS states list
router.get('/api/usps-states', async (req, res) => {
  try {
    // USPS accepts these state codes
    const uspsStates = [
      { code: 'AA', name: 'Armed Forces Americas' },
      { code: 'AE', name: 'Armed Forces Europe' },
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AP', name: 'Armed Forces Pacific' },
      { code: 'AS', name: 'American Samoa' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'DC', name: 'District of Columbia' },
      { code: 'FM', name: 'Federated States of Micronesia' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'GU', name: 'Guam' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MH', name: 'Marshall Islands' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MP', name: 'Northern Mariana Islands' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PW', name: 'Palau' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'PR', name: 'Puerto Rico' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VI', name: 'Virgin Islands' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' }
    ];

    res.json(uspsStates);
  } catch (error) {
    console.error('USPS states error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test USPS connection
router.get('/api/test-usps', async (req, res) => {
  try {
    const result = await validationService.testValidator('usps');
    res.json(result);
  } catch (error) {
    console.error('USPS test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get validation service configuration status
router.get('/api/validation-status', async (req, res) => {
  try {
    const status = validationService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Distance to boundary calculation
router.get('/api/distance-to-boundary', async (req, res) => {
  try {
    const { lat, lon, state, district } = req.query;

    if (!lat || !lon || !state || !district) {
      return res.status(400).json({ error: 'lat, lon, state, and district are required' });
    }

    const distance = await validationService.getDistanceToBoundary(
      parseFloat(lat),
      parseFloat(lon),
      state,
      district
    );

    res.json(distance);
  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get closest point on district boundary
router.post('/api/closest-boundary-point', async (req, res) => {
  try {
    const { lat, lon, state, district } = req.body;

    if (!lat || !lon || !state || !district) {
      return res.status(400).json({ error: 'lat, lon, state, and district are required' });
    }

    // Query to find the closest point on the district boundary
    const result = await pool.query(`
            WITH point_location AS (
                SELECT 
                    ST_SetSRID(ST_MakePoint($2, $1), 4326) as geom,
                    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography as geog
            )
            SELECT 
                ST_X(ST_ClosestPoint(ST_Boundary(d.geometry), p.geom)) as lon,
                ST_Y(ST_ClosestPoint(ST_Boundary(d.geometry), p.geom)) as lat,
                ST_Distance(p.geog, ST_Boundary(d.geometry)::geography) as distance_meters,
                ST_Distance(p.geog, ST_Boundary(d.geometry)::geography) * 0.000621371 as distance_miles,
                ST_Distance(p.geog, ST_Boundary(d.geometry)::geography) * 3.28084 as distance_feet,
                ST_Distance(p.geog, ST_Boundary(d.geometry)::geography) / 1000 as distance_kilometers
            FROM districts d
            CROSS JOIN point_location p
            WHERE d.state_code = $3 
            AND d.district_number = $4
        `, [lat, lon, state, parseInt(district)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'District not found' });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      closestPoint: {
        lat: row.lat,
        lon: row.lon
      },
      distance: {
        meters: row.distance_meters,
        kilometers: row.distance_kilometers,
        miles: row.distance_miles,
        feet: row.distance_feet
      }
    });
  } catch (error) {
    console.error('Closest boundary point error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configuration status endpoint
router.get('/api/config/status', async (req, res) => {
  try {
    const status = {
      census: {
        configured: true,
        active: true
      },
      usps: {
        configured: uspsService.isConfigured(),
        tokenValid: uspsService.isTokenValid()
      },
      google: {
        configured: !!(process.env.GOOGLE_MAPS_API_KEY)
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Config status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save USPS configuration
router.post('/api/config/usps', async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and Secret are required' });
    }

    // Update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or add USPS credentials
    envContent = envContent.replace(/USPS_CLIENT_ID=.*/g, `USPS_CLIENT_ID=${clientId}`);
    envContent = envContent.replace(/USPS_CLIENT_SECRET=.*/g, `USPS_CLIENT_SECRET=${clientSecret}`);

    fs.writeFileSync(envPath, envContent);

    // Restart the application
    exec('pm2 restart ssddmap', (error, stdout, stderr) => {
      if (error) {
        console.error('PM2 restart error:', error);
        return res.status(500).json({ error: 'Failed to restart application' });
      }
      res.json({ success: true, message: 'Configuration saved and application restarted' });
    });
  } catch (error) {
    console.error('USPS config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test USPS configuration
router.post('/api/test/usps', async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and Secret are required' });
    }

    // Create temporary service instance with provided credentials
    const testService = new USPSOAuthService();
    testService.clientId = clientId;
    testService.clientSecret = clientSecret;

    // Test connection
    const result = await testService.testConnection();

    res.json(result);
  } catch (error) {
    console.error('USPS test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save Google configuration
router.post('/api/config/google', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' });
    }

    // Update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or add Google API key
    envContent = envContent.replace(/GOOGLE_MAPS_API_KEY=.*/g, `GOOGLE_MAPS_API_KEY=${apiKey}`);

    fs.writeFileSync(envPath, envContent);

    // Restart the application
    exec('pm2 restart ssddmap', (error, stdout, stderr) => {
      if (error) {
        console.error('PM2 restart error:', error);
        return res.status(500).json({ error: 'Failed to restart application' });
      }
      res.json({ success: true, message: 'Configuration saved and application restarted' });
    });
  } catch (error) {
    console.error('Google config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test Google configuration
router.post('/api/test/google', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' });
    }

    // Test with a simple geocoding request
    const testAddress = '1600 Pennsylvania Ave, Washington, DC';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK') {
      res.json({ success: true, message: 'Google Maps API is working correctly' });
    } else {
      res.json({ success: false, error: data.error_message || data.status });
    }
  } catch (error) {
    console.error('Google test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mount router at /ssddmap
app.use('/ssddmap', router);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Using PostgreSQL database for optimized performance');
});
