console.log('SSDD Map Application starting...');

// Global variables that need to be accessible throughout the app
let map;
let currentBaseLayer = null;
let currentLabelLayer = null;
let countyLayer = null;
let districtLayers = {};
let houseMembers = {};
let selectedDistrictLayer = null;
let selectedCountyLayer = null;
let cachedCounties = {};
let loadingCounties = false;
let currentMarker = null;
let isRepView = false;
let countyTooltip = null;
let autosuggestEnabled = true;
let searchResults = [];
let selectedResultIndex = -1;

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
    console.log('DOM not ready, waiting...');
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.log('DOM ready, initializing...');
    initializeApp();
}

function initializeApp() {
    console.log('Initializing app...');
    
    // Check if required elements exist
    const requiredElements = ['map', 'toolbar', 'loading'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }
    
    // Initialize map with smooth zoom animations
    map = L.map('map', {
    zoomAnimation: true,
    zoomAnimationThreshold: 4,
    fadeAnimation: true,
    markerZoomAnimation: true,
    minZoom: 2,
    maxZoom: 12
}).setView([39.8283, -98.5795], 4); // Center of continental USA

// Create custom panes for proper layering
map.createPane('districts');
map.getPane('districts').style.zIndex = 200; // Below labels (which are at 650)
map.createPane('countyLabels');
map.getPane('countyLabels').style.zIndex = 300; // Above districts but below map labels

// Map style configurations
const mapStyles = {
    dark: {
        base: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO'
    },
    light: {
        base: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO'
    },
    voyager: {
        base: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
        labels: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO'
    },
    satellite: {
        base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
        attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN'
    },
    terrain: {
        base: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-background/{z}/{x}/{y}{r}.png',
        labels: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-labels/{z}/{x}/{y}{r}.png',
        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>'
    }
};

// Map style configurations moved to global scope and defined inside initializeApp

// Function to set map style
function setMapStyle(style) {
    const styleConfig = mapStyles[style] || mapStyles.dark;
    
    // Remove existing layers
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    if (currentLabelLayer) map.removeLayer(currentLabelLayer);
    
    // Add new base layer
    currentBaseLayer = L.tileLayer(styleConfig.base, {
        attribution: styleConfig.attribution,
        subdomains: 'abcd',
        maxZoom: 12,
        minZoom: 3,
        pane: 'tilePane'
    }).addTo(map);
    
    // Add new label layer
    currentLabelLayer = L.tileLayer(styleConfig.labels, {
        subdomains: 'abcd',
        maxZoom: 12,
        minZoom: 3,
        pane: 'shadowPane'
    }).addTo(map);
}

    // Initialize with light theme to match the new bright design
    setMapStyle('voyager');
    
    // Initialize all UI handlers and start the app
    initializeUIHandlers();
    loadDistricts();
    
    // Hide loading overlay
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('show');
    }
    
    console.log('App initialization complete');
    
    // Continue with the rest of initialization
    initializeRestOfApp();
}

// Function to initialize the rest of the app
function initializeRestOfApp() {
    // Global variables
    let currentLayer = null;
let allDistrictsLayer = null;
let stateDistrictsLayer = null;
let stateOutlineLayer = null;
let selectedState = null;
let selectedDistrict = null;
let addressMarker = null;
let distanceLine = null;
let boundaryMarker = null;
let searchTimeout = null;
let countyLayer = null;
let countyLabelMarkers = [];
let showCounties = false;
let showRepresentationView = false;
let stateRepCounts = null;
let houseMembersCache = null;
let showCountyPolitics = false;
let countyPoliticsData = null;
let showCountyFIPS = false;

// Elements
const stateSelect = document.getElementById('stateSelect');
const districtList = document.getElementById('districtList');
const viewUSABtn = document.getElementById('viewUSA');
const loadingEl = document.getElementById('loading');
const districtInfo = document.getElementById('districtInfo');
const addressInput = document.getElementById('addressInput');
const searchBtn = document.getElementById('searchBtn');
const autosuggestToggle = document.getElementById('autosuggestToggle');
const searchResults = document.getElementById('searchResults');
// const toggleCountiesBtn = document.getElementById('toggleCounties'); // Removed from UI
const toggleRepViewBtn = document.getElementById('toggleRepView');
const legendEl = document.getElementById('legend');
// const toggleCountyPoliticsBtn = document.getElementById('toggleCountyPolitics'); // Removed from UI
// const toggleCountyFIPSBtn = document.getElementById('toggleCountyFIPS'); // Removed from UI
const refreshCacheBtn = document.getElementById('refreshCacheBtn');
const cacheStatusEl = document.getElementById('cacheStatus');
const mapStyleSelect = document.getElementById('mapStyle');
const dataManageBtn = document.getElementById('dataManageBtn');
const dataModal = document.getElementById('dataModal');
const configBtn = document.getElementById('configBtn');
const infoSidebar = document.getElementById('info-sidebar');
const closeSidebar = document.getElementById('closeSidebar');

// Show/hide loading indicator
function setLoading(show) {
    loadingEl.classList.toggle('show', show);
}

// Get party color
function getPartyColor(party, opacity = 0.7) {
    switch(party) {
        case 'R':
            return { fill: '#ef4444', stroke: '#dc2626', opacity: opacity }; // Republican red
        case 'D':
            return { fill: '#3b82f6', stroke: '#2563eb', opacity: opacity }; // Democrat blue
        case 'I':
            return { fill: '#8b5cf6', stroke: '#7c3aed', opacity: opacity }; // Independent purple
        default:
            return { fill: '#6b7280', stroke: '#4b5563', opacity: opacity }; // Unknown gray
    }
}

// Create state outline from districts (but don't add to map yet)
function createStateOutline(districtFeatures) {
    if (stateOutlineLayer) {
        map.removeLayer(stateOutlineLayer);
    }
    
    // Create a union of all district geometries to form state outline
    stateOutlineLayer = L.geoJSON({
        type: 'FeatureCollection',
        features: districtFeatures
    }, {
        style: {
            fillOpacity: 0,
            color: '#475569', // Darker gray for state outline
            weight: 3.5, // Bolder than districts (1.5)
            opacity: 0.8,
            dashArray: null // Solid line for state borders
        },
        interactive: false // Don't respond to mouse events
    });
}

// Show the pre-created state outline
function showStateOutline() {
    if (stateOutlineLayer && !map.hasLayer(stateOutlineLayer)) {
        stateOutlineLayer.addTo(map);
    }
}

// Hide state outline
function hideStateOutline() {
    if (stateOutlineLayer && map.hasLayer(stateOutlineLayer)) {
        map.removeLayer(stateOutlineLayer);
    }
}

// Fetch House members data
async function fetchHouseMembers() {
    if (houseMembersCache) return houseMembersCache;
    
    try {
        const response = await fetch('/ssddmap/api/members');
        houseMembersCache = await response.json();
        return houseMembersCache;
    } catch (error) {
        console.error('Error fetching House members:', error);
        return {};
    }
}

// Load available states
async function loadStates() {
    try {
        const response = await fetch('/ssddmap/api/states');
        const states = await response.json();
        
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading states:', error);
    }
}

// Load districts for a specific state
async function loadStateDistricts(stateCode) {
    try {
        setLoading(true);
        const response = await fetch(`/ssddmap/api/state/${stateCode}`);
        const districts = await response.json();
        
        // Clear district list
        districtList.innerHTML = '';
        
        // Add district items
        districts.forEach(district => {
            const div = document.createElement('div');
            div.className = 'district-item';
            if (district.isAtLarge) {
                div.classList.add('at-large');
            }
            
            // Add member info if available
            if (district.member) {
                const partyClass = district.member.party === 'R' ? 'republican' : 
                                 district.member.party === 'D' ? 'democrat' : 'independent';
                const districtLabel = district.isAtLarge ? 'At-Large' : `District ${district.district}`;
                div.innerHTML = `
                    <div class="district-header">
                        <span class="district-number">${districtLabel}</span>
                        <span class="party-badge ${partyClass}">${district.member.party}</span>
                    </div>
                    <div class="member-name">${district.member.name}</div>
                `;
            } else {
                const districtLabel = district.isAtLarge ? 'At-Large' : `District ${district.district}`;
                div.textContent = `${districtLabel} (Vacant)`;
            }
            
            div.dataset.state = district.state;
            div.dataset.district = district.district;
            div.dataset.atLarge = district.isAtLarge ? 'true' : 'false';
            
            div.addEventListener('click', () => {
                loadDistrict(district.state, district.district);
                
                // Update active state
                document.querySelectorAll('.district-item').forEach(item => {
                    item.classList.remove('active');
                });
                div.classList.add('active');
            });
            
            districtList.appendChild(div);
        });
        
        // Load all districts for this state on the map
        await loadStateMap(stateCode);
        
    } catch (error) {
        console.error('Error loading state districts:', error);
    } finally {
        setLoading(false);
    }
}

// Load a specific district
async function loadDistrict(stateCode, districtNumber) {
    try {
        setLoading(true);
        const response = await fetch(`/ssddmap/api/district/${stateCode}/${districtNumber}`);
        const data = await response.json();
        
        // Clear current layer
        if (currentLayer) {
            map.removeLayer(currentLayer);
        }
        
        // Add new district layer with party-based colors
        // Use consistent opacity (0.5) for all districts including at-large
        const partyColors = data.member ? getPartyColor(data.member.party, 0.5) : getPartyColor(null, 0.5);
        currentLayer = L.geoJSON(data.geojson, {
            pane: 'districts',
            style: {
                fillColor: partyColors.fill,
                fillOpacity: partyColors.opacity,
                color: partyColors.stroke,
                weight: 3
            },
            onEachFeature: (feature, layer) => {
                const districtLabel = data.isAtLarge ? 'At-Large' : `District ${districtNumber}`;
                let popupContent = `
                    <div class="district-popup">
                        <h4>${stateCode}${data.isAtLarge ? '' : '-' + districtNumber}</h4>
                        <p>${data.isAtLarge ? 'At-Large Representative' : `Congressional ${districtLabel}`}</p>
                `;
                
                if (data.member) {
                    popupContent += `
                        <p><strong>${data.member.name}</strong> (${data.member.party})</p>
                    `;
                    if (data.member.website) {
                        popupContent += `
                            <p><a href="${data.member.website}" target="_blank" rel="noopener noreferrer">Official Website</a></p>
                        `;
                    }
                }
                
                // Add ZIP code lookup link
                popupContent += `
                    <p style="margin-top: 8px; font-size: 12px;">
                        <a href="#" onclick="showDistrictZipCodes('${stateCode}', '${districtNumber}'); return false;" 
                           style="color: var(--accent-primary); text-decoration: underline;">
                           View ZIP codes for this district →
                        </a>
                    </p>
                `;
                
                popupContent += `</div>`;
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
        
        // Fit map to district bounds with smooth animation
        const bounds = currentLayer.getBounds();
        
        // Special handling for territories that might be far from continental US
        let zoomOptions = { 
            padding: [50, 50],
            duration: 0.6,
            easeLinearity: 0.5
        };
        
        // For territories, ensure we don't zoom out too far
        if (['PR', 'VI', 'GU', 'AS', 'MP'].includes(stateCode)) {
            zoomOptions.maxZoom = 10;
        }
        
        map.flyToBounds(bounds, zoomOptions);
        
        // Update info panel with member details
        updateDistrictInfo(stateCode, districtNumber, data.member, data.isAtLarge);
        
        selectedState = stateCode;
        selectedDistrict = districtNumber;
        
    } catch (error) {
        console.error('Error loading district:', error);
    } finally {
        setLoading(false);
    }
}

// Load all districts for a state
async function loadStateMap(stateCode) {
    try {
        // Clear existing state layer
        if (stateDistrictsLayer) {
            map.removeLayer(stateDistrictsLayer);
        }
        if (stateOutlineLayer) {
            map.removeLayer(stateOutlineLayer);
            stateOutlineLayer = null;
        }
        
        const response = await fetch(`/ssddmap/api/state/${stateCode}`);
        const districts = await response.json();
        
        const layers = [];
        
        // If it's an at-large state with only one district, load it directly
        if (districts.length === 1 && districts[0].isAtLarge) {
            loadDistrict(districts[0].state, districts[0].district);
            return;
        }
        
        // Load each district
        for (const district of districts) {
            try {
                const distResponse = await fetch(`/ssddmap/api/district/${district.state}/${district.district}`);
                const distData = await distResponse.json();
                
                const partyColors = distData.member ? getPartyColor(distData.member.party, 0.5) : getPartyColor(null, 0.5);
                const layer = L.geoJSON(distData.geojson, {
                    pane: 'districts',
                    style: {
                        fillColor: partyColors.fill,
                        fillOpacity: partyColors.opacity,
                        color: partyColors.stroke,
                        weight: 1.5
                    },
                    onEachFeature: (feature, layer) => {
                        let popupContent = `
                            <div class="district-popup">
                                <h4>${district.state}-${district.district}</h4>
                        `;
                        
                        if (distData.member) {
                            popupContent += `
                                <p><strong>${distData.member.name}</strong> (${distData.member.party})</p>
                            `;
                            if (distData.member.website) {
                                popupContent += `
                                    <p><a href="${distData.member.website}" target="_blank" rel="noopener noreferrer">Official Website</a></p>
                                `;
                            }
                        } else {
                            popupContent += `<p>Congressional District ${district.district}</p>`;
                        }
                        
                        // Add ZIP code lookup link
                        popupContent += `
                            <p style="margin-top: 8px; font-size: 12px;">
                                <a href="#" onclick="showDistrictZipCodes('${district.state}', '${district.district}'); return false;" 
                                   style="color: var(--accent-primary); text-decoration: underline;">
                                   View ZIP codes for this district →
                                </a>
                            </p>
                        `;
                        
                        popupContent += `</div>`;
                        layer.bindPopup(popupContent);
                        
                        // Add hover effect
                        layer.on({
                            mouseover: (e) => {
                                e.target.setStyle({
                                    fillOpacity: 0.85,
                                    weight: 3,
                                    color: '#ffffff'
                                });
                                // Show state outline on hover
                                showStateOutline();
                            },
                            mouseout: (e) => {
                                e.target.setStyle({
                                    fillOpacity: 0.6,
                                    weight: 1.5,
                                    color: '#4a5568'
                                });
                                // Hide state outline
                                hideStateOutline();
                            },
                            click: () => {
                                loadDistrict(district.state, district.district);
                                
                                // Update active district in list
                                document.querySelectorAll('.district-item').forEach(item => {
                                    item.classList.remove('active');
                                    if (item.dataset.state === district.state && 
                                        item.dataset.district === district.district) {
                                        item.classList.add('active');
                                    }
                                });
                            }
                        });
                    }
                });
                
                layers.push(layer);
            } catch (err) {
                console.error(`Error loading district ${district.state}-${district.district}:`, err);
            }
        }
        
        // Create state outline from all district features
        const allFeatures = [];
        for (const district of districts) {
            try {
                const distResponse = await fetch(`/ssddmap/api/district/${district.state}/${district.district}`);
                const distData = await distResponse.json();
                if (distData.geojson && distData.geojson.features) {
                    allFeatures.push(...distData.geojson.features);
                }
            } catch (err) {
                console.error(`Error fetching district for outline:`, err);
            }
        }
        createStateOutline(allFeatures);
        
        // Create layer group
        stateDistrictsLayer = L.layerGroup(layers).addTo(map);
        
        // Fit map to state bounds with animation
        if (layers.length > 0) {
            const group = L.featureGroup(layers);
            map.flyToBounds(group.getBounds(), { 
                padding: [50, 50],
                duration: 0.8,
                easeLinearity: 0.5
            });
        }
        
    } catch (error) {
        console.error('Error loading state map:', error);
    }
}

// Load USA overview map
async function loadUSAMap() {
    try {
        setLoading(true);
        
        // Clear existing layers
        if (currentLayer) {
            map.removeLayer(currentLayer);
            currentLayer = null;
        }
        if (stateDistrictsLayer) {
            map.removeLayer(stateDistrictsLayer);
            stateDistrictsLayer = null;
        }
        if (stateOutlineLayer) {
            map.removeLayer(stateOutlineLayer);
            stateOutlineLayer = null;
        }
        if (distanceLine) {
            map.removeLayer(distanceLine);
            distanceLine = null;
        }
        if (boundaryMarker) {
            map.removeLayer(boundaryMarker);
            boundaryMarker = null;
        }
        
        // Check if we already have the USA layer
        if (allDistrictsLayer) {
            allDistrictsLayer.addTo(map);
            map.setView([37.0902, -95.7129], 4);
            return;
        }
        
        const response = await fetch('/ssddmap/api/all-districts');
        const data = await response.json();
        
        // First, fetch all member data
        const members = await fetchHouseMembers();
        
        allDistrictsLayer = L.geoJSON(data, {
            pane: 'districts',
            style: (feature) => {
                const props = feature.properties;
                const memberKey = `${props.state}-${parseInt(props.district)}`;
                const member = members[memberKey];
                const partyColors = member ? getPartyColor(member.party, 0.5) : getPartyColor(null, 0.5);
                
                return {
                    fillColor: partyColors.fill,
                    fillOpacity: partyColors.opacity,
                    color: partyColors.stroke,
                    weight: 0.8
                };
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const memberKey = `${props.state}-${parseInt(props.district)}`;
                const member = members[memberKey];
                
                let popupContent = `
                    <div class="district-popup">
                        <h4>${props.state}-${props.district}</h4>
                `;
                
                if (member) {
                    popupContent += `
                        <p><strong>${member.name}</strong> (${member.party})</p>
                    `;
                    if (member.website) {
                        popupContent += `
                            <p><a href="${member.website}" target="_blank" rel="noopener noreferrer">Official Website</a></p>
                        `;
                    }
                } else {
                    popupContent += `<p>No representative data</p>`;
                }
                
                // Add ZIP code lookup link
                popupContent += `
                    <p style="margin-top: 8px; font-size: 12px;">
                        <a href="#" onclick="showDistrictZipCodes('${props.state}', '${props.district}'); return false;" 
                           style="color: var(--accent-primary); text-decoration: underline;">
                           View ZIP codes →
                        </a>
                    </p>
                `;
                
                popupContent += `
                        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">Click district to zoom in</p>
                    </div>
                `;
                
                layer.bindPopup(popupContent);
                
                // Add click handler
                layer.on('click', async (e) => {
                    // Stop the click from propagating to the map
                    L.DomEvent.stopPropagation(e);
                    
                    // Set state selector
                    stateSelect.value = props.state;
                    
                    // Load state districts and zoom
                    await loadStateDistricts(props.state);
                });
            }
        }).addTo(map);
        
        // Reset view to USA with smooth animation
        map.flyTo([39.8283, -98.5795], 4, {
            duration: 0.8,
            easeLinearity: 0.5
        });
        
        // Clear selections
        stateSelect.value = '';
        districtList.innerHTML = '';
        districtInfo.innerHTML = '<p>Select a district to view details</p>';
        
    } catch (error) {
        console.error('Error loading USA map:', error);
        alert('Error loading USA map. The dataset might be too large. Try viewing individual states instead.');
    } finally {
        setLoading(false);
    }
}

// Get color for district based on number
function getDistrictColor(districtNum) {
    const colors = [
        '#60a5fa', // blue-400
        '#f87171', // red-400
        '#34d399', // emerald-400
        '#c084fc', // purple-400
        '#fbbf24', // amber-400
        '#fb923c', // orange-400
        '#4ade80', // green-400
        '#f472b6', // pink-400
        '#22d3ee', // cyan-400
        '#a78bfa'  // violet-400
    ];
    return colors[districtNum % colors.length];
}

// Get color for state
function getStateColor(state) {
    // Simple hash function to generate consistent colors for states
    let hash = 0;
    for (let i = 0; i < state.length; i++) {
        hash = state.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
}

// Event listeners
if (stateSelect) {
    stateSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            loadStateDistricts(e.target.value);
        }
    });
}

if (viewUSABtn) {
    viewUSABtn.addEventListener('click', () => {
        loadUSAMap();
    });
}

// Update district info panel with member details
function updateDistrictInfo(stateCode, districtNumber, member, isAtLarge = false) {
    const districtLabel = isAtLarge ? 'At-Large' : districtNumber;
    let infoHTML = `
        <p><strong>State:</strong> ${stateCode}</p>
        <p><strong>District:</strong> ${districtLabel}</p>
    `;
    
    if (member) {
        const partyClass = member.party === 'R' ? 'republican' : 
                         member.party === 'D' ? 'democrat' : 'independent';
        const partyLabel = member.party === 'R' ? 'Republican' : 
                          member.party === 'D' ? 'Democrat' : 'Independent';
        
        infoHTML += `
            <div class="member-details">
                ${member.photo ? `<img src="${member.photo}" alt="${member.name}" class="member-photo">` : ''}
                <h4>${member.name}</h4>
                <p class="party-affiliation">
                    <span class="party-badge ${partyClass}">${partyLabel}</span>
                </p>
                
                <div class="contact-info">
                    <p><strong>Phone:</strong> ${member.phone || 'N/A'}</p>
                    <p><strong>Office:</strong> ${member.office || 'N/A'}</p>
                    ${member.website ? `<p><a href="${member.website}" target="_blank">Official Website</a></p>` : ''}
                    ${member.contactForm ? `<p><a href="${member.contactForm}" target="_blank">Contact Form</a></p>` : ''}
                </div>
                
                ${member.social && (member.social.facebook || member.social.twitter || member.social.youtube || member.social.instagram) ? `
                    <div class="social-links">
                        <p><strong>Social Media:</strong></p>
                        ${member.social.facebook ? `<a href="${member.social.facebook}" target="_blank" class="social-link">Facebook</a>` : ''}
                        ${member.social.twitter ? `<a href="${member.social.twitter}" target="_blank" class="social-link">Twitter</a>` : ''}
                        ${member.social.youtube ? `<a href="${member.social.youtube}" target="_blank" class="social-link">YouTube</a>` : ''}
                        ${member.social.instagram ? `<a href="${member.social.instagram}" target="_blank" class="social-link">Instagram</a>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    } else {
        infoHTML += `<p><em>No representative information available</em></p>`;
    }
    
    districtInfo.innerHTML = infoHTML;
    // Show the sidebar when district info is displayed
    infoSidebar.classList.add('active');
}

// Add map click handler to return to USA view when clicking on empty space
map.on('click', (e) => {
    // Only if we're not on the USA view and clicked on empty space
    if (stateSelect.value && !allDistrictsLayer) {
        // Small delay to ensure this doesn't interfere with feature clicks
        setTimeout(() => {
            const clickPoint = e.containerPoint;
            const size = map.getSize();
            
            // Check if click was on map background (not on any features)
            const elements = document.elementsFromPoint(clickPoint.x, clickPoint.y);
            const clickedOnFeature = elements.some(el => 
                el.classList.contains('leaflet-interactive') || 
                el.classList.contains('leaflet-popup')
            );
            
            if (!clickedOnFeature) {
                // Return to USA view
                stateSelect.value = '';
                loadUSAMap();
            }
        }, 100);
    }
});

// Get selected lookup method
function getSelectedLookupMethod() {
    const selected = document.querySelector('input[name="lookupMethod"]:checked');
    return selected ? selected.value : 'census';
}

// Address search functionality with method selection
async function searchAddress(query) {
    if (!query || query.length < 3) {
        searchResults.innerHTML = '';
        return;
    }
    
    const method = getSelectedLookupMethod();
    
    try {
        if (method === 'census') {
            // Use Census geocoding API
            const response = await fetch(`/ssddmap/api/geocode-census?address=${encodeURIComponent(query)}`);
            const results = await response.json();
            
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
                return;
            }
            
            searchResults.innerHTML = results.map(result => `
                <div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}">
                    <div class="address">${result.display_name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Source: U.S. Census Bureau</div>
                </div>
            `).join('');
            
            // Add click handlers
            searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lon = parseFloat(item.dataset.lon);
                    showAddressOnMap(lat, lon, item.querySelector('.address').textContent);
                    searchResults.innerHTML = '';
                    addressInput.value = '';
                });
            });
        } else {
            // Use ZIP+4 method
            const addressParts = parseAddress(query);
            if (!addressParts) {
                searchResults.innerHTML = '<div class="search-result-item">Please enter a complete address</div>';
                return;
            }
            
            setLoading(true);
            const response = await fetch(`/ssddmap/api/address-lookup-zip4?${new URLSearchParams({
                street: addressParts.street,
                city: addressParts.city,
                state: addressParts.state,
                zip: addressParts.zip || '',
                method: method
            })}`);
            
            const result = await response.json();
            
            if (method === 'both') {
                // Show comparison results
                showComparisonResults(result);
            } else if (result.success) {
                // Show single result
                await showZip4Result(result);
            } else {
                searchResults.innerHTML = `<div class="search-result-item">Error: ${result.error || 'Address not found'}</div>`;
            }
        }
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="search-result-item">Error searching address</div>';
    } finally {
        setLoading(false);
    }
}

// Parse address string
function parseAddress(addressStr) {
    const parts = addressStr.split(',').map(s => s.trim());
    if (parts.length < 3) return null;
    
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(' ');
    const state = stateZip[0];
    const zip = stateZip[1] || '';
    
    return { street, city, state, zip };
}

// Show ZIP+4 lookup result
async function showZip4Result(result) {
    const districtCode = `${result.district.state}-${result.district.district}`;
    
    // Fetch member information for this district
    let memberInfo = '';
    try {
        const distResponse = await fetch(`/ssddmap/api/district/${result.district.state}/${result.district.district}`);
        const distData = await distResponse.json();
        if (distData.member) {
            memberInfo = `<div style="margin-top: 5px; color: var(--text-primary);"><strong>Rep:</strong> ${distData.member.name} (${distData.member.party})</div>`;
        }
    } catch (error) {
        console.error('Error fetching member info:', error);
    }
    
    searchResults.innerHTML = `
        <div class="search-result-item">
            <div class="address">${result.standardized ? 
                `${result.standardized.street}, ${result.standardized.city}, ${result.standardized.state} ${result.standardized.zip5}-${result.standardized.zip4}` : 
                'Standardized address'}</div>
            <div class="district">Congressional District: <strong>${districtCode}</strong></div>
            ${memberInfo}
            ${result.district.countyFips ? `<div>County FIPS: ${result.district.countyFips}</div>` : ''}
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                Source: ${result.source || result.method || 'ZIP+4 lookup'}
            </div>
        </div>
    `;
    
    // If we have coordinates, show on map
    if (result.standardized?.lat && result.standardized?.lon) {
        setTimeout(() => {
            showAddressOnMap(result.standardized.lat, result.standardized.lon, 
                            result.standardized.street);
        }, 100);
    }
}

// Show comparison results
function showComparisonResults(result) {
    const { zip4Method, censusMethod, comparison } = result;
    
    let confidenceClass = 'confidence-low';
    if (comparison.confidence >= 90) confidenceClass = 'confidence-high';
    else if (comparison.confidence >= 70) confidenceClass = 'confidence-medium';
    
    const comparisonHTML = `
        <div class="comparison-results">
            <div class="comparison-header">
                <h4>Address Lookup Comparison</h4>
                <span class="confidence-badge ${confidenceClass}">
                    ${comparison.match ? 'MATCH' : 'MISMATCH'} - ${comparison.confidence}% Confidence
                </span>
            </div>
            
            <div class="method-results">
                <div class="method-result">
                    <h5>ZIP+4 Method</h5>
                    ${zip4Method.success ? `
                        <p class="district-code">${zip4Method.district.state}-${zip4Method.district.district}</p>
                        <p>County FIPS: ${zip4Method.district.countyFips || 'N/A'}</p>
                        <p>ZIP+4: ${zip4Method.standardized?.zip5}-${zip4Method.standardized?.zip4}</p>
                    ` : `
                        <p style="color: var(--vote-no);">Failed: ${zip4Method.error || 'Unknown error'}</p>
                    `}
                </div>
                
                <div class="method-result">
                    <h5>Geographic Method</h5>
                    ${censusMethod.district?.found ? `
                        <p class="district-code">${censusMethod.district.state}-${censusMethod.district.district}</p>
                        ${censusMember ? `<p><strong>Rep:</strong> ${censusMember.name} (${censusMember.party})</p>` : ''}
                        <p>County: ${censusMethod.county?.name || 'N/A'}, ${censusMethod.county?.state || ''}</p>
                        <p>County FIPS: ${censusMethod.county?.geoid || 'N/A'}</p>
                    ` : `
                        <p style="color: var(--vote-no);">No district found</p>
                    `}
                </div>
            </div>
            
            ${!comparison.match ? `
                <div style="margin-top: 15px; padding: 10px; background: var(--bg-hover); border-radius: 6px;">
                    <p style="color: var(--vote-no); font-weight: 600;">⚠️ Methods returned different districts</p>
                    <p style="font-size: 12px; margin-top: 5px;">This may indicate an address near a district boundary or a data discrepancy.</p>
                </div>
            ` : ''}
        </div>
    `;
    
    searchResults.innerHTML = comparisonHTML;
    
    // Show on map if we have coordinates
    if (zip4Method.standardized?.lat && zip4Method.standardized?.lon) {
        setTimeout(() => {
            showAddressOnMap(zip4Method.standardized.lat, zip4Method.standardized.lon, 
                            zip4Method.standardized.street);
        }, 100);
    }
}

// Show address on map with marker
async function showAddressOnMap(lat, lon, displayName) {
    // Remove existing marker
    if (addressMarker) {
        map.removeLayer(addressMarker);
    }
    
    // Remove existing distance line and boundary marker
    if (distanceLine) {
        map.removeLayer(distanceLine);
    }
    if (boundaryMarker) {
        map.removeLayer(boundaryMarker);
    }
    
    // Create custom icon for the marker
    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: var(--accent-primary); width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    // Add marker (we'll update the popup with distance info after finding the district)
    addressMarker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
    addressMarker.bindPopup(`<b>Location:</b><br>${displayName}<br><i>Finding district information...</i>`).openPopup();
    
    // Zoom to location
    map.flyTo([lat, lon], 15, {
        duration: 1.0,
        easeLinearity: 0.5
    });
    
    // Find which district contains this point
    findDistrictForLocation(lat, lon);
}

// Draw a line from the searched point to the nearest district boundary
function drawDistanceLine(fromLat, fromLon, toGeoJSON, districtInfo = null, color = '#2563eb') {
    // Remove existing line and marker if any
    if (distanceLine) {
        map.removeLayer(distanceLine);
    }
    if (boundaryMarker) {
        map.removeLayer(boundaryMarker);
    }
    
    // Parse the GeoJSON point
    let toCoords;
    if (typeof toGeoJSON === 'string') {
        toCoords = JSON.parse(toGeoJSON).coordinates;
    } else {
        toCoords = toGeoJSON.coordinates;
    }
    
    // Create line
    const latlngs = [
        [fromLat, fromLon],
        [toCoords[1], toCoords[0]] // GeoJSON is [lon, lat]
    ];
    
    distanceLine = L.polyline(latlngs, {
        color: color,
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 10',
        dashOffset: '0'
    }).addTo(map);
    
    // Add animated dash effect
    let offset = 0;
    const animateDash = () => {
        offset = (offset + 1) % 20;
        distanceLine.setStyle({ dashOffset: offset.toString() });
        if (map.hasLayer(distanceLine)) {
            requestAnimationFrame(animateDash);
        }
    };
    animateDash();
    
    // Add a small circle at the boundary point
    boundaryMarker = L.circleMarker([toCoords[1], toCoords[0]], {
        radius: 5,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
    
    // Add popup with district info
    if (districtInfo) {
        const districtLabel = districtInfo.isAtLarge ? 'At-Large' : districtInfo.district;
        let popupContent = `<div style="min-width: 200px;">`;
        popupContent += `<b>District Boundary</b><br>`;
        popupContent += `<b>SSDD:</b> ${districtInfo.state}-${districtLabel}<br>`;
        if (districtInfo.member) {
            popupContent += `<b>Rep:</b> ${districtInfo.member.name} (${districtInfo.member.party})`;
        }
        popupContent += `</div>`;
        boundaryMarker.bindPopup(popupContent);
    } else {
        boundaryMarker.bindPopup('Nearest point on district boundary');
    }
}

// Find which congressional district contains a point
async function findDistrictForLocation(lat, lon) {
    setLoading(true);
    
    try {
        // Use the new endpoint that finds both district and county
        const response = await fetch(`/ssddmap/api/find-location?lat=${lat}&lon=${lon}`);
        const result = await response.json();
        
        if (result.district && result.district.found) {
            // Load that state/district
            stateSelect.value = result.district.state;
            await loadStateDistricts(result.district.state);
            
            // Highlight the specific district
            setTimeout(() => {
                // Find and click the district in the list
                const districtItems = document.querySelectorAll('.district-item');
                districtItems.forEach(item => {
                    if (item.dataset.state === result.district.state && 
                        item.dataset.district === result.district.district) {
                        item.click();
                    }
                });
            }, 500);
            
            // Update info with detailed district and county information
            const districtLabel = result.district.isAtLarge ? 'At-Large' : result.district.district;
            let infoHTML = `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="font-size: 16px; font-weight: 600; color: var(--accent-primary); margin-bottom: 10px;">
                        📍 Location Found
                    </p>
                    <p><strong>State:</strong> ${result.district.state}</p>
                    <p><strong>Congressional District:</strong> ${districtLabel}</p>
            `;
            
            // Add member information first if available
            if (result.district.member) {
                infoHTML += `
                    <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; margin: 10px 0;">
                        <p style="font-weight: 600; color: var(--text-primary);">Representative:</p>
                        <p style="font-size: 18px; margin: 5px 0;">${result.district.member.name}</p>
                        <p style="color: var(--text-secondary);">
                            <span class="party-badge ${result.district.member.party === 'R' ? 'republican' : result.district.member.party === 'D' ? 'democrat' : 'independent'}">
                                ${result.district.member.party === 'R' ? 'Republican' : result.district.member.party === 'D' ? 'Democrat' : 'Independent'}
                            </span>
                        </p>
                    </div>
                `;
            }
            
            // Add distance to boundary information
            if (result.district.distanceToBoundary) {
                const distance = result.district.distanceToBoundary;
                if (distance.meters > 0) {
                    infoHTML += `
                        <p style="color: var(--accent-secondary); margin-top: 8px;">
                            <strong>Distance to District Boundary:</strong><br>
                            ${distance.meters.toLocaleString()} meters (${distance.miles} miles)
                        </p>
                    `;
                } else {
                    infoHTML += `
                        <p style="color: var(--accent-secondary); margin-top: 8px;">
                            <strong>Location is on the district boundary</strong>
                        </p>
                    `;
                }
            }
            
            if (result.county && result.county.found) {
                infoHTML += `
                    <p><strong>County:</strong> ${result.county.name}, ${result.county.state}</p>
                `;
            }
            
            infoHTML += `</div>`;
            
            const existingInfo = districtInfo.innerHTML;
            districtInfo.innerHTML = infoHTML + existingInfo;
            
            // Draw line to nearest boundary point if available
            if (result.district.closestBoundaryPoint && result.district.distanceToBoundary.meters > 0) {
                drawDistanceLine(lat, lon, result.district.closestBoundaryPoint, result.district);
            }
            
            // Update marker popup with distance info
            if (addressMarker) {
                const distance = result.district.distanceToBoundary;
                let popupContent = `<div style="min-width: 250px;">`;
                popupContent += `<b>📍 ${displayName}</b><br>`;
                popupContent += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">`;
                popupContent += `<b>Congressional District:</b> ${result.district.state}-${districtLabel}<br>`;
                
                if (result.district.member) {
                    popupContent += `<b>Representative:</b> ${result.district.member.name} (${result.district.member.party})<br>`;
                }
                
                if (distance.meters > 0) {
                    popupContent += `<b>Distance to boundary:</b> ${distance.meters.toLocaleString()}m (${distance.miles} mi)`;
                } else {
                    popupContent += `<b>Location:</b> On district boundary`;
                }
                popupContent += `</div></div>`;
                addressMarker.setPopupContent(popupContent);
            }
        } else if (result.nearestDistrict) {
            // Location not found in any district, but show nearest
            const nearest = result.nearestDistrict;
            let infoHTML = `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="color: var(--party-republican);">
                        ⚠️ Location not found in any congressional district
                    </p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                        This might be outside the US or in a body of water
                    </p>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <p><strong>Nearest Congressional District:</strong></p>
                        <p>${nearest.state}-${nearest.district} (${nearest.stateName})</p>
                        <p><strong>Distance:</strong> ${nearest.distance.meters.toLocaleString()} meters (${nearest.distance.miles} miles)</p>
                        ${nearest.memberName ? `<p><strong>Representative:</strong> ${nearest.memberName} (${nearest.party})</p>` : ''}
                    </div>
                </div>
            `;
            
            districtInfo.innerHTML = infoHTML + districtInfo.innerHTML;
            
            // Draw line to nearest district
            if (nearest.closestPoint) {
                drawDistanceLine(lat, lon, nearest.closestPoint, '#ff9800');
            }
        } else {
            // Location not found in any district
            districtInfo.innerHTML = `
                <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="color: var(--party-republican);">
                        ⚠️ Location not found in any congressional district
                    </p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                        This might be outside the US or in a body of water
                    </p>
                </div>
            ` + districtInfo.innerHTML;
        }
    } catch (error) {
        console.error('Error finding district:', error);
        districtInfo.innerHTML = `
            <div style="background: var(--bg-card); padding: 15px; border-radius: 8px;">
                <p style="color: var(--party-republican);">Error finding district</p>
            </div>
        `;
    } finally {
        setLoading(false);
    }
}

// Event listeners for search
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        searchAddress(addressInput.value);
    });
}

if (addressInput) {
    addressInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchAddress(addressInput.value);
        } else if (autosuggestToggle && autosuggestToggle.checked) {
            // Only autosuggest if toggle is checked
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchAddress(addressInput.value);
            }, 500);
        } else {
            // Clear results if autosuggest is disabled
            clearTimeout(searchTimeout);
            searchResults.innerHTML = '';
        }
    });
}

// Clear search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.address-search')) {
        searchResults.innerHTML = '';
    }
});

// Handle autosuggest toggle
if (autosuggestToggle) {
    autosuggestToggle.addEventListener('change', (e) => {
        if (!e.target.checked) {
            // Clear any existing search results when autosuggest is disabled
            clearTimeout(searchTimeout);
            searchResults.innerHTML = '';
        }
    });
}

// Load and display county boundaries
async function loadCountyBoundaries() {
    try {
        setLoading(true);
        
        const response = await fetch('/ssddmap/api/county-boundaries');
        const data = await response.json();
        
        // Clear existing county labels
        countyLabelMarkers.forEach(marker => map.removeLayer(marker));
        countyLabelMarkers = [];
        
        // Create county layer with subtle styling
        countyLayer = L.geoJSON(data, {
            pane: 'districts',
            style: {
                fillColor: 'transparent',
                fillOpacity: 0,
                color: '#666666',
                weight: 0.5,
                opacity: 0.6,
                dashArray: '2, 4'
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                
                // Create a permanent label for each county
                const center = layer.getBounds().getCenter();
                const countyName = props.NAME;
                
                // Create a divIcon for the county name
                const labelIcon = L.divIcon({
                    className: 'county-name-label',
                    html: `<div class="county-name-text" style="
                        font-size: 11px; 
                        font-weight: 600; 
                        color: #4a5568; 
                        text-shadow: 
                            -1px -1px 1px rgba(255,255,255,0.8),
                            1px -1px 1px rgba(255,255,255,0.8),
                            -1px 1px 1px rgba(255,255,255,0.8),
                            1px 1px 1px rgba(255,255,255,0.8),
                            0 0 3px rgba(255,255,255,0.9);
                        white-space: nowrap;
                        pointer-events: none;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        opacity: 0.8;
                    ">${countyName}</div>`,
                    iconSize: null,
                    iconAnchor: [0, 0]
                });
                
                // Create the label marker
                const labelMarker = L.marker(center, {
                    icon: labelIcon,
                    pane: 'countyLabels',
                    interactive: false
                });
                
                countyLabelMarkers.push(labelMarker);
                
                // Bind tooltip for additional info on hover
                layer.bindTooltip(`${props.NAME} County, ${props.STUSPS}`, {
                    permanent: false,
                    direction: 'center',
                    className: 'county-tooltip'
                });
            }
        });
        
        if (showCounties) {
            countyLayer.addTo(map);
            // Add all county labels
            countyLabelMarkers.forEach(marker => marker.addTo(map));
        }
        
    } catch (error) {
        console.error('Error loading county boundaries:', error);
    } finally {
        setLoading(false);
    }
}

// Toggle county boundaries - REMOVED FROM UI BUT KEPT FOR FUTURE USE
// toggleCountiesBtn.addEventListener('click', async () => {
//     showCounties = !showCounties;
//     toggleCountiesBtn.classList.toggle('active', showCounties);
//     
//     if (showCounties) {
//         toggleCountiesBtn.querySelector('span').textContent = 'Hide Counties';
//         if (!countyLayer) {
//             await loadCountyBoundaries();
//         } else {
//             countyLayer.addTo(map);
//             // Also add county labels
//             countyLabelMarkers.forEach(marker => marker.addTo(map));
//         }
//     } else {
//         toggleCountiesBtn.querySelector('span').textContent = 'Show Counties';
//         if (countyLayer) {
//             map.removeLayer(countyLayer);
//         }
//         // Remove county labels
//         countyLabelMarkers.forEach(marker => map.removeLayer(marker));
//     }
// });

// Get color based on number of representatives
function getRepresentationColor(repCount) {
    // Color scale from light to dark based on representation
    // 1 rep = lightest, 50+ reps = darkest
    const maxReps = 52; // California has the most
    const intensity = Math.min(repCount / maxReps, 1);
    
    // Use a blue-purple gradient
    const hue = 220 + (intensity * 50); // 220 (blue) to 270 (purple)
    const lightness = 70 - (intensity * 50); // 70% to 20%
    const saturation = 60 + (intensity * 20); // 60% to 80%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Load state representation counts
async function loadStateRepCounts() {
    try {
        const response = await fetch('/ssddmap/api/state-rep-counts');
        stateRepCounts = await response.json();
        return stateRepCounts;
    } catch (error) {
        console.error('Error loading state rep counts:', error);
        return {};
    }
}

// Create and display legend
function createRepresentationLegend() {
    const legendScale = document.querySelector('.legend-scale');
    legendScale.innerHTML = '';
    
    // Create legend items
    const legendData = [
        { count: 1, label: '1 representative' },
        { count: 5, label: '5 representatives' },
        { count: 10, label: '10 representatives' },
        { count: 20, label: '20 representatives' },
        { count: 30, label: '30 representatives' },
        { count: 52, label: '50+ representatives' }
    ];
    
    legendData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="legend-color" style="background-color: ${getRepresentationColor(item.count)}"></div>
            <span>${item.label}</span>
        `;
        legendScale.appendChild(div);
    });
}

// Apply representation colors to districts
function applyRepresentationColors() {
    if (!allDistrictsLayer || !stateRepCounts) return;
    
    allDistrictsLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const state = layer.feature.properties.state;
            const repCount = stateRepCounts[state] || 1;
            const color = getRepresentationColor(repCount);
            
            layer.setStyle({
                fillColor: color,
                fillOpacity: 0.7,
                color: '#333',
                weight: 1
            });
        }
    });
}

// Toggle representation view - OLD handler, replaced with change event for toggle switch
/*
toggleRepViewBtn.addEventListener('click', async () => {
    showRepresentationView = !showRepresentationView;
    toggleRepViewBtn.classList.toggle('active', showRepresentationView);
    
    if (showRepresentationView) {
        toggleRepViewBtn.querySelector('span').textContent = 'Hide Representation View';
        
        
        // Load rep counts if not already loaded
        if (!stateRepCounts) {
            await loadStateRepCounts();
        }
        
        // Make sure we're on USA view
        if (!allDistrictsLayer || !map.hasLayer(allDistrictsLayer)) {
            await loadUSAMap();
        }
        
        // Apply colors and show legend
        applyRepresentationColors();
        createRepresentationLegend();
        legendEl.style.display = 'block';
    } else {
        toggleRepViewBtn.querySelector('span').textContent = 'Show by Representation';
        legendEl.style.display = 'none';
        
        // Reset to original colors
        if (allDistrictsLayer) {
            allDistrictsLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties) {
                    const isAtLarge = layer.feature.properties.isAtLarge;
                    layer.setStyle({
                        fillColor: isAtLarge ? '#a855f7' : getStateColor(layer.feature.properties.state),
                        fillOpacity: isAtLarge ? 0.6 : 0.5,
                        color: isAtLarge ? '#c084fc' : '#4a5568',
                        weight: isAtLarge ? 1.5 : 0.8
                    });
                }
            });
        }
    }
});
*/



// Load county political data
async function loadCountyPolitics() {
    try {
        setLoading(true);
        const response = await fetch('/ssddmap/api/county-politics');
        countyPoliticsData = await response.json();
        return countyPoliticsData;
    } catch (error) {
        console.error('Error loading county politics:', error);
        return null;
    } finally {
        setLoading(false);
    }
}

// Apply county political colors
function applyCountyPoliticalColors() {
    if (!countyLayer || !countyPoliticsData) return;
    
    countyLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const state = layer.feature.properties.STUSPS;
            const countyName = layer.feature.properties.NAME;
            const countyKey = `${state}-${countyName}`;
            const countyData = countyPoliticsData.counties[countyKey];
            
            if (countyData) {
                let color, opacity;
                switch(countyData.control) {
                    case 'republican':
                        color = '#ef4444'; // Red
                        opacity = 0.6;
                        break;
                    case 'democrat':
                        color = '#3b82f6'; // Blue
                        opacity = 0.6;
                        break;
                    case 'split':
                        color = '#a855f7'; // Purple
                        opacity = 0.6;
                        break;
                    case 'independent':
                        color = '#8b5cf6'; // Violet
                        opacity = 0.6;
                        break;
                    default:
                        color = '#6b7280'; // Gray
                        opacity = 0.3;
                }
                
                layer.setStyle({
                    fillColor: color,
                    fillOpacity: opacity,
                    color: '#333',
                    weight: 0.5
                });
                
                // Update tooltip with political info
                let tooltipContent = `<strong>${countyName} County, ${state}</strong><br>`;
                if (countyData.control === 'split') {
                    tooltipContent += `Split between parties<br>`;
                    countyData.districts.forEach(d => {
                        tooltipContent += `${d.district}: ${d.party}<br>`;
                    });
                } else if (countyData.control !== 'noData') {
                    tooltipContent += `${countyData.control.charAt(0).toUpperCase() + countyData.control.slice(1)} control<br>`;
                    if (countyData.districts.length > 0) {
                        tooltipContent += `Rep: ${countyData.districts[0].member}`;
                    }
                } else {
                    tooltipContent += `No data available`;
                }
                
                layer.bindTooltip(tooltipContent, {
                    permanent: false,
                    direction: 'center',
                    className: 'county-tooltip'
                });
            }
        }
    });
}

// Create county politics legend
function createCountyPoliticsLegend() {
    const legendScale = document.querySelector('.legend-scale');
    legendScale.innerHTML = '';
    
    // Add statistics if available
    if (countyPoliticsData && countyPoliticsData.stats) {
        const stats = countyPoliticsData.stats;
        const statsDiv = document.createElement('div');
        statsDiv.className = 'county-stats';
        statsDiv.innerHTML = `
            <h5>County Control (${countyPoliticsData.total} total)</h5>
            <p style="font-size: 12px; margin: 5px 0;">
                <span style="color: #ef4444;">Republican: ${stats.republican}</span><br>
                <span style="color: #3b82f6;">Democrat: ${stats.democrat}</span><br>
                <span style="color: #a855f7;">Split: ${stats.split}</span><br>
                <span style="color: #6b7280;">No data: ${stats.noData}</span>
            </p>
            <hr style="margin: 10px 0; border-color: var(--border-color);">
        `;
        legendScale.appendChild(statsDiv);
    }
    
    const legendData = [
        { control: 'republican', color: '#ef4444', label: 'Republican District(s)' },
        { control: 'democrat', color: '#3b82f6', label: 'Democratic District(s)' },
        { control: 'split', color: '#a855f7', label: 'Split Control' },
        { control: 'independent', color: '#8b5cf6', label: 'Independent' },
        { control: 'noData', color: '#6b7280', label: 'No Data' }
    ];
    
    legendData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="legend-color" style="background-color: ${item.color}"></div>
            <span>${item.label}</span>
        `;
        legendScale.appendChild(div);
    });
}

// Toggle county politics view - REMOVED FROM UI BUT KEPT FOR FUTURE USE
// toggleCountyPoliticsBtn.addEventListener('click', async () => {
//     showCountyPolitics = !showCountyPolitics;
//    toggleCountyPoliticsBtn.classList.toggle('active', showCountyPolitics);
//    
//    if (showCountyPolitics) {
//        toggleCountyPoliticsBtn.querySelector('span').textContent = 'Hide County Politics';
//        
        // Turn off other views
//        if (showRepresentationView) {
//            showRepresentationView = false;
//            toggleRepViewBtn.classList.remove('active');
//            toggleRepViewBtn.querySelector('span').textContent = 'Show by Representation';
//        }
//        if (showVoteView) {
//            showVoteView = false;
//            toggleVoteViewBtn.classList.remove('active');
//            toggleVoteViewBtn.querySelector('span').textContent = 'Show Voting Pattern';
//        }
//        
        // County display has been removed from UI
        // County politics data will be shown in a different way
//        
        // Load politics data if not already loaded
//        if (!countyPoliticsData) {
//            await loadCountyPolitics();
//        }
//        
        // Apply colors and show legend
//        applyCountyPoliticalColors();
//        createCountyPoliticsLegend();
//        legendEl.style.display = 'block';
//    } else {
//        toggleCountyPoliticsBtn.querySelector('span').textContent = 'Show County Politics';
//        legendEl.style.display = 'none';
//        
        // Remove FIPS labels if they exist
//        removeFIPSLabels();
//        
        // Reset county colors
//        if (countyLayer) {
//            countyLayer.eachLayer(layer => {
//                layer.setStyle({
//                    fillColor: 'transparent',
//                    fillOpacity: 0,
//                    color: '#666666',
//                    weight: 0.5,
//                    opacity: 0.6,
//                    dashArray: '2, 4'
//                });
//            });
//        }
//    }
//});

// Apply FIPS code display to counties
function applyCountyFIPSDisplay() {
    if (!countyLayer) return;
    
    countyLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const fipsCode = props.GEOID || 'N/A';
            const countyName = props.NAME;
            const state = props.STUSPS;
            
            // Style for FIPS display - light background with visible text
            layer.setStyle({
                fillColor: '#f3f4f6',
                fillOpacity: 0.7,
                color: '#1f2937',
                weight: 1
            });
            
            // Create a permanent label with FIPS code
            const center = layer.getBounds().getCenter();
            const label = L.divIcon({
                className: 'fips-label',
                html: `<div style="background: rgba(255,255,255,0.9); padding: 2px 4px; border-radius: 3px; border: 1px solid #333; font-size: 10px; font-weight: bold; color: #000;">${fipsCode}</div>`,
                iconSize: [50, 20],
                iconAnchor: [25, 10]
            });
            
            // Store the label marker so we can remove it later
            if (!layer.fipsMarker) {
                layer.fipsMarker = L.marker(center, { icon: label });
            }
            layer.fipsMarker.addTo(map);
            
            // Update tooltip
            const tooltipContent = `<strong>${countyName} County, ${state}</strong><br>FIPS Code: ${fipsCode}`;
            layer.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'center',
                className: 'county-tooltip'
            });
        }
    });
}

// Remove FIPS labels
function removeFIPSLabels() {
    if (!countyLayer) return;
    
    countyLayer.eachLayer(layer => {
        if (layer.fipsMarker) {
            map.removeLayer(layer.fipsMarker);
        }
    });
}

// Create FIPS legend
function createFIPSLegend() {
    const legendScale = document.querySelector('.legend-scale');
    legendScale.innerHTML = '';
    
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = `
        <h5>County FIPS Codes</h5>
        <p style="font-size: 12px; margin: 10px 0;">
            FIPS (Federal Information Processing Standards) codes uniquely identify counties.<br><br>
            Format: <strong>SSCCC</strong><br>
            SS = State code (2 digits)<br>
            CCC = County code (3 digits)<br><br>
            Example: 06037 = Los Angeles County, CA
        </p>
    `;
    legendScale.appendChild(legendDiv);
}

// Toggle county FIPS view - REMOVED FROM UI BUT KEPT FOR FUTURE USE
// toggleCountyFIPSBtn.addEventListener('click', async () => {
//     showCountyFIPS = !showCountyFIPS;
//     toggleCountyFIPSBtn.classList.toggle('active', showCountyFIPS);
//     
//     if (showCountyFIPS) {
//         toggleCountyFIPSBtn.querySelector('span').textContent = 'Hide County FIPS';
//         
//         // Turn off other views
//         if (showRepresentationView) {
//             showRepresentationView = false;
//             toggleRepViewBtn.classList.remove('active');
//             toggleRepViewBtn.querySelector('span').textContent = 'Show by Representation';
//         }
//         if (showVoteView) {
//             showVoteView = false;
//             toggleVoteViewBtn.classList.remove('active');
//             toggleVoteViewBtn.querySelector('span').textContent = 'Show Voting Pattern';
//         }
//         if (showCountyPolitics) {
//             showCountyPolitics = false;
//             toggleCountyPoliticsBtn.classList.remove('active');
//             toggleCountyPoliticsBtn.querySelector('span').textContent = 'Show County Politics';
//         }
//         
//         // Make sure counties are visible
//         if (!showCounties) {
//             showCounties = true;
//             toggleCountiesBtn.classList.add('active');
//             toggleCountiesBtn.querySelector('span').textContent = 'Hide Counties';
//             if (!countyLayer) {
//                 await loadCountyBoundaries();
//             } else {
//                 countyLayer.addTo(map);
//             }
//         }
//         
//         // Apply FIPS display and show legend
//         applyCountyFIPSDisplay();
//         createFIPSLegend();
//         legendEl.style.display = 'block';
//     } else {
//         toggleCountyFIPSBtn.querySelector('span').textContent = 'Show County FIPS';
//         legendEl.style.display = 'none';
//         
//         // Remove FIPS labels
//         removeFIPSLabels();
//         
//         // Reset county colors
//         if (countyLayer) {
//             countyLayer.eachLayer(layer => {
//                 layer.setStyle({
//                     fillColor: 'transparent',
//                     fillOpacity: 0,
//                     color: '#666666',
//                     weight: 0.5,
//                     opacity: 0.6,
//                     dashArray: '2, 4'
//                 });
//             });
//         }
//     }
// });

// Configuration UI handlers
// const configureBtn = document.getElementById('configureBtn'); // Old button removed
let configModal, saveConfigBtn, testUspsBtn, testSmartyBtn, authorizeUspsBtn;

function initializeConfigHandlers() {
    configModal = document.getElementById('configModal');
    saveConfigBtn = document.getElementById('saveConfigBtn');
    testUspsBtn = document.getElementById('testUspsBtn');
    testSmartyBtn = document.getElementById('testSmartyBtn');
    authorizeUspsBtn = document.getElementById('authorizeUspsBtn');

// Check configuration status on load
async function checkConfigStatus() {
    try {
        const response = await fetch('/ssddmap/api/config-status');
        const status = await response.json();
        
        // Update USPS status indicator
        const uspsStatus = document.getElementById('uspsStatus');
        if (status.usps.configured && status.usps.tokenValid) {
            uspsStatus.textContent = '✅';
            uspsStatus.title = 'USPS configured and authorized';
        } else if (status.usps.configured) {
            uspsStatus.textContent = '🔑';
            uspsStatus.title = 'USPS configured but needs authorization';
        } else {
            uspsStatus.textContent = '⚠️';
            uspsStatus.title = 'USPS not configured';
        }
        
        // If Census is default, check the radio button
        if (status.defaultMethod === 'census') {
            document.querySelector('input[value="census"]').checked = true;
        }
        
        return status;
    } catch (error) {
        console.error('Error checking config status:', error);
    }
}

// Configuration button handler
// Old configure button handler - now handled by configBtn in toolbar
// configureBtn.addEventListener('click', () => {
//     configModal.style.display = 'block';
// });

    // Save configuration
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
    const config = {
        uspsClientId: document.getElementById('uspsClientId').value,
        uspsClientSecret: document.getElementById('uspsClientSecret').value,
        smartyAuthId: document.getElementById('smartyAuthId').value,
        smartyAuthToken: document.getElementById('smartyAuthToken').value
    };
    
    try {
        const response = await fetch('/ssddmap/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            alert('Configuration saved! You may need to authorize USPS.');
            await checkConfigStatus();
            
            // Show authorize button if USPS is configured
            if (config.uspsClientId && config.uspsClientSecret) {
                authorizeUspsBtn.style.display = 'inline-block';
            }
        }
    } catch (error) {
        alert('Error saving configuration: ' + error.message);
    }
});
}

    // Test USPS connection
    if (testUspsBtn) {
        testUspsBtn.addEventListener('click', async () => {
    const resultDiv = document.getElementById('uspsTestResult');
    resultDiv.textContent = 'Testing USPS connection...';
    resultDiv.className = 'test-result';
    resultDiv.style.display = 'block';
    
    const status = await checkConfigStatus();
    if (!status.usps.configured) {
        resultDiv.textContent = 'Please enter USPS credentials first';
        resultDiv.className = 'test-result error';
    } else if (!status.usps.tokenValid) {
        resultDiv.textContent = 'USPS configured but needs authorization';
        resultDiv.className = 'test-result error';
        authorizeUspsBtn.style.display = 'inline-block';
    } else {
        resultDiv.textContent = 'USPS connection successful!';
        resultDiv.className = 'test-result success';
    }
});
}

    // Authorize USPS OAuth
    if (authorizeUspsBtn) {
        authorizeUspsBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/ssddmap/api/usps-auth');
        const data = await response.json();
        window.open(data.authUrl, '_blank');
    } catch (error) {
        alert('Error initiating USPS authorization: ' + error.message);
    }
});
}

    // Test Smarty connection
    if (testSmartyBtn) {
        testSmartyBtn.addEventListener('click', async () => {
    const resultDiv = document.getElementById('smartyTestResult');
    const authId = document.getElementById('smartyAuthId').value;
    const authToken = document.getElementById('smartyAuthToken').value;
    
    if (!authId || !authToken) {
        resultDiv.textContent = 'Please enter Smarty credentials first';
        resultDiv.className = 'test-result error';
        resultDiv.style.display = 'block';
        return;
    }
    
    resultDiv.textContent = 'Testing Smarty connection...';
    resultDiv.className = 'test-result';
    resultDiv.style.display = 'block';
    
    // In a real implementation, you'd test the API here
    setTimeout(() => {
        resultDiv.textContent = 'Smarty credentials saved (test on first use)';
        resultDiv.className = 'test-result success';
    }, 1000);
});
}

// Check cache status
async function checkCacheStatus() {
    try {
        const response = await fetch('/ssddmap/api/cache-status');
        const status = await response.json();
        
        // Handle new format
        const members = status.members || status; // Backwards compatibility
        
        if (members.hasCachedData) {
            const ageText = members.cacheAgeHours < 1 ? 'less than 1 hour' : 
                           members.cacheAgeHours === 1 ? '1 hour' : 
                           `${members.cacheAgeHours} hours`;
            
            let statusText = `Members: ${ageText} old (${members.count} cached)`;
            
            // Add county and district info if available
            if (status.counties) {
                statusText += ` | Counties: ${status.counties.count || 0} cached`;
            }
            if (status.districts) {
                statusText += ` | Districts: ${status.districts.count || 0} cached`;
            }
            
            cacheStatusEl.textContent = statusText;
            cacheStatusEl.style.color = members.cacheAgeHours > 20 ? '#ff9800' : '#4CAF50';
        } else {
            cacheStatusEl.textContent = 'No cached data available';
            cacheStatusEl.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Error checking cache status:', error);
        cacheStatusEl.textContent = 'Error checking cache status';
        cacheStatusEl.style.color = '#f44336';
    }
}

// Refresh cache
async function refreshCache() {
    if (!confirm('This will refresh all House member data from house.gov. Continue?')) {
        return;
    }
    
    setLoading(true);
    refreshCacheBtn.disabled = true;
    cacheStatusEl.textContent = 'Refreshing data...';
    cacheStatusEl.style.color = '#2196F3';
    
    try {
        const response = await fetch('/ssddmap/api/refresh-members-cache', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            cacheStatusEl.textContent = `Data refreshed! ${result.memberCount} members loaded`;
            cacheStatusEl.style.color = '#4CAF50';
            
            // Reload the member data in the UI
            await loadHouseMembers();
            
            // Refresh current view if showing districts
            if (selectedState) {
                await loadDistricts(selectedState);
            }
        } else {
            throw new Error(result.error || 'Refresh failed');
        }
    } catch (error) {
        console.error('Error refreshing cache:', error);
        cacheStatusEl.textContent = 'Error refreshing data';
        cacheStatusEl.style.color = '#f44336';
    } finally {
        setLoading(false);
        refreshCacheBtn.disabled = false;
        
        // Check status again after a delay
        setTimeout(checkCacheStatus, 2000);
    }
}

// Add event listener for refresh button
if (refreshCacheBtn) {
    refreshCacheBtn.addEventListener('click', refreshCache);
}

// Add event listener for map style selector
if (mapStyleSelect) {
    mapStyleSelect.addEventListener('change', (e) => {
        setMapStyle(e.target.value);
    });
}

// Add event listeners for new UI elements
if (dataManageBtn) {
    dataManageBtn.addEventListener('click', () => {
        dataModal.style.display = 'flex';
    });
}

if (configBtn) {
    configBtn.addEventListener('click', () => {
        configModal.style.display = 'flex';
    });
}

if (closeSidebar) {
    closeSidebar.addEventListener('click', () => {
        infoSidebar.classList.remove('active');
    });
}

// Handle toggle switch for representation view
if (toggleRepViewBtn) {
    toggleRepViewBtn.addEventListener('change', async () => {
        showRepresentationView = toggleRepViewBtn.checked;
    
        if (showRepresentationView) {
            legendEl.style.display = 'block';
            await loadRepresentationView();
        } else {
            legendEl.style.display = 'none';
            if (selectedState) {
                await loadDistricts(selectedState);
            } else {
                await loadUSAMap();
            }
        }
    });
}

// Initialize
async function initialize() {
    // Clear the address input field to prevent browser autofill
    if (addressInput) {
        addressInput.value = '';
        // Force clear after a small delay to catch delayed autofill
        setTimeout(() => {
            addressInput.value = '';
        }, 100);
    }
    
    loadStates();
    checkConfigStatus();
    checkCacheStatus();
    
    // Load House members first, then the USA map
    await fetchHouseMembers();
    loadUSAMap();
}

// Start initialization with error handling
initialize().catch(error => {
    console.error('Initialization error:', error);
    // Hide loading on error
    if (loadingEl) {
        loadingEl.classList.remove('show');
    }
});

// Check cache status every 5 minutes
setInterval(checkCacheStatus, 300000);

// Batch processing functionality
const batchProcessBtn = document.getElementById('batchProcessBtn');
const batchModal = document.getElementById('batchModal');
const closeModal = document.querySelector('.close');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const processBatchBtn = document.getElementById('processBatchBtn');
const csvFileInput = document.getElementById('csvFile');
const batchAddressesTextarea = document.getElementById('batchAddresses');
const batchProgress = document.getElementById('batchProgress');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');

// Open batch modal (keeping functionality but button removed from UI)
if (batchProcessBtn) {
    batchProcessBtn.addEventListener('click', () => {
        batchModal.style.display = 'flex';
        batchAddressesTextarea.value = '';
        batchProgress.style.display = 'none';
    });
}

// Close modal
if (closeModal) {
    closeModal.addEventListener('click', () => {
        batchModal.style.display = 'none';
    });
}

// Close data and config modals with X button
document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === batchModal) {
        batchModal.style.display = 'none';
    }
    if (event.target === dataModal) {
        dataModal.style.display = 'none';
    }
    if (event.target === configModal) {
        configModal.style.display = 'none';
    }
});

// Upload CSV button click
uploadCsvBtn.addEventListener('click', () => {
    csvFileInput.click();
});

// Handle CSV file selection
csvFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const csv = e.target.result;
            // Parse CSV and extract addresses
            const lines = csv.split('\n').filter(line => line.trim());
            const addresses = [];
            
            // Simple CSV parsing - assumes first column is address or combines multiple columns
            lines.forEach((line, index) => {
                if (index === 0 && line.toLowerCase().includes('address')) {
                    // Skip header if it contains 'address'
                    return;
                }
                
                // Handle quoted values and commas within quotes
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                if (parts.length > 0) {
                    // If multiple columns, try to combine them as address parts
                    const address = parts.map(p => p.replace(/^"|"$/g, '')).join(', ');
                    if (address.trim()) {
                        addresses.push(address.trim());
                    }
                }
            });
            
            // Add addresses to textarea
            batchAddressesTextarea.value = addresses.join('\n');
        };
        reader.readAsText(file);
    }
});

// Process batch addresses
processBatchBtn.addEventListener('click', async () => {
    const addressText = batchAddressesTextarea.value.trim();
    if (!addressText) {
        alert('Please enter addresses to process');
        return;
    }
    
    // Parse addresses from textarea
    const addresses = addressText.split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);
    
    if (addresses.length === 0) {
        alert('No valid addresses found');
        return;
    }
    
    // Get selected lookup method
    const method = getSelectedLookupMethod();
    
    // Show progress
    batchProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = `Processing 0 of ${addresses.length} addresses...`;
    
    // Disable buttons during processing
    processBatchBtn.disabled = true;
    uploadCsvBtn.disabled = true;
    
    try {
        // Create batch request
        const batchId = Date.now().toString();
        const response = await fetch('/ssddmap/api/batch-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                batchId,
                addresses,
                method
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to process batch');
        }
        
        const results = await response.json();
        
        // Update progress to 100%
        progressFill.style.width = '100%';
        progressText.textContent = `Completed! Processed ${results.processed} addresses.`;
        
        // Show results after a short delay
        setTimeout(() => {
            showBatchResults(results);
        }, 1000);
        
    } catch (error) {
        console.error('Batch processing error:', error);
        alert('Error processing batch: ' + error.message);
    } finally {
        // Re-enable buttons
        processBatchBtn.disabled = false;
        uploadCsvBtn.disabled = false;
    }
});

// Show batch results
function showBatchResults(results) {
    // Close batch modal
    batchModal.style.display = 'none';
    
    // Create results summary
    let summaryHtml = `
        <div class="batch-results-summary">
            <h4>Batch Processing Results</h4>
            <p>Batch ID: ${results.batchId}</p>
            <p>Total Processed: ${results.processed}</p>
            <p>Success: ${results.success}</p>
            <p>Failed: ${results.failed}</p>
    `;
    
    if (results.method === 'both') {
        summaryHtml += `
            <p>Matches: ${results.matches}</p>
            <p>Mismatches: ${results.mismatches}</p>
        `;
    }
    
    summaryHtml += `
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="downloadBatchResults('${results.batchId}')">
                    Download CSV Report
                </button>
            </div>
        </div>
    `;
    
    // Update district info panel with results
    districtInfo.innerHTML = summaryHtml;
    
    // Show the info sidebar
    if (infoSidebar) {
        infoSidebar.classList.add('active');
    }
}

// Download batch results as CSV
window.downloadBatchResults = async (batchId) => {
    try {
        const response = await fetch(`/ssddmap/api/batch-results/${batchId}/download`);
        if (!response.ok) {
            throw new Error('Failed to download results');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_results_${batchId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading results: ' + error.message);
    }
};

// Show ZIP codes for a district (placeholder for future implementation)
window.showDistrictZipCodes = function(state, district) {
    // Create a modal or info display
    const zipInfo = `
        <div style="background: var(--bg-card); padding: 20px; border-radius: 8px; margin-bottom: 10px;">
            <h3 style="color: var(--accent-primary); margin-bottom: 15px;">ZIP Codes for ${state}-${district}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 15px;">
                Each congressional district contains hundreds to thousands of ZIP codes and tens of thousands of ZIP+4 codes.
            </p>
            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="font-weight: 600; margin-bottom: 10px;">Why isn't a full list shown?</p>
                <ul style="margin-left: 20px; color: var(--text-secondary);">
                    <li>Districts can span 500+ ZIP codes</li>
                    <li>Each ZIP code can have 100+ ZIP+4 extensions</li>
                    <li>ZIP codes often cross district boundaries</li>
                    <li>The data would be too large for a popup</li>
                </ul>
            </div>
            <p style="color: var(--text-secondary);">
                <strong>To find a specific ZIP code's district:</strong><br>
                Use the address search above with any address in that ZIP code.
            </p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <p style="font-size: 12px; color: var(--text-tertiary);">
                    <em>Note: A comprehensive ZIP code database integration is planned for a future update.</em>
                </p>
            </div>
        </div>
    `;
    
    // Update the district info panel with ZIP code information
    const districtInfo = document.getElementById('districtInfo');
    const existingContent = districtInfo.innerHTML;
    districtInfo.innerHTML = zipInfo + existingContent;
    
    // Scroll to the info panel
    districtInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
} // End of initializeRestOfApp function
