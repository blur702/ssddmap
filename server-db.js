const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const turf = require('@turf/turf');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ssddmap',
    user: process.env.DB_USER || 'ssddmap_user',
    password: process.env.DB_PASSWORD
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected:', res.rows[0].now);
    }
});

app.use(express.static('public'));
app.use(express.json());

// Get all available states
app.get('/api/states', async (req, res) => {
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
app.get('/api/state-rep-counts', async (req, res) => {
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
app.get('/api/state/:stateCode', async (req, res) => {
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
app.get('/api/district/:stateCode/:districtNumber', async (req, res) => {
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
app.get('/api/all-districts', async (req, res) => {
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
            features: features
        });
    } catch (error) {
        console.error('Error fetching all districts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all House members
app.get('/api/members', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                CONCAT(m.state_code, '-', m.district_number) as key,
                m.full_name as name,
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
        `);
        
        // Convert to object keyed by state-district
        const members = {};
        result.rows.forEach(row => {
            members[row.key] = {
                name: row.name,
                party: row.party,
                phone: row.phone,
                website: row.website,
                contactForm: row.contactform,
                photo: row.photo,
                state: row.state,
                district: row.district,
                office: row.office,
                social: row.social
            };
        });
        
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get member by state and district
app.get('/api/member/:stateCode/:districtNumber', async (req, res) => {
    try {
        const { stateCode, districtNumber } = req.params;
        
        const result = await pool.query(`
            SELECT 
                m.full_name as name,
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
app.get('/api/find-district', async (req, res) => {
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

// Geocode addresses (same as original implementation)
app.get('/api/geocode', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address) {
            return res.status(400).json({ error: 'Address parameter is required' });
        }
        
        const fetch = require('node-fetch');
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

// Cache status endpoint (simplified for DB version)
app.get('/api/cache-status', async (req, res) => {
    try {
        const memberCount = await pool.query('SELECT COUNT(*) FROM members');
        const districtCount = await pool.query('SELECT COUNT(*) FROM districts');
        const countyCount = await pool.query('SELECT COUNT(*) FROM counties');
        
        res.json({
            members: {
                hasCachedData: true,
                count: parseInt(memberCount.rows[0].count),
                cacheTime: new Date().toISOString(),
                cacheAgeHours: 0
            },
            districts: {
                hasCachedData: true,
                count: parseInt(districtCount.rows[0].count)
            },
            counties: {
                hasCachedData: true,
                count: parseInt(countyCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error checking cache status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refresh members cache endpoint
app.post('/api/refresh-members-cache', async (req, res) => {
    try {
        // In the DB version, this would trigger a re-import from the house.gov API
        // For now, just return success
        const result = await pool.query('SELECT COUNT(*) FROM members');
        
        res.json({ 
            success: true, 
            message: 'Database contains current member data',
            memberCount: parseInt(result.rows[0].count),
            cacheTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error refreshing cache:', error);
        res.status(500).json({ error: error.message });
    }
});

// County boundaries endpoint
app.get('/api/counties/:stateCode', async (req, res) => {
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
            features: features
        });
    } catch (error) {
        console.error('Error fetching counties:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Using PostgreSQL database for optimized performance');
});