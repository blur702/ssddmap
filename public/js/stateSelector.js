/**
 * State Selector Module
 * Handles state selection functionality and district loading
 */
export class StateSelector {
    constructor(mapManager, dataManager, uiManager) {
        this.map = mapManager;
        this.data = dataManager;
        this.ui = uiManager;
        
        this.currentState = null;
        this.districtLayers = {};
        this.stateDistricts = {};
        this.isLoading = false;
        this.app = null; // Reference to main app
        
        this.init();
    }
    
    setApp(app) {
        this.app = app;
    }
    
    init() {
        // Populate state dropdown
        this.populateStates();
        
        // Set up state change handler
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                this.handleStateChange(e.target.value);
            });
        }
    }
    
    async populateStates() {
        try {
            const states = await this.data.fetchStates();
            const stateSelect = document.getElementById('stateSelect');
            
            if (!stateSelect) return;
            
            console.log('StateSelector: Fetched states:', states);
            
            // Clear existing options except the first one
            stateSelect.innerHTML = '<option value="">All States</option>';
            
            // Add state options
            // Handle both array of codes and array of objects
            if (states && states.length > 0 && typeof states[0] === 'string') {
                // Array of state codes
                states.forEach(stateCode => {
                    const option = document.createElement('option');
                    option.value = stateCode;
                    option.textContent = stateCode;
                    stateSelect.appendChild(option);
                });
            } else if (states && states.length > 0) {
                // Array of state objects
                states.forEach(state => {
                    const option = document.createElement('option');
                    // Handle both formats: state_code or abbreviation
                    const code = state.state_code || state.abbreviation;
                    const name = state.state_name || state.name;
                    option.value = code;
                    option.textContent = name ? `${code} - ${name}` : code;
                    stateSelect.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error('Error populating states:', error);
        }
    }
    
    async handleStateChange(stateCode) {
        if (!stateCode) {
            // Show all states
            this.currentState = null;
            await this.showAllStates();
        } else {
            // Show specific state
            this.currentState = stateCode;
            await this.loadStateDistricts(stateCode);
        }
    }
    
    async showAllStates() {
        try {
            this.ui.showLoading('Loading all districts...');
            
            // Clear existing layers
            this.clearDistrictLayers();
            
            // Load all districts from the all-districts endpoint
            const response = await fetch('/ssddmap/api/all-districts');
            if (!response.ok) throw new Error('Failed to fetch all districts');
            
            const geojsonData = await response.json();
            
            // Add all districts to map
            const layer = L.geoJSON(geojsonData, {
                style: (feature) => this.getDistrictStyle(feature),
                onEachFeature: (feature, layer) => this.setupDistrictInteraction(feature, layer)
            });
            
            layer.addTo(this.map.getMap());
            this.districtLayers['all'] = layer;
            
            // Store all individual district layers in main app if available
            if (this.app && this.app.districtLayers) {
                geojsonData.features.forEach(feature => {
                    const state = feature.properties.state;
                    const district = feature.properties.district;
                    const districtKey = `${state}-${district}`;
                    // Note: we're storing the whole layer, but districts can access their features
                    this.app.districtLayers[districtKey] = layer;
                });
            }
            
            // Fit map to USA bounds
            this.map.viewUSA();
            
            // Clear district list in sidebar
            this.ui.clearDistrictList();
            
        } catch (error) {
            console.error('Error loading all districts:', error);
            this.ui.showNotification('Error loading districts', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    async loadStateDistricts(stateCode) {
        try {
            this.ui.showLoading(`Loading ${stateCode} districts...`);
            
            // Clear existing layers
            this.clearDistrictLayers();
            
            // Fetch state-specific data
            const response = await fetch(`/ssddmap/api/state/${stateCode}`);
            if (!response.ok) throw new Error('Failed to fetch state districts');
            
            const stateData = await response.json();
            
            // Store the state data with member info
            this.stateDistricts[stateCode] = stateData;
            
            // Now fetch the geometry from all-districts endpoint
            const geoResponse = await fetch('/ssddmap/api/all-districts');
            if (!geoResponse.ok) throw new Error('Failed to fetch district geometries');
            
            const allDistrictsGeoJSON = await geoResponse.json();
            
            // Filter to just this state's features
            const stateFeatures = allDistrictsGeoJSON.features.filter(feature => 
                feature.properties.state === stateCode
            );
            
            // Create a map of district numbers to member info
            const memberMap = {};
            stateData.forEach(district => {
                memberMap[district.district] = district.member;
            });
            
            // Build district list for sidebar
            const districtListData = [];
            
            // Process each district
            stateFeatures.forEach(feature => {
                const districtNum = feature.properties.district;
                const member = memberMap[districtNum];
                
                // Add member info to feature properties
                feature.properties.member = member;
                
                // Get color based on party
                let fillColor = '#6b7280'; // Default vacant/unknown
                if (member && member.party) {
                    fillColor = this.data.getPartyColor(member.party);
                }
                
                // Add to district list
                districtListData.push({
                    state: stateCode,
                    district: districtNum,
                    member: member
                });
                
                // Create layer
                const layer = L.geoJSON(feature, {
                    style: {
                        weight: 1.5,
                        opacity: 0.9,
                        color: '#333333',
                        fillOpacity: 0.5,
                        fillColor: fillColor
                    },
                    onEachFeature: (feature, layer) => this.setupDistrictInteraction(feature, layer)
                });
                
                layer.addTo(this.map.getMap());
                const districtKey = `${stateCode}-${districtNum}`;
                this.districtLayers[districtKey] = layer;
                
                // Also store in main app's districtLayers if available
                if (this.app && this.app.districtLayers) {
                    this.app.districtLayers[districtKey] = layer;
                }
            });
            
            // Update state info in sidebar
            this.ui.updateStateInfo(stateCode, districtListData);
            
            // Update district dropdown
            this.ui.updateStateDistrictList(stateCode, districtListData);
            
            // Fit map to state bounds
            const allLayers = Object.values(this.districtLayers);
            if (allLayers.length > 0) {
                const group = L.featureGroup(allLayers);
                this.map.getMap().fitBounds(group.getBounds(), {
                    padding: [50, 50]
                });
            }
            
        } catch (error) {
            console.error('Error loading state districts:', error);
            this.ui.showNotification('Error loading state districts', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    clearDistrictLayers() {
        Object.values(this.districtLayers).forEach(layer => {
            this.map.getMap().removeLayer(layer);
        });
        this.districtLayers = {};
        
        // Also clear in main app if available
        if (this.app && this.app.districtLayers) {
            this.app.districtLayers = {};
        }
    }
    
    getDistrictStyle(feature) {
        const state = feature.properties.state;
        const district = feature.properties.district;
        const member = feature.properties.member;
        
        let fillColor = '#6b7280'; // Default
        
        if (member && member.party) {
            fillColor = this.data.getPartyColor(member.party);
        }
        
        return {
            weight: 1,
            opacity: 0.7,
            color: '#333333',
            fillOpacity: 0.4,
            fillColor: fillColor
        };
    }
    
    setupDistrictInteraction(feature, layer) {
        const state = feature.properties.state;
        const district = feature.properties.district;
        const member = feature.properties.member;
        
        // Create popup content
        let popupContent = `<div class="district-popup">`;
        popupContent += `<h3>${state}-${district}</h3>`;
        
        if (member) {
            popupContent += `
                <div class="member-info">
                    <img src="${member.photo}" alt="${member.name}" class="member-photo" onerror="this.src='/ssddmap/images/placeholder.png'">
                    <div class="member-details">
                        <h4>${member.name} (${member.party})</h4>
                        <p>📞 ${member.phone}</p>
                        <p>🏢 ${member.office}</p>
                        <p><a href="${member.website}" target="_blank">Website</a></p>
                    </div>
                </div>
            `;
            
            if (member.committees && member.committees.length > 0) {
                popupContent += '<div class="committees"><strong>Committees:</strong><ul>';
                member.committees.forEach(committee => {
                    popupContent += `<li>${committee.name} (${committee.role})</li>`;
                });
                popupContent += '</ul></div>';
            }
        } else {
            popupContent += '<p>No representative data available</p>';
        }
        
        popupContent += '</div>';
        
        layer.bindPopup(popupContent, {
            maxWidth: 400,
            className: 'district-popup-container'
        });
        
        // Hover effects
        layer.on('mouseover', function(e) {
            layer.setStyle({
                weight: 3,
                opacity: 1,
                fillOpacity: 0.7
            });
            
            // Show tooltip with basic info
            const tooltipContent = member ? 
                `${state}-${district}: ${member.name} (${member.party})` : 
                `${state}-${district}`;
            
            layer.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'auto'
            }).openTooltip();
        });
        
        layer.on('mouseout', function(e) {
            layer.setStyle(this.getDistrictStyle(feature));
            layer.unbindTooltip();
        }.bind(this));
        
        // Click to open popup
        layer.on('click', function(e) {
            layer.openPopup();
        });
    }
    
    getCurrentState() {
        return this.currentState;
    }
    
    getDistrictLayers() {
        return this.districtLayers;
    }
    
    getMapCenter() {
        return this.map.getMap().getCenter();
    }
    
    getMapBounds() {
        return this.map.getMap().getBounds();
    }
    
    reset() {
        this.currentState = null;
        document.getElementById('stateSelect').value = '';
        this.clearDistrictLayers();
        this.ui.clearDistrictList();
    }
}