/**
 * State Selector Plugin - Handles state selection and district loading
 * Completely isolated module that communicates through the event bus
 */
import { BasePlugin, CommonUtils } from '../common.js';

export class StateSelectorPlugin extends BasePlugin {
  constructor (core, eventBus, dataManager) {
    super('StateSelector', core, eventBus);
    this.dataManager = dataManager;
    this.currentState = null;
    this.stateDropdown = null;
    this.districtDropdown = null;
    this.sidebarContainer = null;
  }

  /**
     * Initialize the plugin
     */
  async initialize () {
    console.log('🗺️ Initializing StateSelector plugin...');

    // Find UI elements
    this.stateDropdown = document.getElementById('stateSelect');
    this.districtDropdown = document.getElementById('districtSelect');
    this.sidebarContainer = document.getElementById('sidebar-content');

    if (!this.stateDropdown) {
      throw new Error('State dropdown not found');
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load initial state data
    await this.loadStates();

    // Subscribe to core events
    this.subscribeToEvents();

    this.isInitialized = true;
    console.log('✅ StateSelector plugin initialized');
  }

  /**
     * Setup event listeners
     */
  setupEventListeners () {
    // State dropdown change
    this.stateDropdown.addEventListener('change', async (e) => {
      const state = e.target.value;
      if (state) {
        await this.selectState(state);
      } else {
        await this.showAllStates();
      }
    });

    // District dropdown change
    if (this.districtDropdown) {
      this.districtDropdown.addEventListener('change', (e) => {
        const districtKey = e.target.value;
        if (districtKey) {
          const { state, district } = CommonUtils.parseDistrictKey(districtKey);
          this.eventBus.emit('districtSelected', { state, district, districtKey });
        } else {
          // Show state info again
          if (this.currentState) {
            this.eventBus.emit('stateSelected', { state: this.currentState });
          }
        }
      });
    }
  }

  /**
     * Subscribe to core events
     */
  subscribeToEvents () {
    // Listen for rep view changes to update colors
    this.eventBus.on('repViewToggled', async (data) => {
      if (this.currentState) {
        await this.selectState(this.currentState);
      } else {
        await this.showAllStates();
      }
    });

    // Listen for member data updates
    this.eventBus.on('memberDataUpdated', async () => {
      if (this.currentState) {
        await this.selectState(this.currentState);
      } else {
        await this.showAllStates();
      }
    });
  }

  /**
     * Load states into dropdown
     */
  async loadStates () {
    try {
      const states = await this.dataManager.fetchStates();

      // Clear existing options
      this.stateDropdown.innerHTML = '<option value="">All States</option>';

      // Add state options
      states.forEach(state => {
        const option = document.createElement('option');
        option.value = state.abbreviation;
        option.textContent = state.name;
        this.stateDropdown.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading states:', error);
      throw error;
    }
  }

  /**
     * Show all states (default view)
     */
  async showAllStates () {
    try {
      console.log('🗺️ Loading all states...');

      // Clear current state
      this.currentState = null;
      this.stateDropdown.value = '';

      // Clear district dropdown
      this.clearDistrictDropdown();

      // Clear sidebar
      this.clearSidebar();

      // Clear existing layers
      this.core.clearDistrictLayers();

      // Load all districts from API
      const districtsData = await this.dataManager.fetchDistricts();

      // Process each district feature
      districtsData.features.forEach(feature => {
        this.addDistrictToMap(feature);
      });

      // Fit map to all districts
      this.core.viewUSA();

      // Emit event
      this.eventBus.emit('allStatesLoaded', { districtCount: districtsData.features.length });
    } catch (error) {
      console.error('Error loading all states:', error);
      throw error;
    }
  }

  /**
     * Select a specific state
     */
  async selectState (stateCode) {
    try {
      console.log(`🗺️ Selecting state: ${stateCode}`);

      this.currentState = stateCode;
      this.stateDropdown.value = stateCode;

      // Clear existing layers
      this.core.clearDistrictLayers();

      // Load state districts
      const stateData = await this.dataManager.fetchDistricts(stateCode);

      // Handle different response formats
      let districts;
      if (Array.isArray(stateData)) {
        // State-specific endpoint returns array - need geometries
        const allDistricts = await this.dataManager.fetchDistricts();
        districts = allDistricts.features.filter(f => f.properties.state === stateCode);
      } else if (stateData.features) {
        districts = stateData.features.filter(f => f.properties.state === stateCode);
      } else {
        throw new Error('Unexpected districts data format');
      }

      // Add districts to map
      districts.forEach(feature => {
        this.addDistrictToMap(feature);
      });

      // Fit map to state
      if (districts.length > 0) {
        const layers = districts.map(feature => {
          const districtKey = CommonUtils.getDistrictKey(
            feature.properties.state,
            feature.properties.district
          );
          return this.core.getDistrictLayers()[districtKey];
        }).filter(layer => layer);

        if (layers.length > 0) {
          const group = L.featureGroup(layers);
          this.core.fitBounds(group.getBounds());
        }
      }

      // Update UI
      await this.updateStateUI(stateCode, districts);

      // Emit event
      this.eventBus.emit('stateSelected', {
        state: stateCode,
        districts: districts.length
      });
    } catch (error) {
      console.error('Error selecting state:', error);
      throw error;
    }
  }

  /**
     * Add district to map through core
     */
  addDistrictToMap (feature) {
    const state = feature.properties.state;
    const district = feature.properties.district;
    const districtKey = CommonUtils.getDistrictKey(state, district);

    // Get member data for coloring
    const member = this.dataManager.cache.members[districtKey];

    // Determine color based on current rep view state
    let fillColor = '#6b7280'; // Default gray

    // Check if rep view is enabled through event bus
    this.eventBus.emit('getRepViewState', (isRepView) => {
      if ((this.currentState || isRepView) && member) {
        fillColor = CommonUtils.getPartyColor(member.party);
      }
    });

    // Add layer through core
    const layer = this.core.addDistrictLayer(feature, {
      style: {
        weight: 1.5,
        opacity: 0.9,
        color: '#333333',
        fillOpacity: 0.5,
        fillColor
      },
      onEachFeature: (feature, layer) => {
        this.setupDistrictInteraction(feature, layer);
      }
    });

    return layer;
  }

  /**
     * Setup district interaction
     */
  setupDistrictInteraction (feature, layer) {
    const state = feature.properties.state;
    const district = feature.properties.district;
    const districtKey = CommonUtils.getDistrictKey(state, district);

    // Click handler
    layer.on('click', () => {
      this.eventBus.emit('districtClicked', { state, district, districtKey });
    });

    // Hover handlers
    layer.on('mouseover', (e) => {
      layer.setStyle({
        weight: 3,
        opacity: 1,
        color: '#2563eb'
      });

      // Show tooltip
      const member = this.dataManager.cache.members[districtKey];
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
      // Reset to normal style
      const member = this.dataManager.cache.members[districtKey];
      let fillColor = '#6b7280';

      this.eventBus.emit('getRepViewState', (isRepView) => {
        if ((this.currentState || isRepView) && member) {
          fillColor = CommonUtils.getPartyColor(member.party);
        }
      });

      layer.setStyle({
        weight: 1.5,
        opacity: 0.9,
        color: '#333333',
        fillColor
      });

      layer.unbindTooltip();
    });
  }

  /**
     * Update state UI (sidebar and district dropdown)
     */
  async updateStateUI (stateCode, districts) {
    // Build district list data
    const districtListData = districts.map(feature => {
      const district = feature.properties.district;
      const districtKey = CommonUtils.getDistrictKey(stateCode, district);
      const member = this.dataManager.cache.members[districtKey];

      return {
        state: stateCode,
        district,
        member
      };
    });

    // Update district dropdown
    this.updateDistrictDropdown(stateCode, districtListData);

    // Update sidebar with state info
    this.updateSidebarStateInfo(stateCode, districtListData);
  }

  /**
     * Update district dropdown
     */
  updateDistrictDropdown (stateCode, districts) {
    if (!this.districtDropdown) return;

    // Clear existing options
    this.districtDropdown.innerHTML = '<option value="">Select District</option>';

    // Add district options
    districts.forEach(districtData => {
      const option = document.createElement('option');
      const districtKey = CommonUtils.getDistrictKey(stateCode, districtData.district);
      option.value = districtKey;

      let optionText = `District ${districtData.district}`;
      if (districtData.member) {
        optionText += ` - ${districtData.member.name} (${districtData.member.party})`;
      }

      option.textContent = optionText;
      this.districtDropdown.appendChild(option);
    });

    // Show dropdown container
    const dropdownContainer = this.districtDropdown.closest('.prominent-dropdown');
    if (dropdownContainer) {
      dropdownContainer.style.display = 'block';
    }
  }

  /**
     * Clear district dropdown
     */
  clearDistrictDropdown () {
    if (this.districtDropdown) {
      this.districtDropdown.innerHTML = '<option value="">Select District</option>';
      this.districtDropdown.value = '';

      // Hide dropdown container
      const dropdownContainer = this.districtDropdown.closest('.prominent-dropdown');
      if (dropdownContainer) {
        dropdownContainer.style.display = 'none';
      }
    }
  }

  /**
     * Update sidebar with state information
     */
  updateSidebarStateInfo (stateCode, districts) {
    // Emit event for state info display - let the main app handle it through district info module
    this.eventBus.emit('stateInfoDisplay', {
      state: stateCode,
      districts
    });
  }

  /**
     * Clear sidebar
     */
  clearSidebar () {
    if (this.sidebarContainer) {
      this.sidebarContainer.innerHTML = '<p>Select a district to view details</p>';
    }
  }

  /**
     * Get current state
     */
  getCurrentState () {
    return this.currentState;
  }

  /**
     * Reset to all states view
     */
  async reset () {
    await this.showAllStates();
  }
}
