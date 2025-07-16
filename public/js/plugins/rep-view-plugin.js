/**
 * Rep View Plugin - Handles representative view toggle and district coloring
 * Completely isolated module that communicates through the event bus
 */
import { BasePlugin, CommonUtils } from '../common.js';

export class RepViewPlugin extends BasePlugin {
  constructor (core, eventBus, dataManager) {
    super('RepView', core, eventBus);
    this.dataManager = dataManager;
    this.isRepView = true; // Default to enabled
    this.toggleElement = null;
  }

  /**
     * Initialize the plugin
     */
  async initialize () {
    console.log('🎨 Initializing RepView plugin...');

    // Find toggle element
    this.toggleElement = document.getElementById('toggleRepView');

    if (!this.toggleElement) {
      throw new Error('Rep view toggle not found');
    }

    // Set initial state
    this.toggleElement.checked = this.isRepView;

    // Setup event listeners
    this.setupEventListeners();

    // Subscribe to core events
    this.subscribeToEvents();

    this.isInitialized = true;
    console.log('✅ RepView plugin initialized');
  }

  /**
     * Setup event listeners
     */
  setupEventListeners () {
    // Toggle change event
    this.toggleElement.addEventListener('change', (e) => {
      this.setRepView(e.target.checked);
    });

    // Also listen for label clicks (better UX)
    const label = document.querySelector('label[for="toggleRepView"]');
    if (label) {
      label.addEventListener('click', (e) => {
        // Prevent double-trigger, let the checkbox handle it
      });
    }
  }

  /**
     * Subscribe to core events
     */
  subscribeToEvents () {
    // Listen for district layer additions to apply colors
    this.eventBus.on('districtLayerAdded', (data) => {
      this.applyDistrictColor(data.districtKey, data.layer);
    });

    // Listen for requests for rep view state
    this.eventBus.on('getRepViewState', (callback) => {
      if (typeof callback === 'function') {
        callback(this.isRepView);
      }
    });

    // Listen for member data updates
    this.eventBus.on('memberDataUpdated', () => {
      this.updateAllDistrictColors();
    });

    // Listen for state changes to update colors
    this.eventBus.on('stateSelected', () => {
      // Delay to ensure layers are created first
      setTimeout(() => {
        this.updateAllDistrictColors();
      }, 100);
    });

    this.eventBus.on('allStatesLoaded', () => {
      // Delay to ensure layers are created first
      setTimeout(() => {
        this.updateAllDistrictColors();
      }, 100);
    });
  }

  /**
     * Set rep view state
     */
  setRepView (enabled) {
    console.log(`🎨 Setting rep view: ${enabled}`);

    this.isRepView = enabled;
    this.toggleElement.checked = enabled;

    // Update all district colors
    this.updateAllDistrictColors();

    // Emit event for other plugins
    this.eventBus.emit('repViewToggled', {
      enabled,
      isRepView: this.isRepView
    });
  }

  /**
     * Apply color to a single district
     */
  applyDistrictColor (districtKey, layer) {
    if (!layer || !layer.setStyle) return;

    const member = this.dataManager.cache.members[districtKey];
    let fillColor = '#6b7280'; // Default gray

    if (this.isRepView && member) {
      fillColor = CommonUtils.getPartyColor(member.party);
    }

    layer.setStyle({
      fillColor
    });

    console.log(`🎨 Applied color to ${districtKey}: ${fillColor} (party: ${member?.party || 'none'})`);
  }

  /**
     * Update all district colors
     */
  updateAllDistrictColors () {
    if (!this.isEnabled) return;

    console.log(`🎨 Updating all district colors, isRepView: ${this.isRepView}`);

    const districtLayers = this.core.getDistrictLayers();
    let coloredCount = 0;
    let democratCount = 0;
    let republicanCount = 0;

    Object.entries(districtLayers).forEach(([districtKey, layer]) => {
      if (!layer || !layer.setStyle) return;

      const member = this.dataManager.cache.members[districtKey];
      let fillColor = '#6b7280'; // Default gray

      if (this.isRepView && member) {
        fillColor = CommonUtils.getPartyColor(member.party);
        coloredCount++;

        if (member.party === 'D') democratCount++;
        if (member.party === 'R') republicanCount++;
      }

      // Update the layer style
      layer.setStyle({
        fillColor
      });
    });

    console.log(`🎨 Color update complete: ${coloredCount} districts colored`);
    console.log(`🫏 Democrat districts: ${democratCount}`);
    console.log(`🐘 Republican districts: ${republicanCount}`);

    // Emit event with statistics
    this.eventBus.emit('colorsUpdated', {
      total: coloredCount,
      democrats: democratCount,
      republicans: republicanCount,
      isRepView: this.isRepView
    });
  }

  /**
     * Get current rep view state
     */
  getRepViewState () {
    return this.isRepView;
  }

  /**
     * Toggle rep view
     */
  toggle () {
    this.setRepView(!this.isRepView);
  }

  /**
     * Force enable rep view
     */
  enable () {
    super.enable();
    this.setRepView(true);
  }

  /**
     * Force disable rep view
     */
  disable () {
    super.disable();
    this.setRepView(false);
  }
}
