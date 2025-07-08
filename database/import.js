const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const tj = require('@mapbox/togeojson');
const { DOMParser } = require('xmldom');
const turf = require('@turf/turf');
const wellknown = require('wellknown');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ssddmap',
    user: process.env.DB_USER || 'ssddmap_user',
    password: process.env.DB_PASSWORD || 'your_password_here'
});

// At-large states
const AT_LARGE_STATES = ['AK', 'DE', 'ND', 'SD', 'VT', 'WY'];

// State names mapping
const STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'VI': 'Virgin Islands', 'GU': 'Guam',
    'AS': 'American Samoa', 'MP': 'Northern Mariana Islands'
};

// Import states
async function importStates() {
    console.log('Importing states...');
    const basePath = path.join(__dirname, '..');
    const files = await fs.readdir(basePath);
    const kmlFiles = files.filter(f => f.endsWith('.kml') && !f.includes('cb_'));
    
    // Extract unique states from KML files
    const statesFromFiles = [...new Set(kmlFiles.map(f => f.split('-')[0]))];
    const allStates = [...new Set([...statesFromFiles, ...AT_LARGE_STATES])];
    
    // Count representatives per state
    const repCounts = {};
    kmlFiles.forEach(file => {
        const [state] = file.replace('.kml', '').split('-');
        repCounts[state] = (repCounts[state] || 0) + 1;
    });
    
    // Add at-large states
    AT_LARGE_STATES.forEach(state => {
        if (!repCounts[state]) repCounts[state] = 1;
    });
    
    // Import states
    for (const stateCode of allStates) {
        try {
            await pool.query(`
                INSERT INTO states (state_code, state_name, is_at_large, representative_count)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (state_code) DO UPDATE
                SET state_name = EXCLUDED.state_name,
                    is_at_large = EXCLUDED.is_at_large,
                    representative_count = EXCLUDED.representative_count,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                stateCode,
                STATE_NAMES[stateCode] || stateCode,
                AT_LARGE_STATES.includes(stateCode),
                repCounts[stateCode] || 1
            ]);
        } catch (error) {
            console.error(`Error importing state ${stateCode}:`, error);
        }
    }
    
    console.log(`Imported ${allStates.length} states`);
}

// Import districts
async function importDistricts() {
    console.log('Importing districts...');
    const basePath = path.join(__dirname, '..');
    const files = await fs.readdir(basePath);
    const kmlFiles = files.filter(f => f.endsWith('.kml') && !f.includes('cb_'));
    
    let imported = 0;
    
    for (const file of kmlFiles) {
        try {
            const [stateCode, districtNum] = file.replace('.kml', '').split('-');
            const kmlData = await fs.readFile(path.join(basePath, file), 'utf8');
            const dom = new DOMParser().parseFromString(kmlData);
            const geojson = tj.kml(dom);
            
            if (geojson.features && geojson.features.length > 0) {
                // Combine all features into a single MultiPolygon
                let geometry;
                
                if (geojson.features.length === 1) {
                    geometry = geojson.features[0].geometry;
                } else {
                    // Combine multiple features
                    const polygons = [];
                    geojson.features.forEach(feature => {
                        if (feature.geometry.type === 'Polygon') {
                            polygons.push(feature.geometry.coordinates);
                        } else if (feature.geometry.type === 'MultiPolygon') {
                            polygons.push(...feature.geometry.coordinates);
                        }
                    });
                    geometry = {
                        type: 'MultiPolygon',
                        coordinates: polygons
                    };
                }
                
                // Convert to 2D geometry (remove Z coordinates if present)
                const geometry2D = turf.truncate(geometry, {coordinates: 2});
                
                // Convert to WKT for PostGIS
                const wkt = wellknown.stringify(geometry2D);
                
                await pool.query(`
                    INSERT INTO districts (state_code, district_number, is_at_large, geometry)
                    VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
                    ON CONFLICT (state_code, district_number) DO UPDATE
                    SET geometry = ST_GeomFromText($4, 4326),
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    stateCode,
                    parseInt(districtNum),
                    districtNum === '0',
                    wkt
                ]);
                
                imported++;
            }
        } catch (error) {
            console.error(`Error importing district ${file}:`, error);
        }
    }
    
    console.log(`Imported ${imported} districts`);
}

// Import House members
async function importMembers() {
    console.log('Importing House members...');
    
    try {
        const response = await fetch('https://member-info.house.gov/members.xml');
        const xmlData = await response.text();
        
        const parser = new xml2js.Parser({ 
            explicitArray: false, 
            mergeAttrs: true,
            normalizeTags: true 
        });
        
        const result = await parser.parseStringPromise(xmlData);
        
        if (result.members && result.members.member) {
            const members = Array.isArray(result.members.member) ? 
                result.members.member : [result.members.member];
            
            let imported = 0;
            
            for (const member of members) {
                if (member.office_id && member.vacant !== 'Y') {
                    try {
                        const stateCode = member.office_id.substring(0, 2);
                        const districtNum = parseInt(member.office_id.substring(2));
                        const fullName = `${member.prefix || ''} ${member.firstname} ${member.middlename || ''} ${member.lastname} ${member.suffix || ''}`.trim();
                        
                        // Insert member
                        const memberResult = await pool.query(`
                            INSERT INTO members (
                                state_code, district_number, office_id, first_name, 
                                middle_name, last_name, suffix, full_name, party, 
                                phone, website, contact_form_url, photo_url,
                                office_room, office_building
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                            ON CONFLICT (office_id) DO UPDATE
                            SET first_name = EXCLUDED.first_name,
                                middle_name = EXCLUDED.middle_name,
                                last_name = EXCLUDED.last_name,
                                suffix = EXCLUDED.suffix,
                                full_name = EXCLUDED.full_name,
                                party = EXCLUDED.party,
                                phone = EXCLUDED.phone,
                                website = EXCLUDED.website,
                                contact_form_url = EXCLUDED.contact_form_url,
                                photo_url = EXCLUDED.photo_url,
                                office_room = EXCLUDED.office_room,
                                office_building = EXCLUDED.office_building,
                                updated_at = CURRENT_TIMESTAMP
                            RETURNING id
                        `, [
                            stateCode,
                            districtNum,
                            member.office_id,
                            member.firstname,
                            member.middlename || null,
                            member.lastname,
                            member.suffix || null,
                            fullName,
                            member.party,
                            member.phone ? `(202) 225-${member.phone}` : null,
                            member.websiteURL,
                            member.contactformURL,
                            member.photoURL,
                            member.room_num,
                            member.hob
                        ]);
                        
                        const memberId = memberResult.rows[0].id;
                        
                        // Insert social media
                        const socialPlatforms = [
                            { platform: 'facebook', url: member.face_book_URL },
                            { platform: 'twitter', url: member.twitter_URL },
                            { platform: 'youtube', url: member.youtube_URL },
                            { platform: 'instagram', url: member.instagram_URL }
                        ];
                        
                        for (const social of socialPlatforms) {
                            if (social.url) {
                                await pool.query(`
                                    INSERT INTO member_social_media (member_id, platform, url)
                                    VALUES ($1, $2, $3)
                                    ON CONFLICT (member_id, platform) DO UPDATE
                                    SET url = EXCLUDED.url
                                `, [memberId, social.platform, social.url]);
                            }
                        }
                        
                        imported++;
                    } catch (error) {
                        console.error(`Error importing member ${member.office_id}:`, error);
                    }
                }
            }
            
            console.log(`Imported ${imported} members`);
        }
    } catch (error) {
        console.error('Error fetching House members:', error);
    }
}

// Import counties
async function importCounties() {
    console.log('Importing counties...');
    
    try {
        const countyKmlPath = path.join(__dirname, '..', 'counties', 'cb_2020_us_county_500k.kml');
        const kmlData = await fs.readFile(countyKmlPath, 'utf8');
        const dom = new DOMParser().parseFromString(kmlData);
        const geojson = tj.kml(dom);
        
        if (geojson.features) {
            let imported = 0;
            
            for (const feature of geojson.features) {
                try {
                    const props = feature.properties;
                    const statefp = props.STATEFP;
                    const countyfp = props.COUNTYFP;
                    const countyFips = statefp + countyfp;
                    const countyName = props.NAME;
                    const stateCode = props.STUSPS;
                    
                    if (stateCode && countyName && feature.geometry) {
                        // Convert to 2D geometry (remove Z coordinates if present)
                        const geometry2D = turf.truncate(feature.geometry, {coordinates: 2});
                        const wkt = wellknown.stringify(geometry2D);
                        
                        await pool.query(`
                            INSERT INTO counties (state_code, county_fips, county_name, geometry)
                            VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))
                            ON CONFLICT (county_fips) DO UPDATE
                            SET county_name = EXCLUDED.county_name,
                                geometry = ST_GeomFromText($4, 4326),
                                updated_at = CURRENT_TIMESTAMP
                        `, [stateCode, countyFips, countyName, wkt]);
                        
                        imported++;
                    }
                } catch (error) {
                    console.error('Error importing county:', error);
                }
            }
            
            console.log(`Imported ${imported} counties`);
        }
    } catch (error) {
        console.error('Error importing counties:', error);
    }
}

// Calculate county-district relationships
async function calculateCountyDistrictMapping() {
    console.log('Calculating county-district overlaps...');
    
    try {
        // This query calculates the intersection of counties and districts
        const result = await pool.query(`
            INSERT INTO county_district_mapping (county_fips, state_code, district_number, overlap_percentage)
            SELECT 
                c.county_fips,
                d.state_code,
                d.district_number,
                ROUND((ST_Area(ST_Intersection(c.geometry, d.geometry)::geography) / 
                       ST_Area(c.geometry::geography)) * 100, 2) as overlap_percentage
            FROM counties c
            JOIN districts d ON ST_Intersects(c.geometry, d.geometry)
            WHERE c.state_code = d.state_code
            ON CONFLICT (county_fips, state_code, district_number) DO UPDATE
            SET overlap_percentage = EXCLUDED.overlap_percentage
        `);
        
        console.log(`Calculated ${result.rowCount} county-district relationships`);
    } catch (error) {
        console.error('Error calculating county-district mapping:', error);
    }
}

// Main import function
async function importAll() {
    const client = await pool.connect();
    
    try {
        console.log('Starting data import...');
        
        // Log sync start
        await client.query(`
            INSERT INTO sync_log (data_type, sync_status, started_at)
            VALUES ('full_import', 'running', CURRENT_TIMESTAMP)
            RETURNING id
        `);
        
        // Import in order
        await importStates();
        await importDistricts();
        await importMembers();
        await importCounties();
        await calculateCountyDistrictMapping();
        
        // Log sync completion
        await client.query(`
            UPDATE sync_log 
            SET sync_status = 'completed', 
                completed_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT MAX(id) FROM sync_log WHERE data_type = 'full_import')
        `);
        
        console.log('Data import completed successfully!');
    } catch (error) {
        console.error('Import failed:', error);
        
        // Log sync failure
        await client.query(`
            UPDATE sync_log 
            SET sync_status = 'failed', 
                completed_at = CURRENT_TIMESTAMP,
                error_message = $1
            WHERE id = (SELECT MAX(id) FROM sync_log WHERE data_type = 'full_import')
        `, [error.message]);
        
        throw error;
    } finally {
        client.release();
    }
}

// Run import if this file is executed directly
if (require.main === module) {
    importAll()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Import failed:', error);
            process.exit(1);
        });
}

module.exports = { importAll, importStates, importDistricts, importMembers, importCounties };