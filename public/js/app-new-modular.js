/**
 * New Modular Application - Uses Core + Plugins Architecture
 */
import { Core } from './core.js';
import { EventBus, PluginManager } from './common.js';
import { StateSelectorPlugin } from './plugins/state-selector-plugin.js';
import { RepViewPlugin } from './plugins/rep-view-plugin.js';
import { DataManager } from './data.js';
import { SearchManager } from './search.js';
import { UIManager } from './ui.js';
import { ValidationManager } from './validation.js';
import { AddressModalEnhanced } from './addressModalEnhanced.js';
import { DistrictInfoModule } from './modules/DistrictInfoModule.js';
import { AddressSearchModule } from './modules/AddressSearchModule.js';
import { BoundaryDistanceModule } from './modules/BoundaryDistanceModule.js';
import { AddressResolutionModule } from './modules/AddressResolutionModule.js';

class ModularCongressionalDistrictsApp {
    constructor() {
        // Core system
        this.eventBus = new EventBus();
        this.core = new Core();
        this.pluginManager = new PluginManager(this.core, this.eventBus);
        
        // Legacy managers (to be converted to plugins later)
        this.data = new DataManager();
        this.search = new SearchManager();
        this.ui = new UIManager();
        this.validation = new ValidationManager();
        this.addressModal = null;
        
        // Modules for sidepanel
        this.districtInfoModule = null;
        this.addressSearchModule = null;
        this.boundaryDistanceModule = null;
        this.addressResolutionModule = null;
        
        // App state
        this.currentState = null;
        this.currentDistrict = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        console.log('🚀 Initializing Modular Congressional Districts App...');
        
        try {
            // Initialize core system
            await this.initializeCore();
            
            // Initialize legacy managers
            await this.initializeLegacyManagers();
            
            // Register and initialize plugins
            await this.initializePlugins();
            
            // Setup core event handlers
            this.setupCoreEventHandlers();
            
            // Load initial data
            await this.loadInitialData();
            
            console.log('✅ Modular app initialization complete');
            
        } catch (error) {
            console.error('❌ Error initializing modular app:', error);
            this.ui.showNotification('Error initializing application', 'error');
        }
    }

    /**
     * Initialize core system
     */
    async initializeCore() {
        console.log('🏗️ Initializing core system...');
        
        // Initialize the map
        this.core.initialize('map', this.eventBus);
        
        console.log('✅ Core system initialized');
    }

    /**
     * Initialize legacy managers (to be converted to plugins later)
     */
    async initializeLegacyManagers() {
        console.log('🔧 Initializing legacy managers...');
        
        // Initialize UI
        this.ui.initialize();
        
        // Initialize address resolution module
        this.addressResolutionModule = new AddressResolutionModule(this.eventBus);
        
        // Initialize search with address resolution module
        this.search.initialize(this.ui.getElements(), this.addressResolutionModule);
        
        // Initialize validation
        this.validation.initialize({ getMap: () => this.core.getMap() }, this.ui);
        
        // Initialize enhanced address modal
        this.addressModal = new AddressModalEnhanced(
            { getMap: () => this.core.getMap() }, 
            this.ui
        );
        window.addressModal = this.addressModal;
        
        // Initialize sidebar modules
        const sidebarElement = document.getElementById('info-sidebar');
        if (sidebarElement) {
            // Initialize boundary distance module first
            this.boundaryDistanceModule = new BoundaryDistanceModule(this.core, this.eventBus);
            
            // Initialize district info module with boundary distance support
            this.districtInfoModule = new DistrictInfoModule(sidebarElement, this.data, this.boundaryDistanceModule);
            
            // Initialize address search module with boundary distance integration
            this.addressSearchModule = new AddressSearchModule(
                sidebarElement, 
                this.data, 
                this.eventBus, 
                this.boundaryDistanceModule
            );
            
            // Setup address search module callbacks as fallback
            this.setupAddressSearchCallbacks();
        }
        
        console.log('✅ Legacy managers initialized');
    }

    /**
     * Register and initialize plugins
     */
    async initializePlugins() {
        console.log('📦 Registering plugins...');
        
        // Register plugins
        const repViewPlugin = new RepViewPlugin(this.core, this.eventBus, this.data);
        const stateSelectorPlugin = new StateSelectorPlugin(this.core, this.eventBus, this.data);
        
        this.pluginManager.register(repViewPlugin);
        this.pluginManager.register(stateSelectorPlugin);
        
        // Initialize all plugins
        await this.pluginManager.initializeAll();
        
        // Make plugins accessible for debugging
        window.repViewPlugin = repViewPlugin;
        window.stateSelectorPlugin = stateSelectorPlugin;
        
        console.log('✅ Plugins initialized');
    }

    /**
     * Setup core event handlers
     */
    setupCoreEventHandlers() {
        console.log('🔗 Setting up core event handlers...');
        
        // District selection handler
        this.eventBus.on('districtClicked', async (data) => {
            await this.selectDistrict(data.state, data.district, data.clickLocation);
        });

        this.eventBus.on('districtSelected', async (data) => {
            await this.selectDistrict(data.state, data.district, data.clickLocation);
        });

        // State info display handler
        this.eventBus.on('stateInfoDisplay', (data) => {
            if (this.districtInfoModule) {
                this.districtInfoModule.displayStateInfo(data.state, data.districts);
            }
        });

        // Address search module event handlers
        this.eventBus.on('focusMapLocation', (data) => {
            this.core.setView(data.lat, data.lon, data.zoom);
        });

        this.eventBus.on('showDistrictDetails', (districtInfo) => {
            if (this.districtInfoModule) {
                this.districtInfoModule.displayDistrictInfo(districtInfo);
            }
        });

        this.eventBus.on('clearSearchInput', () => {
            const searchInput = document.getElementById('addressInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
        });
        
        // District info module event handlers
        this.eventBus.on('centerOnDistrict', async (data) => {
            // Re-select the district to highlight it
            await this.selectDistrict(data.state, data.district);
            
            // Zoom to the district
            const districtKey = `${data.state}-${data.district}`;
            this.core.zoomToDistrict(districtKey);
        });
        
        // Legacy UI events
        this.ui.on('onMapStyleChange', (style) => {
            // Map style changes would be handled by a MapStyle plugin in the future
        });
        
        this.ui.on('onViewUSA', async () => {
            const stateSelector = this.pluginManager.getPlugin('StateSelector');
            if (stateSelector) {
                await stateSelector.reset();
            }
        });
        
        this.ui.on('onToggleRepView', (enabled) => {
            const repView = this.pluginManager.getPlugin('RepView');
            if (repView) {
                repView.setRepView(enabled);
            }
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
        
        // Search events
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
        
        console.log('✅ Core event handlers setup complete');
    }

    /**
     * Setup address search module callbacks as fallback
     */
    setupAddressSearchCallbacks() {
        if (!this.addressSearchModule) return;

        this.addressSearchModule.on('onFocusMap', (lat, lon, zoom) => {
            this.core.setView(lat, lon, zoom);
        });

        this.addressSearchModule.on('onShowDistrictDetails', (districtInfo) => {
            if (this.districtInfoModule) {
                this.districtInfoModule.displayDistrictInfo(districtInfo);
            }
        });

        this.addressSearchModule.on('onClearSearch', () => {
            const searchInput = document.getElementById('addressInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
        });
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            this.ui.showLoading('Loading data...');
            
            // Load member data first
            await this.data.fetchMembers();
            
            // Emit event for plugins
            this.eventBus.emit('memberDataUpdated');
            
            // Load all states through StateSelector plugin
            const stateSelector = this.pluginManager.getPlugin('StateSelector');
            if (stateSelector) {
                await stateSelector.showAllStates();
            }
            
            // Update cache status
            const cacheStatus = await this.data.getCacheStatus();
            this.ui.updateCacheStatus(cacheStatus);
            
            // Check configuration status
            await this.checkConfigStatus();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.ui.showNotification('Error loading data', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Select a district and show its information
     * @param {string} state - State abbreviation
     * @param {string} district - District number
     * @param {Object} clickLocation - Optional click location {lat, lon} for distance calculation
     */
    async selectDistrict(state, district, clickLocation = null) {
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
                } : null,
                clickLocation: clickLocation
            };
            
            // Use new district info module if available, fallback to legacy UI
            if (this.districtInfoModule) {
                await this.districtInfoModule.displayDistrictInfo(districtInfo);
            } else {
                this.ui.updateDistrictInfo(districtInfo);
            }
            
            // Highlight district through core
            const districtKey = `${state}-${district}`;
            this.core.highlightDistrict(districtKey);
            
            // Remove previous highlight
            if (this.currentDistrict && this.currentDistrict !== districtKey) {
                this.core.removeHighlight(this.currentDistrict);
            }
            
            // Update dropdown selection
            const dropdown = document.getElementById('districtSelect');
            if (dropdown) {
                dropdown.value = districtKey;
            }
            
            this.currentDistrict = districtKey;
            
        } catch (error) {
            console.error('Error selecting district:', error);
            this.ui.showNotification('Error loading district information', 'error');
        }
    }

    /**
     * Handle search result
     */
    async handleSearchResult(result) {
        try {
            // Clear previous markers
            this.core.clearMarkers();
            
            // Add marker at location
            const marker = this.core.addMarker(result.lat, result.lon, {
                title: result.address
            });
            
            // Center map on location
            this.core.setView(result.lat, result.lon, 10);
            
            // Use new address search module to display comprehensive SSDD info
            if (this.addressSearchModule) {
                await this.addressSearchModule.displaySearchResult(result);
            } else {
                // Fallback to district selection if no address module
                if (result.state && result.district) {
                    await this.selectDistrict(result.state, result.district);
                }
            }
            
            // Show address in notification
            this.ui.showNotification(`Found: ${result.address}`, 'success');
            
        } catch (error) {
            console.error('Error handling search result:', error);
            this.ui.showNotification('Error processing search result', 'error');
        }
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
            
            // Emit event for plugins
            this.eventBus.emit('memberDataUpdated');
            
            // Update cache status
            const cacheStatus = await this.data.getCacheStatus();
            this.ui.updateCacheStatus(cacheStatus);
            
        } catch (error) {
            console.error('Error refreshing cache:', error);
            this.ui.showNotification('Error refreshing member data', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Get plugin manager (for debugging)
     */
    getPluginManager() {
        return this.pluginManager;
    }

    /**
     * Get core (for debugging)
     */
    getCore() {
        return this.core;
    }

    /**
     * Get event bus (for debugging)
     */
    getEventBus() {
        return this.eventBus;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new ModularCongressionalDistrictsApp();
    app.initialize();
    
    // Make app available globally for debugging
    window.modularApp = app;
    window.congressApp = app; // Keep legacy reference for tests
    
    // Add global function for dropdown district selection (used by UI)
    window.selectDistrictFromDropdown = function(districtKey) {
        if (districtKey && app) {
            const [state, district] = districtKey.split('-');
            app.selectDistrict(state, district);
        }
    };
});