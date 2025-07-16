const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// KML directory path
const KML_DIR = path.join(__dirname, 'kml', 'ssdd');
const tj = require('@mapbox/togeojson');
const { DOMParser } = require('xmldom');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const turf = require('@turf/turf');
const STATE_BOUNDARIES = require('./stateData');
const config = require('./config');
const AddressService = require('./services/addressService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize address service
const addressService = new AddressService(config);

app.use(express.static('public'));
app.use(express.json());

// Store OAuth tokens in memory (in production, use a proper session store)
const oauthTokens = {};

// Cache for House member data
let membersCache = null;
let membersCacheTime = null;
const CACHE_DURATION = 86400000; // 24 hours
const CACHE_FILE = path.join(__dirname, 'cache', 'house-members.json');

// Load cache from file on startup
async function loadCacheFromFile() {
    try {
        const cacheData = await fs.readFile(CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        if (cache.timestamp && (Date.now() - cache.timestamp < CACHE_DURATION)) {
            membersCache = cache.data;
            membersCacheTime = cache.timestamp;
            console.log('Loaded House members from cache file');
            return true;
        }
    } catch (error) {
        // Cache file doesn't exist or is invalid
    }
    return false;
}

// Save cache to file
async function saveCacheToFile(data, timestamp) {
    try {
        await fs.writeFile(CACHE_FILE, JSON.stringify({
            data: data,
            timestamp: timestamp
        }, null, 2));
        console.log('Saved House members to cache file');
    } catch (error) {
        console.error('Error saving cache file:', error);
    }
}

// Function to fetch and parse House members data
async function fetchHouseMembers(forceRefresh = false) {
    // Check cache (unless force refresh is requested)
    if (!forceRefresh && membersCache && membersCacheTime && (Date.now() - membersCacheTime < CACHE_DURATION)) {
        return membersCache;
    }

    try {
        console.log('Fetching House members from house.gov...');
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
        
        // Save to file cache
        await saveCacheToFile(membersMap, membersCacheTime);
        
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
        const files = await fs.readdir(KML_DIR);
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
        const files = await fs.readdir(KML_DIR);
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
        
        const files = await fs.readdir(KML_DIR);
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
            const atLargeFilepath = path.join(KML_DIR, atLargeFilename);
            
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
        const filepath = path.join(KML_DIR, filename);
        
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
        const files = await fs.readdir(KML_DIR);
        const kmlFiles = files.filter(f => f.endsWith('.kml'));
        
        const features = [];
        
        // Add at-large states first
        for (const stateCode of AT_LARGE_STATES) {
            // Try to load actual KML file
            const atLargeFilename = `${stateCode}-0.kml`;
            const atLargeFilepath = path.join(KML_DIR, atLargeFilename);
            
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
                    const filepath = path.join(KML_DIR, file);
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

// Endpoint to refresh House members cache
app.post('/api/refresh-members-cache', async (req, res) => {
    try {
        console.log('Manual cache refresh requested');
        const members = await fetchHouseMembers(true); // Force refresh
        res.json({ 
            success: true, 
            message: 'House members cache refreshed',
            memberCount: Object.keys(members).length,
            cacheTime: new Date(membersCacheTime).toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get cache status
app.get('/api/cache-status', async (req, res) => {
    const cacheAge = membersCacheTime ? Date.now() - membersCacheTime : null;
    const cacheAgeHours = cacheAge ? Math.floor(cacheAge / (1000 * 60 * 60)) : null;
    
    res.json({
        members: {
            hasCachedData: !!membersCache,
            cacheTime: membersCacheTime ? new Date(membersCacheTime).toISOString() : null,
            cacheAgeHours: cacheAgeHours,
            cacheDurationHours: CACHE_DURATION / (1000 * 60 * 60),
            count: membersCache ? Object.keys(membersCache).length : 0
        },
        counties: {
            hasCachedData: !!countyDataCache,
            count: countyDataCache ? countyDataCache.length : 0,
            geometriesLoaded: !!countyGeometryCache
        },
        districts: {
            hasCachedData: !!districtGeometryCache,
            count: districtGeometryCache ? districtGeometryCache.length : 0
        },
        cacheFiles: {
            members: await fs.access(CACHE_FILE).then(() => true).catch(() => false),
            counties: await fs.access(COUNTY_CACHE_FILE).then(() => true).catch(() => false),
            districts: await fs.access(DISTRICT_CACHE_FILE).then(() => true).catch(() => false)
        }
    });
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
const DISTRICT_CACHE_FILE = path.join(__dirname, 'cache', 'district-geometries.json');

// Cache for county data
let countyDataCache = null;
let countyGeometryCache = null;
const COUNTY_CACHE_FILE = path.join(__dirname, 'cache', 'county-data.json');

// Load district cache from file
async function loadDistrictCacheFromFile() {
    try {
        const cacheData = await fs.readFile(DISTRICT_CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        if (cache.districts && Array.isArray(cache.districts)) {
            districtGeometryCache = cache.districts;
            console.log(`Loaded ${cache.districts.length} district geometries from cache file`);
            return true;
        }
    } catch (error) {
        // Cache file doesn't exist or is invalid
    }
    return false;
}

// Save district cache to file
async function saveDistrictCacheToFile() {
    try {
        await fs.writeFile(DISTRICT_CACHE_FILE, JSON.stringify({
            districts: districtGeometryCache,
            timestamp: Date.now()
        }, null, 2));
        console.log('Saved district geometries to cache file');
    } catch (error) {
        console.error('Error saving district cache file:', error);
    }
}

// Load all district geometries into memory for faster lookup
async function loadDistrictGeometries() {
    if (districtGeometryCache) return districtGeometryCache;
    
    // Try to load from cache file first
    const loadedFromCache = await loadDistrictCacheFromFile();
    if (loadedFromCache) {
        return districtGeometryCache;
    }
    
    console.log('Loading district geometries from KML files...');
    const districts = [];
    
    try {
        const files = await fs.readdir(KML_DIR);
        const kmlFiles = files.filter(f => f.endsWith('.kml') && !f.includes('cb_2022'));
        
        for (const file of kmlFiles) {
            try {
                const kmlData = await fs.readFile(path.join(KML_DIR, file), 'utf8');
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
        console.log(`Loaded ${districts.length} district geometries from KML`);
        
        // Save to cache file
        await saveDistrictCacheToFile();
        
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

// Load county cache from file
async function loadCountyCacheFromFile() {
    try {
        const cacheData = await fs.readFile(COUNTY_CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        if (cache.data && cache.geometries) {
            countyDataCache = cache.data;
            countyGeometryCache = cache.geometries;
            console.log(`Loaded ${cache.data.length} counties from cache file`);
            return true;
        }
    } catch (error) {
        // Cache file doesn't exist or is invalid
    }
    return false;
}

// Save county cache to file
async function saveCountyCacheToFile() {
    try {
        await fs.writeFile(COUNTY_CACHE_FILE, JSON.stringify({
            data: countyDataCache,
            geometries: countyGeometryCache,
            timestamp: Date.now()
        }, null, 2));
        console.log('Saved county data to cache file');
    } catch (error) {
        console.error('Error saving county cache file:', error);
    }
}

// Load county data from KML file
async function loadCountyData() {
    if (countyDataCache) return countyDataCache;
    
    // Try to load from cache file first
    const loadedFromCache = await loadCountyCacheFromFile();
    if (loadedFromCache) {
        return countyDataCache;
    }
    
    console.log('Loading county data from KML file...');
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
        console.log(`Loaded ${counties.length} counties from KML`);
        
        // Save to cache file
        await saveCountyCacheToFile();
        
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

// Endpoint to analyze county political control
app.get('/api/county-politics', async (req, res) => {
    try {
        // Load all necessary data
        await loadDistrictGeometries();
        await loadCountyData();
        const members = await fetchHouseMembers();
        
        if (!countyGeometryCache || !districtGeometryCache) {
            return res.status(500).json({ error: 'Data not loaded' });
        }
        
        const countyPolitics = {};
        const countyStats = {
            republican: 0,
            democrat: 0,
            independent: 0,
            split: 0,
            noData: 0
        };
        
        // For each county, find which congressional district(s) it overlaps
        for (const county of countyGeometryCache) {
            const countyKey = `${county.stateAbbr}-${county.name}`;
            const overlappingDistricts = [];
            
            // Check intersection with each district
            for (const district of districtGeometryCache) {
                try {
                    // Create turf polygons
                    const countyPoly = turf.polygon(
                        county.geometry.type === 'Polygon' ? 
                        [county.geometry.coordinates[0]] : 
                        county.geometry.coordinates[0]
                    );
                    
                    const districtPoly = turf.polygon(
                        district.geometry.type === 'Polygon' ? 
                        [district.geometry.coordinates[0]] : 
                        district.geometry.coordinates[0]
                    );
                    
                    // Check if they intersect
                    if (turf.booleanIntersects(countyPoly, districtPoly)) {
                        const memberKey = `${district.state}-${parseInt(district.district)}`;
                        const member = members[memberKey];
                        
                        if (member) {
                            overlappingDistricts.push({
                                district: `${district.state}-${district.district}`,
                                party: member.party,
                                member: member.name
                            });
                        }
                    }
                } catch (err) {
                    // Skip invalid geometries
                }
            }
            
            // Determine county's political control
            const parties = [...new Set(overlappingDistricts.map(d => d.party))];
            let control = 'noData';
            
            if (overlappingDistricts.length === 0) {
                countyStats.noData++;
            } else if (parties.length === 1) {
                // County is entirely in one party's district(s)
                const party = parties[0];
                if (party === 'R') {
                    control = 'republican';
                    countyStats.republican++;
                } else if (party === 'D') {
                    control = 'democrat';
                    countyStats.democrat++;
                } else {
                    control = 'independent';
                    countyStats.independent++;
                }
            } else {
                // County is split between parties
                control = 'split';
                countyStats.split++;
            }
            
            countyPolitics[countyKey] = {
                county: county.name,
                state: county.stateAbbr,
                control: control,
                districts: overlappingDistricts
            };
        }
        
        res.json({
            counties: countyPolitics,
            stats: countyStats,
            total: countyGeometryCache.length
        });
        
    } catch (error) {
        console.error('County politics error:', error);
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

// Endpoint for ZIP+4 based district lookup
app.get('/api/address-lookup-zip4', async (req, res) => {
    try {
        const { street, city, state, zip, method } = req.query;
        
        if (!street || !city || !state) {
            return res.status(400).json({ error: 'Street, city, and state are required' });
        }
        
        const address = { street, city, state, zip };
        const lookupMethod = method || config.defaultLookupMethod;
        
        // If comparing both methods
        if (lookupMethod === 'both') {
            const [zip4Result, censusResult] = await Promise.all([
                addressService.lookupDistrict(address, 'smarty'),
                (async () => {
                    // Use existing geocoding and district lookup
                    const geoResponse = await fetch(`http://localhost:${PORT}/api/geocode?address=${encodeURIComponent(`${street}, ${city}, ${state}`)}`);
                    const geoData = await geoResponse.json();
                    
                    if (geoData && geoData.length > 0) {
                        const { lat, lon } = geoData[0];
                        const locationResponse = await fetch(`http://localhost:${PORT}/api/find-location?lat=${lat}&lon=${lon}`);
                        return await locationResponse.json();
                    }
                    return { success: false, error: 'Geocoding failed' };
                })()
            ]);
            
            return res.json({
                zip4Method: zip4Result,
                censusMethod: censusResult,
                comparison: {
                    match: zip4Result.success && censusResult.district?.found && 
                           zip4Result.district?.state === censusResult.district?.state &&
                           zip4Result.district?.district === censusResult.district?.district,
                    confidence: calculateConfidence(zip4Result, censusResult)
                }
            });
        }
        
        // Single method lookup
        const result = await addressService.lookupDistrict(address, lookupMethod);
        res.json(result);
        
    } catch (error) {
        console.error('Address lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for batch address processing
app.post('/api/batch-process', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { addresses, method } = req.body;
        const batchId = `batch_${Date.now()}`;
        
        if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
            return res.status(400).json({ error: 'No addresses provided' });
        }
        
        const results = [];
        const errors = [];
        
        // Process each address
        for (let i = 0; i < addresses.length; i++) {
            try {
                const address = addresses[i];
                const addressParts = parseAddressString(address);
                
                if (!addressParts) {
                    errors.push({ address, error: 'Invalid address format' });
                    continue;
                }
                
                // Lookup using specified method
                const lookupMethod = method || config.defaultLookupMethod;
                
                if (lookupMethod === 'both') {
                    // Compare both methods
                    const [zip4Result, censusResult] = await Promise.all([
                        addressService.lookupDistrict(addressParts, 'smarty'),
                        (async () => {
                            const geoResponse = await fetch(`http://localhost:${PORT}/api/geocode?address=${encodeURIComponent(address)}`);
                            const geoData = await geoResponse.json();
                            
                            if (geoData && geoData.length > 0) {
                                const { lat, lon } = geoData[0];
                                const locationResponse = await fetch(`http://localhost:${PORT}/api/find-location?lat=${lat}&lon=${lon}`);
                                return await locationResponse.json();
                            }
                            return { success: false };
                        })()
                    ]);
                    
                    const match = zip4Result.success && censusResult.district?.found &&
                                 zip4Result.district?.state === censusResult.district?.state &&
                                 zip4Result.district?.district === censusResult.district?.district;
                    
                    results.push({
                        address,
                        zip5: zip4Result.standardized?.zip5,
                        zip4: zip4Result.standardized?.zip4,
                        state_code: zip4Result.district?.state,
                        district_number: zip4Result.district?.district,
                        county_fips: zip4Result.district?.countyFips,
                        census_district: censusResult.district?.district,
                        match_status: match ? 'MATCH' : 'MISMATCH',
                        confidence: calculateConfidence(zip4Result, censusResult),
                        details: {
                            zip4Method: zip4Result,
                            censusMethod: censusResult
                        }
                    });
                } else {
                    // Single method
                    const result = await addressService.lookupDistrict(addressParts, lookupMethod);
                    
                    if (result.success) {
                        results.push({
                            address,
                            state_code: result.district?.state,
                            district_number: result.district?.district,
                            county_fips: result.district?.countyFips,
                            method: lookupMethod,
                            details: result
                        });
                    } else {
                        errors.push({ address, error: result.error });
                    }
                }
                
                // Send progress update
                if (i % 10 === 0) {
                    console.log(`Processed ${i + 1}/${addresses.length} addresses`);
                }
            } catch (err) {
                errors.push({ address: addresses[i], error: err.message });
            }
        }
        
        // Save batch results to database
        if (results.length > 0) {
            await addressService.db.saveBatchResults(batchId, results);
        }
        
        // Calculate match statistics for comparison method
        let matches = 0;
        let mismatches = 0;
        
        if (method === 'both') {
            results.forEach(r => {
                if (r.match_status === 'MATCH') matches++;
                else if (r.match_status === 'MISMATCH') mismatches++;
            });
        }
        
        res.json({
            batchId,
            processed: addresses.length,
            success: results.length,
            failed: errors.length,
            matches,
            mismatches,
            method,
            results,
            errors,
            downloadUrl: `/api/batch-results/${batchId}/download`
        });
        
    } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to download batch results as CSV
app.get('/api/batch-results/:batchId/download', async (req, res) => {
    try {
        const { batchId } = req.params;
        const results = await addressService.db.getBatchResults(batchId);
        
        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        
        // Generate CSV
        const csv = generateCSV(results);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="districts_${batchId}.csv"`);
        res.send(csv);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to parse address string
function parseAddressString(addressStr) {
    // Simple parser - could be improved with a proper address parsing library
    const parts = addressStr.split(',').map(s => s.trim());
    
    if (parts.length < 3) return null;
    
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(' ');
    const state = stateZip[0];
    const zip = stateZip[1] || '';
    
    return { street, city, state, zip };
}

// Helper function to generate CSV
function generateCSV(results) {
    const headers = [
        'Address',
        'State',
        'Congressional District',
        'County FIPS',
        'ZIP+4',
        'Match Status',
        'Confidence',
        'Method'
    ];
    
    const rows = results.map(r => [
        r.address,
        r.state_code || '',
        r.district_number || '',
        r.county_fips || '',
        r.zip4 ? `${r.zip5}-${r.zip4}` : r.zip5 || '',
        r.match_status || '',
        r.confidence || '',
        r.method || 'comparison'
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

// Helper function to calculate confidence in the match
function calculateConfidence(zip4Result, censusResult) {
    if (!zip4Result.success || !censusResult.district?.found) {
        return 0;
    }
    
    // Base confidence
    let confidence = 50;
    
    // If districts match, high confidence
    if (zip4Result.district?.state === censusResult.district?.state &&
        zip4Result.district?.district === censusResult.district?.district) {
        confidence = 95;
    }
    
    // If counties match too, even higher confidence
    if (zip4Result.district?.countyFips === censusResult.county?.geoid) {
        confidence = 99;
    }
    
    return confidence;
}

// USPS OAuth callback endpoint
app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.status(400).send('Authorization code missing');
    }
    
    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://developers.usps.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: process.env.USPS_CLIENT_ID,
                client_secret: process.env.USPS_CLIENT_SECRET,
                redirect_uri: `http://localhost:${PORT}/callback`
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.access_token) {
            // Store token (in production, use proper session management)
            oauthTokens.usps = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: Date.now() + (tokenData.expires_in * 1000)
            };
            
            res.send(`
                <html>
                <body>
                    <h2>USPS OAuth Setup Complete!</h2>
                    <p>Access token received. You can close this window.</p>
                    <script>
                        setTimeout(() => window.close(), 3000);
                    </script>
                </body>
                </html>
            `);
        } else {
            res.status(400).send('Failed to obtain access token');
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).send('OAuth authentication failed');
    }
});

// Endpoint to initiate USPS OAuth flow
app.get('/api/usps-auth', (req, res) => {
    const authUrl = `https://developers.usps.com/oauth/authorize?` + 
        `client_id=${process.env.USPS_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(`http://localhost:${PORT}/callback`)}&` +
        `scope=addresses`;
    
    res.json({ authUrl });
});

// Check API configuration status
app.get('/api/config-status', (req, res) => {
    res.json({
        usps: {
            configured: !!(process.env.USPS_CLIENT_ID && process.env.USPS_CLIENT_SECRET),
            hasToken: !!oauthTokens.usps,
            tokenValid: oauthTokens.usps ? oauthTokens.usps.expires_at > Date.now() : false
        },
        smarty: {
            configured: !!(process.env.SMARTY_AUTH_ID && process.env.SMARTY_AUTH_TOKEN)
        },
        defaultMethod: config.defaultLookupMethod
    });
});

// Save API configuration (in memory for now, in production use secure storage)
app.post('/api/save-config', express.json(), (req, res) => {
    const { uspsClientId, uspsClientSecret, smartyAuthId, smartyAuthToken } = req.body;
    
    // In production, these should be saved securely
    if (uspsClientId) process.env.USPS_CLIENT_ID = uspsClientId;
    if (uspsClientSecret) process.env.USPS_CLIENT_SECRET = uspsClientSecret;
    if (smartyAuthId) process.env.SMARTY_AUTH_ID = smartyAuthId;
    if (smartyAuthToken) process.env.SMARTY_AUTH_TOKEN = smartyAuthToken;
    
    // Update config object
    config.usps.userId = process.env.USPS_USER_ID || '';
    config.smarty.authId = process.env.SMARTY_AUTH_ID || '';
    config.smarty.authToken = process.env.SMARTY_AUTH_TOKEN || '';
    
    res.json({ success: true });
});

// Initialize caches on startup
async function initializeCaches() {
    console.log('Initializing caches...');
    
    // Load House members cache
    const membersLoaded = await loadCacheFromFile();
    if (membersLoaded) {
        console.log(`Using cached House members data (${Object.keys(membersCache).length} members)`);
    }
    
    // Pre-load district geometries (for faster lookups)
    await loadDistrictGeometries();
    
    // Pre-load county data (for faster lookups)
    await loadCountyData();
    
    console.log('All caches initialized');
}

// Start server with cache initialization
initializeCaches().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Cache duration: ${CACHE_DURATION / (1000 * 60 * 60)} hours`);
    });
});