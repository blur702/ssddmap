// Initialize map with smooth zoom animations
const map = L.map('map', {
    zoomAnimation: true,
    zoomAnimationThreshold: 4,
    fadeAnimation: true,
    markerZoomAnimation: true
}).setView([39.8283, -98.5795], 4); // Center of USA

// Add dark theme base tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Global variables
let currentLayer = null;
let allDistrictsLayer = null;
let stateDistrictsLayer = null;
let selectedState = null;
let selectedDistrict = null;
let addressMarker = null;
let searchTimeout = null;
let countyLayer = null;
let showCounties = false;
let showRepresentationView = false;
let stateRepCounts = null;
let showVoteView = false;
let currentBillVotes = null;
let houseMembersCache = null;

// Elements
const stateSelect = document.getElementById('stateSelect');
const districtList = document.getElementById('districtList');
const viewUSABtn = document.getElementById('viewUSA');
const loadingEl = document.getElementById('loading');
const districtInfo = document.getElementById('districtInfo');
const addressInput = document.getElementById('addressInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const toggleCountiesBtn = document.getElementById('toggleCounties');
const toggleRepViewBtn = document.getElementById('toggleRepView');
const legendEl = document.getElementById('legend');
const billSelect = document.getElementById('billSelect');
const toggleVoteViewBtn = document.getElementById('toggleVoteView');

// Show/hide loading indicator
function setLoading(show) {
    loadingEl.classList.toggle('show', show);
}

// Fetch House members data
async function fetchHouseMembers() {
    if (houseMembersCache) return houseMembersCache;
    
    try {
        const response = await fetch('/api/members');
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
        const response = await fetch('/api/states');
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
        const response = await fetch(`/api/state/${stateCode}`);
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
        const response = await fetch(`/api/district/${stateCode}/${districtNumber}`);
        const data = await response.json();
        
        // Clear current layer
        if (currentLayer) {
            map.removeLayer(currentLayer);
        }
        
        // Add new district layer
        const fillColor = data.isAtLarge ? '#a855f7' : '#3b82f6'; // Purple for at-large, blue for regular
        currentLayer = L.geoJSON(data.geojson, {
            style: {
                fillColor: fillColor,
                fillOpacity: 0.7,
                color: data.isAtLarge ? '#c084fc' : '#60a5fa',
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
                }
                
                popupContent += `</div>`;
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
        
        // Fit map to district bounds with smooth animation
        map.flyToBounds(currentLayer.getBounds(), { 
            padding: [50, 50],
            duration: 0.6,
            easeLinearity: 0.5
        });
        
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
        
        const response = await fetch(`/api/state/${stateCode}`);
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
                const distResponse = await fetch(`/api/district/${district.state}/${district.district}`);
                const distData = await distResponse.json();
                
                const layer = L.geoJSON(distData.geojson, {
                    style: {
                        fillColor: getDistrictColor(parseInt(district.district)),
                        fillOpacity: 0.6,
                        color: '#4a5568',
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
                        } else {
                            popupContent += `<p>Congressional District ${district.district}</p>`;
                        }
                        
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
                            },
                            mouseout: (e) => {
                                e.target.setStyle({
                                    fillOpacity: 0.6,
                                    weight: 1.5,
                                    color: '#4a5568'
                                });
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
        
        // Check if we already have the USA layer
        if (allDistrictsLayer) {
            allDistrictsLayer.addTo(map);
            map.setView([39.8283, -98.5795], 4);
            return;
        }
        
        const response = await fetch('/api/all-districts');
        const data = await response.json();
        
        // First, fetch all member data
        const members = await fetchHouseMembers();
        
        allDistrictsLayer = L.geoJSON(data, {
            style: (feature) => {
                const isAtLarge = feature.properties.isAtLarge;
                return {
                    fillColor: isAtLarge ? '#a855f7' : getStateColor(feature.properties.state),
                    fillOpacity: isAtLarge ? 0.6 : 0.5,
                    color: isAtLarge ? '#c084fc' : '#4a5568',
                    weight: isAtLarge ? 1.5 : 0.8
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
                } else {
                    popupContent += `<p>No representative data</p>`;
                }
                
                popupContent += `
                        <p style="font-size: 12px; color: var(--text-secondary);">Click to view details</p>
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
stateSelect.addEventListener('change', (e) => {
    if (e.target.value) {
        loadStateDistricts(e.target.value);
    }
});

viewUSABtn.addEventListener('click', () => {
    loadUSAMap();
});

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

// Address search functionality
async function searchAddress(query) {
    if (!query || query.length < 3) {
        searchResults.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
            return;
        }
        
        searchResults.innerHTML = results.map(result => `
            <div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}">
                <div class="address">${result.display_name}</div>
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
    } catch (error) {
        console.error('Geocoding error:', error);
        searchResults.innerHTML = '<div class="search-result-item">Error searching address</div>';
    }
}

// Show address on map with marker
async function showAddressOnMap(lat, lon, displayName) {
    // Remove existing marker
    if (addressMarker) {
        map.removeLayer(addressMarker);
    }
    
    // Create custom icon for the marker
    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: var(--accent-primary); width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    // Add marker
    addressMarker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
    addressMarker.bindPopup(`<b>Location:</b><br>${displayName}`).openPopup();
    
    // Zoom to location
    map.flyTo([lat, lon], 15, {
        duration: 1.0,
        easeLinearity: 0.5
    });
    
    // Find which district contains this point
    findDistrictForLocation(lat, lon);
}

// Find which congressional district contains a point
async function findDistrictForLocation(lat, lon) {
    setLoading(true);
    
    try {
        // Use the new endpoint that finds both district and county
        const response = await fetch(`/api/find-location?lat=${lat}&lon=${lon}`);
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
            
            if (result.county && result.county.found) {
                infoHTML += `
                    <p><strong>County:</strong> ${result.county.name}, ${result.county.state}</p>
                `;
            }
            
            if (result.district.member) {
                infoHTML += `
                    <p style="margin-top: 10px;"><strong>Representative:</strong></p>
                    <p>${result.district.member.name} (${result.district.member.party})</p>
                `;
            }
            
            infoHTML += `</div>`;
            
            const existingInfo = districtInfo.innerHTML;
            districtInfo.innerHTML = infoHTML + existingInfo;
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
searchBtn.addEventListener('click', () => {
    searchAddress(addressInput.value);
});

addressInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        searchAddress(addressInput.value);
    } else {
        // Debounce search
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchAddress(addressInput.value);
        }, 500);
    }
});

// Clear search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.address-search')) {
        searchResults.innerHTML = '';
    }
});

// Load and display county boundaries
async function loadCountyBoundaries() {
    try {
        setLoading(true);
        
        const response = await fetch('/api/county-boundaries');
        const data = await response.json();
        
        // Create county layer with subtle styling
        countyLayer = L.geoJSON(data, {
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
                layer.bindTooltip(`${props.name} County`, {
                    permanent: false,
                    direction: 'center',
                    className: 'county-tooltip'
                });
            }
        });
        
        if (showCounties) {
            countyLayer.addTo(map);
        }
        
    } catch (error) {
        console.error('Error loading county boundaries:', error);
    } finally {
        setLoading(false);
    }
}

// Toggle county boundaries
toggleCountiesBtn.addEventListener('click', async () => {
    showCounties = !showCounties;
    toggleCountiesBtn.classList.toggle('active', showCounties);
    
    if (showCounties) {
        toggleCountiesBtn.querySelector('span').textContent = 'Hide Counties';
        if (!countyLayer) {
            await loadCountyBoundaries();
        } else {
            countyLayer.addTo(map);
        }
    } else {
        toggleCountiesBtn.querySelector('span').textContent = 'Show Counties';
        if (countyLayer) {
            map.removeLayer(countyLayer);
        }
    }
});

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
        const response = await fetch('/api/state-rep-counts');
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

// Toggle representation view
toggleRepViewBtn.addEventListener('click', async () => {
    showRepresentationView = !showRepresentationView;
    toggleRepViewBtn.classList.toggle('active', showRepresentationView);
    
    if (showRepresentationView) {
        toggleRepViewBtn.querySelector('span').textContent = 'Hide Representation View';
        
        // Turn off vote view if it's on
        if (showVoteView) {
            showVoteView = false;
            toggleVoteViewBtn.classList.remove('active');
            toggleVoteViewBtn.querySelector('span').textContent = 'Show Voting Pattern';
        }
        
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

// Load bill voting data
async function loadBillVotes(billId) {
    try {
        setLoading(true);
        const response = await fetch(`/api/bill-votes/${billId}`);
        const data = await response.json();
        currentBillVotes = data;
        return data;
    } catch (error) {
        console.error('Error loading bill votes:', error);
        return null;
    } finally {
        setLoading(false);
    }
}

// Apply vote colors to districts
function applyVoteColors() {
    if (!allDistrictsLayer || !currentBillVotes) return;
    
    allDistrictsLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const state = layer.feature.properties.state;
            const district = layer.feature.properties.district;
            const voteKey = `${state}-${parseInt(district)}`;
            const voteData = currentBillVotes.districtVotes[voteKey];
            
            if (voteData) {
                let color;
                switch(voteData.vote) {
                    case 'YES':
                        color = '#22c55e'; // Green
                        break;
                    case 'NO':
                        color = '#ef4444'; // Red
                        break;
                    case 'PRESENT':
                        color = '#6b7280'; // Gray
                        break;
                    default:
                        color = '#374151'; // Dark gray
                }
                
                layer.setStyle({
                    fillColor: color,
                    fillOpacity: 0.7,
                    color: '#333',
                    weight: 1
                });
                
                // Update popup with vote info
                const popupContent = `
                    <div class="district-popup">
                        <h4>${state}-${district}</h4>
                        <p><strong>${voteData.member}</strong> (${voteData.party})</p>
                        <p>Vote: <strong style="color: ${color}">${voteData.vote}</strong></p>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }
    });
}

// Create vote legend
function createVoteLegend() {
    const legendScale = document.querySelector('.legend-scale');
    legendScale.innerHTML = '';
    
    const legendData = [
        { vote: 'YES', color: '#22c55e', label: 'Voted Yes' },
        { vote: 'NO', color: '#ef4444', label: 'Voted No' },
        { vote: 'PRESENT', color: '#6b7280', label: 'Present' },
        { vote: 'NOT VOTING', color: '#374151', label: 'Not Voting' }
    ];
    
    // Add bill info
    if (currentBillVotes) {
        const billInfo = document.createElement('div');
        billInfo.className = 'bill-info';
        billInfo.innerHTML = `
            <h5>${currentBillVotes.bill.number}</h5>
            <p style="font-size: 12px; margin: 5px 0;">${currentBillVotes.bill.title}</p>
            <p style="font-size: 11px; color: var(--text-secondary);">
                Yes: ${currentBillVotes.bill.totalYes} | No: ${currentBillVotes.bill.totalNo}
            </p>
            <hr style="margin: 10px 0; border-color: var(--border-color);">
        `;
        legendScale.appendChild(billInfo);
    }
    
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

// Event listener for bill selection
billSelect.addEventListener('change', async (e) => {
    const billId = e.target.value;
    
    if (billId) {
        const voteData = await loadBillVotes(billId);
        if (voteData) {
            toggleVoteViewBtn.style.display = 'block';
        }
    } else {
        toggleVoteViewBtn.style.display = 'none';
        showVoteView = false;
        toggleVoteViewBtn.classList.remove('active');
        toggleVoteViewBtn.querySelector('span').textContent = 'Show Voting Pattern';
        legendEl.style.display = 'none';
        
        // Reset colors
        if (allDistrictsLayer) {
            loadUSAMap();
        }
    }
});

// Toggle vote view
toggleVoteViewBtn.addEventListener('click', async () => {
    showVoteView = !showVoteView;
    toggleVoteViewBtn.classList.toggle('active', showVoteView);
    
    if (showVoteView) {
        toggleVoteViewBtn.querySelector('span').textContent = 'Hide Voting Pattern';
        
        // Turn off representation view if it's on
        if (showRepresentationView) {
            showRepresentationView = false;
            toggleRepViewBtn.classList.remove('active');
            toggleRepViewBtn.querySelector('span').textContent = 'Show by Representation';
        }
        
        // Make sure we're on USA view
        if (!allDistrictsLayer || !map.hasLayer(allDistrictsLayer)) {
            await loadUSAMap();
        }
        
        // Apply vote colors and show legend
        applyVoteColors();
        createVoteLegend();
        legendEl.style.display = 'block';
    } else {
        toggleVoteViewBtn.querySelector('span').textContent = 'Show Voting Pattern';
        legendEl.style.display = 'none';
        
        // Reset to original colors
        if (allDistrictsLayer) {
            loadUSAMap();
        }
    }
});

// Initialize
loadStates();