const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const tj = require('@mapbox/togeojson');
const { DOMParser } = require('xmldom');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const turf = require('@turf/turf');
const STATE_BOUNDARIES = require('./stateData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Cache for House member data
let membersCache = null;
let membersCacheTime = null;
const CACHE_DURATION = 3600000; // 1 hour

// Function to fetch and parse House members data
async function fetchHouseMembers() {
    // Check cache
    if (membersCache && membersCacheTime && (Date.now() - membersCacheTime < CACHE_DURATION)) {
        return membersCache;
    }

    try {
        const response = await fetch('https://member-info.house.gov/members.xml');
        const xmlData = await response.text();
        
        const parser = new xml2js.Parser({ 
            explicitArray: false, 
            mergeAttrs: true,
            normalizeTags: true 
        });
        
        const result = await parser.parseStringPromise(xmlData);
        
        // Create a map by office_id for quick lookup
        const membersMap = {};
        
        if (result.members && result.members.member) {
            const members = Array.isArray(result.members.member) ? 
                result.members.member : [result.members.member];
            
            members.forEach(member => {
                if (member.office_id && member.vacant !== 'Y') {
                    // Extract state code and district number
                    const stateCode = member.office_id.substring(0, 2);
                    const districtNum = member.office_id.substring(2);
                    
                    membersMap[`${stateCode}-${parseInt(districtNum)}`] = {
                        name: `${member.prefix || ''} ${member.firstname} ${member.middlename || ''} ${member.lastname} ${member.suffix || ''}`.trim(),
                        party: member.party,
                        phone: member.phone ? `(202) 225-${member.phone}` : '',
                        website: member.websiteurl,
                        contactForm: member.contactformurl,
                        photo: member.photourl,
                        state: member.state,
                        district: parseInt(districtNum),
                        office: `${member.room_num} ${member.hob}`,
                        social: {
                            facebook: member.face_book_url,
                            twitter: member.twitter_url,
                            youtube: member.youtube_url,
                            instagram: member.instagram_url
                        },
                        committees: member.committee_assignments?.assignment || []
                    };
                }
            });
        }
        
        membersCache = membersMap;
        membersCacheTime = Date.now();
        return membersMap;
        
    } catch (error) {
        console.error('Error fetching House members:', error);
        return membersCache || {}; // Return cached data if available
    }
}

// At-large states (states with only one representative)
const AT_LARGE_STATES = ['AK', 'DE', 'ND', 'SD', 'VT', 'WY'];

// Endpoint to get all available states
app.get('/api/states', async (req, res) => {
    try {
        const files = await fs.readdir(__dirname);
        const kmlFiles = files.filter(f => f.endsWith('.kml'));
        
        // Extract unique state codes
        const statesFromFiles = [...new Set(kmlFiles.map(f => f.split('-')[0]))];
        
        // Combine with at-large states
        const allStates = [...new Set([...statesFromFiles, ...AT_LARGE_STATES])].sort();
        
        res.json(allStates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get representative count per state
app.get('/api/state-rep-counts', async (req, res) => {
    try {
        const files = await fs.readdir(__dirname);
        const kmlFiles = files.filter(f => f.endsWith('.kml') && !f.includes('cb_2020'));
        
        // Count districts per state
        const stateCounts = {};
        
        kmlFiles.forEach(file => {
            const [state, district] = file.replace('.kml', '').split('-');
            if (!stateCounts[state]) {
                stateCounts[state] = 0;
            }
            stateCounts[state]++;
        });
        
        // Add at-large states with 1 representative each
        AT_LARGE_STATES.forEach(state => {
            if (!stateCounts[state]) {
                stateCounts[state] = 1;
            }
        });
        
        res.json(stateCounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get districts for a specific state
app.get('/api/state/:stateCode', async (req, res) => {
    try {
        const { stateCode } = req.params;
        
        // Check if this is an at-large state
        if (AT_LARGE_STATES.includes(stateCode)) {
            // Fetch member data
            const members = await fetchHouseMembers();
            const memberKey = `${stateCode}-0`; // At-large districts use "0"
            
            return res.json([{
                state: stateCode,
                district: '0',
                filename: null,
                isAtLarge: true,
                member: members[memberKey] || null
            }]);
        }
        
        const files = await fs.readdir(__dirname);
        const stateFiles = files.filter(f => f.startsWith(`${stateCode}-`) && f.endsWith('.kml'));
        
        // Fetch member data
        const members = await fetchHouseMembers();
        
        const districts = [];
        
        for (const file of stateFiles) {
            const districtNumber = file.replace(`${stateCode}-`, '').replace('.kml', '');
            const memberKey = `${stateCode}-${parseInt(districtNumber)}`;
            
            districts.push({
                state: stateCode,
                district: districtNumber,
                filename: file,
                isAtLarge: false,
                member: members[memberKey] || null
            });
        }
        
        res.json(districts.sort((a, b) => parseInt(a.district) - parseInt(b.district)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get GeoJSON for a specific district
app.get('/api/district/:stateCode/:districtNumber', async (req, res) => {
    try {
        const { stateCode, districtNumber } = req.params;
        
        // Check if this is an at-large state
        if (AT_LARGE_STATES.includes(stateCode) && districtNumber === '0') {
            // Try to load the actual KML file first
            const atLargeFilename = `${stateCode}-0.kml`;
            const atLargeFilepath = path.join(__dirname, atLargeFilename);
            
            try {
                const kmlData = await fs.readFile(atLargeFilepath, 'utf8');
                const dom = new DOMParser().parseFromString(kmlData);
                const geojson = tj.kml(dom);
                
                // Fetch member data
                const members = await fetchHouseMembers();
                const memberKey = `${stateCode}-0`;
                
                return res.json({
                    state: stateCode,
                    district: '0',
                    isAtLarge: true,
                    geojson: geojson,
                    member: members[memberKey] || null
                });
            } catch (fileError) {
                // Fall back to placeholder boundary if KML not found
                const stateBoundary = STATE_BOUNDARIES[stateCode];
                if (!stateBoundary) {
                    return res.status(404).json({ error: 'State boundary not found' });
                }
                
                // Fetch member data
                const members = await fetchHouseMembers();
                const memberKey = `${stateCode}-0`;
                
                return res.json({
                    state: stateCode,
                    district: '0',
                    isAtLarge: true,
                    geojson: {
                        type: 'FeatureCollection',
                        features: [stateBoundary]
                    },
                    member: members[memberKey] || null
                });
            }
        }
        
        const filename = `${stateCode}-${districtNumber}.kml`;
        const filepath = path.join(__dirname, filename);
        
        const kmlData = await fs.readFile(filepath, 'utf8');
        const dom = new DOMParser().parseFromString(kmlData);
        const geojson = tj.kml(dom);
        
        // Fetch member data
        const members = await fetchHouseMembers();
        const memberKey = `${stateCode}-${parseInt(districtNumber)}`;
        
        res.json({
            state: stateCode,
            district: districtNumber,
            isAtLarge: false,
            geojson: geojson,
            member: members[memberKey] || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get all districts as GeoJSON (simplified for performance)
app.get('/api/all-districts', async (req, res) => {
    try {
        const files = await fs.readdir(__dirname);
        const kmlFiles = files.filter(f => f.endsWith('.kml'));
        
        const features = [];
        
        // Add at-large states first
        for (const stateCode of AT_LARGE_STATES) {
            // Try to load actual KML file
            const atLargeFilename = `${stateCode}-0.kml`;
            const atLargeFilepath = path.join(__dirname, atLargeFilename);
            
            try {
                const kmlData = await fs.readFile(atLargeFilepath, 'utf8');
                const dom = new DOMParser().parseFromString(kmlData);
                const geojson = tj.kml(dom);
                
                if (geojson.features) {
                    geojson.features.forEach(feature => {
                        feature.properties = {
                            ...feature.properties,
                            state: stateCode,
                            district: '0',
                            id: `${stateCode}-0`,
                            isAtLarge: true
                        };
                        features.push(feature);
                    });
                }
            } catch (err) {
                // Fall back to placeholder if KML not found
                const stateBoundary = STATE_BOUNDARIES[stateCode];
                if (stateBoundary) {
                    const feature = {
                        ...stateBoundary,
                        properties: {
                            ...stateBoundary.properties,
                            state: stateCode,
                            district: '0',
                            id: `${stateCode}-0`,
                            isAtLarge: true
                        }
                    };
                    features.push(feature);
                }
            }
        }
        
        // Process files in batches to avoid memory issues
        const batchSize = 10;
        for (let i = 0; i < kmlFiles.length; i += batchSize) {
            const batch = kmlFiles.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (file) => {
                try {
                    const [state, district] = file.replace('.kml', '').split('-');
                    const filepath = path.join(__dirname, file);
                    const kmlData = await fs.readFile(filepath, 'utf8');
                    const dom = new DOMParser().parseFromString(kmlData);
                    const geojson = tj.kml(dom);
                    
                    if (geojson.features) {
                        geojson.features.forEach(feature => {
                            feature.properties = {
                                ...feature.properties,
                                state: state,
                                district: district,
                                id: `${state}-${district}`,
                                isAtLarge: false
                            };
                            features.push(feature);
                        });
                    }
                } catch (err) {
                    console.error(`Error processing ${file}:`, err.message);
                }
            }));
        }
        
        res.json({
            type: 'FeatureCollection',
            features: features
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get all House members
app.get('/api/members', async (req, res) => {
    try {
        const members = await fetchHouseMembers();
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get member by state and district
app.get('/api/member/:stateCode/:districtNumber', async (req, res) => {
    try {
        const { stateCode, districtNumber } = req.params;
        const members = await fetchHouseMembers();
        const memberKey = `${stateCode}-${parseInt(districtNumber)}`;
        
        const member = members[memberKey];
        if (member) {
            res.json(member);
        } else {
            res.status(404).json({ error: 'Member not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to geocode addresses using Nominatim (OpenStreetMap)
app.get('/api/geocode', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address) {
            return res.status(400).json({ error: 'Address parameter is required' });
        }
        
        // Use Nominatim API (free OpenStreetMap geocoder)
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
        
        // Format results for our application
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
        res.status(500).json({ error: error.message });
    }
});

// Cache for district geometries
let districtGeometryCache = null;

// Cache for county data
let countyDataCache = null;
let countyGeometryCache = null;

// Load all district geometries into memory for faster lookup
async function loadDistrictGeometries() {
    if (districtGeometryCache) return districtGeometryCache;
    
    console.log('Loading district geometries into cache...');
    const districts = [];
    
    try {
        const files = await fs.readdir(__dirname);
        const kmlFiles = files.filter(f => f.endsWith('.kml') && !f.includes('cb_2022'));
        
        for (const file of kmlFiles) {
            try {
                const kmlData = await fs.readFile(path.join(__dirname, file), 'utf8');
                const dom = new DOMParser().parseFromString(kmlData);
                const geojson = tj.kml(dom);
                
                if (geojson.features) {
                    const [state, district] = file.replace('.kml', '').split('-');
                    
                    // Store each feature with metadata
                    geojson.features.forEach(feature => {
                        if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                            districts.push({
                                state,
                                district,
                                filename: file,
                                isAtLarge: district === '0',
                                geometry: feature.geometry
                            });
                        }
                    });
                }
            } catch (err) {
                console.error(`Error loading ${file}:`, err.message);
            }
        }
        
        districtGeometryCache = districts;
        console.log(`Loaded ${districts.length} district geometries`);
        return districts;
    } catch (error) {
        console.error('Error loading district geometries:', error);
        return [];
    }
}

// Endpoint to find which district contains a point
app.get('/api/find-district', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        const point = turf.point([parseFloat(lon), parseFloat(lat)]);
        
        // Load district geometries
        const districts = await loadDistrictGeometries();
        
        // Check each district
        for (const district of districts) {
            try {
                const polygon = district.geometry;
                const isInside = turf.booleanPointInPolygon(point, polygon);
                
                if (isInside) {
                    // Get member info
                    const members = await fetchHouseMembers();
                    const memberKey = `${district.state}-${parseInt(district.district)}`;
                    const member = members[memberKey];
                    
                    return res.json({
                        found: true,
                        state: district.state,
                        district: district.district,
                        filename: district.filename,
                        isAtLarge: district.isAtLarge,
                        member: member || null
                    });
                }
            } catch (err) {
                console.error(`Error checking district ${district.state}-${district.district}:`, err.message);
            }
        }
        
        // Not found in any district
        res.json({
            found: false,
            message: 'Location not found in any congressional district',
            point: { lat, lon }
        });
        
    } catch (error) {
        console.error('Find district error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Load county data from KML file
async function loadCountyData() {
    if (countyDataCache) return countyDataCache;
    
    console.log('Loading county data...');
    try {
        const countyKmlPath = path.join(__dirname, 'counties', 'cb_2020_us_county_500k.kml');
        const kmlData = await fs.readFile(countyKmlPath, 'utf8');
        const dom = new DOMParser().parseFromString(kmlData);
        const geojson = tj.kml(dom);
        
        const counties = [];
        const geometries = [];
        
        if (geojson.features) {
            geojson.features.forEach(feature => {
                if (feature.properties && feature.geometry) {
                    const county = {
                        statefp: feature.properties.STATEFP,
                        countyfp: feature.properties.COUNTYFP,
                        geoid: feature.properties.GEOID,
                        name: feature.properties.NAME,
                        nameLSAD: feature.properties.NAMELSAD,
                        stateName: feature.properties.STATE_NAME,
                        stateAbbr: feature.properties.STUSPS
                    };
                    counties.push(county);
                    
                    geometries.push({
                        ...county,
                        geometry: feature.geometry
                    });
                }
            });
        }
        
        countyDataCache = counties;
        countyGeometryCache = geometries;
        console.log(`Loaded ${counties.length} counties`);
        return counties;
    } catch (error) {
        console.error('Error loading county data:', error);
        return [];
    }
}

// Endpoint to get all counties
app.get('/api/counties', async (req, res) => {
    try {
        const counties = await loadCountyData();
        res.json(counties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get counties for a specific state
app.get('/api/counties/:stateCode', async (req, res) => {
    try {
        const { stateCode } = req.params;
        const counties = await loadCountyData();
        
        const stateCounties = counties.filter(county => 
            county.stateAbbr === stateCode || county.statefp === stateCode
        );
        
        res.json(stateCounties.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get county boundaries as GeoJSON
app.get('/api/county-boundaries', async (req, res) => {
    try {
        await loadCountyData(); // Ensure data is loaded
        
        if (!countyGeometryCache) {
            return res.status(500).json({ error: 'County data not loaded' });
        }
        
        // Return simplified GeoJSON for all counties
        const features = countyGeometryCache.map(county => ({
            type: 'Feature',
            properties: {
                geoid: county.geoid,
                name: county.name,
                state: county.stateAbbr
            },
            geometry: county.geometry
        }));
        
        res.json({
            type: 'FeatureCollection',
            features: features
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update find-district endpoint to also find county
app.get('/api/find-location', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        const point = turf.point([parseFloat(lon), parseFloat(lat)]);
        
        // Find district
        const districts = await loadDistrictGeometries();
        let foundDistrict = null;
        
        for (const district of districts) {
            try {
                const isInside = turf.booleanPointInPolygon(point, district.geometry);
                if (isInside) {
                    foundDistrict = district;
                    break;
                }
            } catch (err) {
                // Continue checking other districts
            }
        }
        
        // Find county
        await loadCountyData();
        let foundCounty = null;
        
        if (countyGeometryCache) {
            for (const county of countyGeometryCache) {
                try {
                    const isInside = turf.booleanPointInPolygon(point, county.geometry);
                    if (isInside) {
                        foundCounty = county;
                        break;
                    }
                } catch (err) {
                    // Continue checking other counties
                }
            }
        }
        
        // Get member info if district found
        let member = null;
        if (foundDistrict) {
            const members = await fetchHouseMembers();
            const memberKey = `${foundDistrict.state}-${parseInt(foundDistrict.district)}`;
            member = members[memberKey];
        }
        
        res.json({
            district: foundDistrict ? {
                found: true,
                state: foundDistrict.state,
                district: foundDistrict.district,
                isAtLarge: foundDistrict.isAtLarge,
                member: member
            } : {
                found: false
            },
            county: foundCounty ? {
                found: true,
                name: foundCounty.name,
                state: foundCounty.stateAbbr,
                geoid: foundCounty.geoid
            } : {
                found: false
            },
            location: { lat, lon }
        });
        
    } catch (error) {
        console.error('Find location error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get bill voting data
app.get('/api/bill-votes/:billId', async (req, res) => {
    try {
        const { billId } = req.params;
        
        if (billId === 'hr1-2025') {
            // For H.R. 1, we'll use party affiliation to approximate the vote
            // Republicans voted YES (except Fitzpatrick PA-1 and Massie KY-4)
            // Democrats voted NO
            const members = await fetchHouseMembers();
            const voteData = require('./hr1-votes.json');
            
            const districtVotes = {};
            
            // Process each member's vote based on party
            Object.entries(members).forEach(([key, member]) => {
                const [state, district] = key.split('-');
                const districtKey = `${state}-${district}`;
                
                // Check if this is one of the Republicans who voted NO
                if (voteData.votes.republicans_no.includes(districtKey)) {
                    districtVotes[districtKey] = {
                        vote: 'NO',
                        member: member.name,
                        party: member.party
                    };
                } else if (member.party === 'R') {
                    districtVotes[districtKey] = {
                        vote: 'YES',
                        member: member.name,
                        party: member.party
                    };
                } else if (member.party === 'D') {
                    districtVotes[districtKey] = {
                        vote: 'NO',
                        member: member.name,
                        party: member.party
                    };
                } else {
                    // Independent or other
                    districtVotes[districtKey] = {
                        vote: 'NO', // Assuming independents voted NO
                        member: member.name,
                        party: member.party
                    };
                }
            });
            
            res.json({
                bill: voteData.bill,
                districtVotes: districtVotes
            });
        } else {
            res.status(404).json({ error: 'Bill not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});