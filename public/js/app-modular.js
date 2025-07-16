/**
 * Main Application Module - Coordinates all components
 */
import { MapManager } from './map.js';
import { SearchManager } from './search.js';
import { UIManager } from './ui.js';
import { DataManager } from './data.js';
import { ValidationManager } from './validation.js';
import { AddressModalEnhanced } from './addressModalEnhanced.js';
import { StateSelector } from './stateSelector.js';
import { ReportingModule } from './modules/ReportingModule.js';

class CongressionalDistrictsApp {
    constructor() {
        this.map = new MapManager();
        this.search = new SearchManager();
        this.ui = new UIManager();
        this.data = new DataManager();
        this.validation = new ValidationManager();
        this.addressModal = null;
        this.stateSelector = null;
        this.reporting = new ReportingModule();
        
        this.currentState = null;
        this.currentDistrict = null;
        this.isRepView = true; // Default to rep view
        this.districtLayers = {};
        this.currentGlowLayer = null;
    }
    
    /**
     * Initialize the application
     */
    async initialize() {
        console.log('Initializing Congressional Districts App...');
        
        try {
            // Initialize UI first
            this.ui.initialize();
            
            // Initialize map
            const mapInitialized = this.map.initialize('map');
            if (!mapInitialized) {
                throw new Error('Failed to initialize map');
            }
            
            // Initialize search with UI elements
            this.search.initialize(this.ui.getElements());
            
            // Initialize validation
            this.validation.initialize(this.map, this.ui);
            
            // Initialize enhanced address modal
            this.addressModal = new AddressModalEnhanced(this.map, this.ui);
            window.addressModal = this.addressModal; // Make accessible globally
            
            // Initialize state selector
            this.stateSelector = new StateSelector(this.map, this.data, this.ui);
            this.stateSelector.setApp(this); // Give StateSelector reference to main app
            window.stateSelector = this.stateSelector; // Make accessible globally for testing
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Load initial data
            await this.loadInitialData();
            
            // Check configuration status
            await this.checkConfigStatus();
            
            console.log('App initialization complete');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.ui.showNotification('Error initializing application', 'error');
        }
    }
    
    /**
     * Setup event handlers between modules
     */
    setupEventHandlers() {
        // UI Events
        this.ui.on('onMapStyleChange', (style) => {
            this.map.setStyle(style);
        });
        
        // State change is now handled by StateSelector module
        // this.ui.on('onStateChange', (state) => {
        //     this.loadStateDistricts(state);
        // });
        
        this.ui.on('onViewUSA', () => {
            this.map.viewUSA();
            this.stateSelector.reset();
            this.stateSelector.showAllStates();
        });
        
        this.ui.on('onToggleRepView', (enabled) => {
            this.isRepView = enabled;
            this.updateDistrictColors();
        });
        
        this.ui.on('onRefreshCache', async () => {
            await this.refreshMemberCache();
        });
        
        this.ui.on('onSaveConfig', async (config) => {
            await this.saveConfiguration(config);
        });
        
        this.ui.on('onLocationMethodChange', (method) => {
            this.search.setLocationMethod(method);
        });
        
        // Address form button
        const addressFormBtn = document.getElementById('addressFormBtn');
        if (addressFormBtn) {
            addressFormBtn.addEventListener('click', () => {
                if (this.addressModal) {
                    this.addressModal.show();
                }
            });
        }
        
        // Search Events
        this.search.on('onSearchStart', () => {
            this.ui.showLoading('Searching...');
        });
        
        this.search.on('onSearchComplete', async (result) => {
            this.ui.hideLoading();
            await this.handleSearchResult(result);
        });
        
        this.search.on('onSearchError', (error) => {
            this.ui.hideLoading();
            this.ui.showNotification('Search failed: ' + error.message, 'error');
        });
        
        // Map Events
        this.map.onDistrictClick(async (state, district) => {
            await this.selectDistrict(state, district);
        });
        
        this.map.onDistrictHover((state, district) => {
            // Could show tooltip or highlight
        });
    }
    
    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            this.ui.showLoading('Loading data...');
            
            // States are now loaded by StateSelector module
            // const states = await this.data.fetchStates();
            // this.ui.populateStates(states);
            
            // Load members data first
            await this.data.fetchMembers();
            
            // Load all districts through StateSelector (will use member data for coloring)
            await this.stateSelector.showAllStates();
            
            // Apply initial rep view state
            this.updateDistrictColors();
            
            // Initialize reporting module for data management
            await this.reporting.initialize();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.ui.showNotification('Error loading data', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    /**
     * Load all districts
     */
    async loadAllDistricts() {
        try {
            const districtsData = await this.data.fetchDistricts();
            
            // Clear existing layers from both map and app
            Object.values(this.districtLayers).forEach(layer => {
                this.map.getMap().removeLayer(layer);
            });
            this.districtLayers = {};
            
            // Clear district list since we're showing all states
            this.ui.clearDistrictList();
            
            // Process each district
            districtsData.features.forEach(feature => {
                const state = feature.properties.state;
                const district = feature.properties.district;
                const districtKey = `${state}-${district}`;
                
                // Get member info if rep view is enabled
                let fillColor = '#6b7280';
                if (this.isRepView) {
                    const member = this.data.cache.members[districtKey];
                    if (member) {
                        fillColor = this.data.getPartyColor(member.party);
                    }
                }
                
                // Create layer with click handler
                const layer = this.map.addDistrictLayer(feature, {
                    style: {
                        weight: 1,
                        opacity: 0.8,
                        color: '#444444',
                        fillOpacity: 0.4,
                        fillColor: fillColor
                    },
                    onEachFeature: (feature, layer) => {
                        this.setupDistrictInteraction(feature, layer);
                    }
                });
                
                this.districtLayers[districtKey] = layer;
            });
            
        } catch (error) {
            console.error('Error loading districts:', error);
            throw error;
        }
    }
    
    /**
     * Load districts for a specific state
     * @param {string} state - State abbreviation
     */
    async loadStateDistricts(state) {
        if (!state) {
            await this.loadAllDistricts();
            return;
        }
        
        try {
            this.ui.showLoading(`Loading ${state} districts...`);
            
            const districtsData = await this.data.fetchDistricts(state);
            
            // Clear existing layers from both map and app
            Object.values(this.districtLayers).forEach(layer => {
                this.map.getMap().removeLayer(layer);
            });
            this.districtLayers = {};
            
            // Handle different response formats
            let districts;
            if (Array.isArray(districtsData)) {
                // State-specific endpoint returns array
                districts = districtsData;
            } else if (districtsData.features) {
                // All-districts endpoint returns GeoJSON
                districts = districtsData.features.filter(f => 
                    f.properties.state === state
                );
            } else {
                throw new Error('Unexpected districts data format');
            }
            
            // For state-specific data from array format, we need to filter from all districts
            if (Array.isArray(districtsData)) {
                // Load all districts and filter by state
                const allDistrictsData = await this.data.fetchDistricts();
                if (allDistrictsData && allDistrictsData.features) {
                    districts = allDistrictsData.features.filter(f => 
                        f.properties.state === state
                    );
                } else {
                    throw new Error('Unable to load district geometries');
                }
            }
            
            if (districts && districts.length > 0) {
                // Build district list for sidebar
                const districtListData = [];
                
                // Process GeoJSON features
                districts.forEach(feature => {
                    const district = feature.properties.district;
                    const districtKey = `${state}-${district}`;
                    
                    // Get member info
                    const member = this.data.cache.members[districtKey];
                    
                    // Always use party colors when viewing a specific state
                    let fillColor = '#6b7280'; // Default vacant/unknown color
                    if (member) {
                        fillColor = this.data.getPartyColor(member.party);
                    }
                    
                    // Add to district list
                    districtListData.push({
                        state: state,
                        district: district,
                        member: member
                    });
                    
                    // Create layer
                    const layer = this.map.addDistrictLayer(feature, {
                        style: {
                            weight: 1.5,
                            opacity: 0.9,
                            color: '#333333',
                            fillOpacity: 0.5,
                            fillColor: fillColor
                        },
                        onEachFeature: (feature, layer) => {
                            this.setupDistrictInteraction(feature, layer);
                        }
                    });
                    
                    this.districtLayers[districtKey] = layer;
                });
                
                // Update the district list in sidebar after processing all districts
                this.ui.updateStateDistrictList(state, districtListData);
            }
            
            // Fit map to state bounds
            const allLayers = Object.values(this.districtLayers);
            if (allLayers.length > 0) {
                const group = L.featureGroup(allLayers);
                this.map.fitBounds(group);
            }
            
            this.currentState = state;
            
        } catch (error) {
            console.error('Error loading state districts:', error);
            this.ui.showNotification('Error loading state districts', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    /**
     * Setup district interaction handlers
     * @param {Object} feature - GeoJSON feature
     * @param {L.Layer} layer - Leaflet layer
     */
    setupDistrictInteraction(feature, layer) {
        const state = feature.properties.state;
        const district = feature.properties.district;
        
        // Click handler
        layer.on('click', async () => {
            await this.selectDistrict(state, district);
        });
        
        // Hover handlers
        layer.on('mouseover', (e) => {
            layer.setStyle({
                weight: 3,
                opacity: 1,
                color: '#2563eb'
            });
            
            // Show tooltip
            const member = this.data.cache.members[`${state}-${district}`];
            const tooltipContent = `
                <strong>${state} - District ${district}</strong><br>
                ${member ? `Rep. ${member.name} (${member.party})` : 'No representative data'}
            `;
            
            layer.bindTooltip(tooltipContent, {
                sticky: true,
                direction: 'top'
            }).openTooltip(e.latlng);
        });
        
        layer.on('mouseout', () => {
            // Reset style
            const districtKey = `${state}-${district}`;
            const member = this.data.cache.members[districtKey];
            
            // Determine fill color based on context
            let fillColor = '#6b7280'; // Default vacant/unknown
            if (this.currentState) {
                // When viewing a specific state, always show party colors
                if (member) {
                    fillColor = this.data.getPartyColor(member.party);
                }
            } else if (this.isRepView && member) {
                // When viewing all states with rep view enabled
                fillColor = this.data.getPartyColor(member.party);
            }
            
            layer.setStyle({
                weight: 1.5,
                opacity: 0.9,
                color: '#333333',
                fillColor: fillColor
            });
            
            layer.unbindTooltip();
        });
    }
    
    /**
     * Select district from dropdown
     * @param {string} districtKey - District key (state-district)
     */
    selectDistrictFromDropdown(districtKey) {
        if (!districtKey) {
            // If no district selected, show state info again
            if (this.stateSelector.getCurrentState()) {
                // Get current state districts and show state info
                const currentState = this.stateSelector.getCurrentState();
                // We need to get the district data to show state info
                this.refreshStateInfo(currentState);
            }
            return;
        }
        
        const [state, district] = districtKey.split('-');
        this.selectDistrict(state, district);
    }
    
    /**
     * Refresh state info in sidebar
     * @param {string} stateCode - State abbreviation
     */
    async refreshStateInfo(stateCode) {
        try {
            const response = await fetch(`/ssddmap/api/state/${stateCode}`);
            if (response.ok) {
                const stateData = await response.json();
                const districtListData = stateData.map(district => ({
                    state: stateCode,
                    district: district.district,
                    member: district.member
                }));
                this.ui.updateStateInfo(stateCode, districtListData);
            }
        } catch (error) {
            console.error('Error refreshing state info:', error);
        }
    }
    
    /**
     * Select a district and show its information
     * @param {string} state - State abbreviation
     * @param {string} district - District number
     */
    async selectDistrict(state, district) {
        try {
            const member = await this.data.getMember(state, district);
            
            const districtInfo = {
                state: state,
                district: district,
                representative: member ? {
                    name: member.name,
                    bioguideId: member.bioguideId,
                    party: member.party,
                    photo: member.photo,
                    phone: member.phone,
                    office: member.office,
                    website: member.website,
                    committees: member.committees || []
                } : null
            };
            
            this.ui.updateDistrictInfo(districtInfo);
            
            // Remove previous selection
            if (this.currentDistrict) {
                const prevLayer = this.districtLayers[this.currentDistrict];
                if (prevLayer) {
                    this.resetDistrictStyle(prevLayer, this.currentDistrict);
                }
                // Remove active class from summary items
                document.querySelectorAll('.district-summary-item.active').forEach(item => {
                    item.classList.remove('active');
                });
            }
            
            // Highlight new selection
            const districtKey = `${state}-${district}`;
            const layer = this.districtLayers[districtKey];
            if (layer) {
                // Apply white border with increased weight
                layer.setStyle({
                    weight: 6,
                    color: '#ffffff',
                    opacity: 1,
                    fillOpacity: 0.6
                });
                layer.bringToFront();
            }
            
            // Update dropdown selection
            const dropdown = document.getElementById('districtSelect');
            if (dropdown) {
                dropdown.value = districtKey;
            }
            
            // Add active class to summary item
            const summaryItem = document.querySelector(`.district-summary-item[data-district="${districtKey}"]`);
            if (summaryItem) {
                summaryItem.classList.add('active');
            }
            
            this.currentDistrict = districtKey;
            
        } catch (error) {
            console.error('Error selecting district:', error);
            this.ui.showNotification('Error loading district information', 'error');
        }
    }
    
    /**
     * Reset district style to default
     * @param {L.Layer} layer - The layer to reset
     * @param {string} districtKey - District key (state-district)
     */
    resetDistrictStyle(layer, districtKey) {
        const member = this.data.cache.members[districtKey];
        let fillColor = '#6b7280';
        
        if (this.currentState && member) {
            fillColor = this.data.getPartyColor(member.party);
        } else if (this.isRepView && member) {
            fillColor = this.data.getPartyColor(member.party);
        }
        
        layer.setStyle({
            weight: 1.5,
            opacity: 0.9,
            color: '#333333',
            fillColor: fillColor,
            className: ''
        });
    }
    
    /**
     * Handle search result
     * @param {Object} result - Search result with lat/lon
     */
    async handleSearchResult(result) {
        try {
            // Clear previous markers
            this.map.clearMarkers();
            
            // Add marker at location
            const marker = this.map.addMarker(result.lat, result.lon, {
                title: result.address
            });
            
            // Center map on location
            this.map.getMap().setView([result.lat, result.lon], 10);
            
            // If we have district info from geocoding, select it
            if (result.state && result.district) {
                await this.selectDistrict(result.state, result.district);
            }
            
            // Show address in notification
            this.ui.showNotification(`Found: ${result.address}`, 'success');
            
        } catch (error) {
            console.error('Error handling search result:', error);
            this.ui.showNotification('Error processing search result', 'error');
        }
    }
    
    /**
     * Update district colors based on rep view setting
     */
    updateDistrictColors() {
        console.log('🎨 Updating district colors, isRepView:', this.isRepView);
        Object.entries(this.districtLayers).forEach(([districtKey, layer]) => {
            const member = this.data.cache.members[districtKey];
            const fillColor = this.isRepView && member ? 
                this.data.getPartyColor(member.party) : '#6b7280';
            
            console.log(`District ${districtKey}: member=${member?.name}, party=${member?.party}, color=${fillColor}`);
            
            // Update layer style with proper Leaflet method
            if (layer && layer.setStyle) {
                layer.setStyle({
                    weight: 1,
                    opacity: 0.8,
                    color: '#444444',
                    fillOpacity: 0.4,
                    fillColor: fillColor
                });
            }
        });
    }
    
    /**
     * Check configuration status
     */
    async checkConfigStatus() {
        try {
            const status = await this.data.getConfigStatus();
            
            // Update UI based on status
            if (status.usps) {
                const uspsStatus = document.getElementById('uspsStatus');
                if (uspsStatus) {
                    if (status.usps.configured && status.usps.tokenValid) {
                        uspsStatus.textContent = '✅ Configured';
                        uspsStatus.className = 'method-status status-success';
                    } else if (status.usps.configured) {
                        uspsStatus.textContent = '🔑 Needs auth';
                        uspsStatus.className = 'method-status status-warning';
                    } else {
                        uspsStatus.textContent = '⚠️ Not configured';
                        uspsStatus.className = 'method-status status-warning';
                    }
                }
            }
            
        } catch (error) {
            console.error('Error checking config status:', error);
        }
    }
    
    /**
     * Save configuration
     * @param {Object} config - Configuration object
     */
    async saveConfiguration(config) {
        try {
            this.ui.showLoading('Saving configuration...');
            
            await this.data.saveConfig(config);
            
            this.ui.showNotification('Configuration saved successfully', 'success');
            
            // Re-check status
            await this.checkConfigStatus();
            
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.ui.showNotification('Error saving configuration', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    /**
     * Refresh member cache
     */
    async refreshMemberCache() {
        try {
            this.ui.showLoading('Refreshing member data...');
            
            const result = await this.data.refreshMemberCache();
            
            this.ui.showNotification('Member data refreshed successfully', 'success');
            
            // Reload members and update display
            await this.data.fetchMembers();
            
            if (this.isRepView) {
                this.updateDistrictColors();
            }
            
            // Update reporting module status
            await this.reporting.updateCacheStatus();
            
        } catch (error) {
            console.error('Error refreshing cache:', error);
            this.ui.showNotification('Error refreshing member data', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
    
    /**
     * Get district color based on member party
     * @param {Object} district - District object
     * @returns {string} Hex color code
     */
    getDistrictColor(district) {
        if (!this.isRepView) {
            return '#6b7280';
        }
        
        const districtKey = `${district.state}-${district.district}`;
        const member = this.data.cache.members[districtKey];
        
        if (member) {
            return this.data.getPartyColor(member.party);
        }
        
        return '#6b7280';
    }
    
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new CongressionalDistrictsApp();
    window.app = app; // Make app globally accessible for UI integration
    app.initialize();
    
    // Make app available globally for debugging
    window.congressApp = app;
});