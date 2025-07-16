/**
 * District Info Module - Handles district and representative information display
 * This module uses the SidepanelInterface to display district/rep data
 */
import { SidepanelInterface } from '../ui/SidepanelInterface.js';
import { SidebarTemplates } from '../common/SidebarTemplates.js';

export class DistrictInfoModule {
  constructor (sidebarElement, dataManager, boundaryDistanceModule = null) {
    this.dataManager = dataManager;
    this.sidepanelInterface = new SidepanelInterface(sidebarElement);
    this.templates = new SidebarTemplates();
    this.currentDistrictKey = null;
    this.boundaryDistanceModule = boundaryDistanceModule;
  }

  /**
     * Display district information
     * @param {Object} districtInfo - District information object
     * @param {string} districtInfo.state - State abbreviation
     * @param {string} districtInfo.district - District number
     * @param {Object} districtInfo.representative - Representative data
     * @param {Object} districtInfo.clickLocation - Optional click location for distance calculation
     * @param {Object} districtInfo.boundaryDistance - Optional boundary distance information
     */
  async displayDistrictInfo (districtInfo) {
    const { state, district, representative, clickLocation, boundaryDistance } = districtInfo;
    const districtKey = `${state}-${district}`;

    // Store current district
    this.currentDistrictKey = districtKey;

    // Generate title
    const title = `District ${state}-${district}`;

    // Calculate boundary distance if we have a click location and boundary module
    let distanceInfo = boundaryDistance;
    if (!distanceInfo && clickLocation && this.boundaryDistanceModule) {
      try {
        const result = await this.boundaryDistanceModule.calculateBoundaryDistance(
          clickLocation,
          { state, district }
        );
        if (result.success) {
          distanceInfo = result;
          // Store the click location for the templates
          distanceInfo.clickLocation = clickLocation;
        }
      } catch (error) {
        console.error('Error calculating boundary distance:', error);
      }
    } else if (distanceInfo && clickLocation) {
      // If we have both, make sure click location is stored
      distanceInfo.clickLocation = clickLocation;
    }

    // Generate content based on whether representative exists
    let content;
    if (!representative || !representative.name) {
      content = this.generateVacantContent(state, district, distanceInfo);
    } else {
      content = this.generateRepresentativeContent(state, district, representative, distanceInfo);
    }

    // Show in sidepanel
    this.sidepanelInterface.show({
      title,
      content,
      data: { ...districtInfo, boundaryDistance: distanceInfo }
    });
  }

  /**
     * Display state overview information
     * @param {string} state - State abbreviation
     * @param {Array} districts - Array of district objects
     */
  displayStateInfo (state, districts) {
    const stateNames = this.getStateNames();
    const stateName = stateNames[state] || state;

    // Calculate party breakdown
    const partyBreakdown = this.calculatePartyBreakdown(districts);

    const title = `${stateName} Overview`;
    const content = this.generateStateContent(state, stateName, districts, partyBreakdown);

    this.sidepanelInterface.show({
      title,
      content,
      data: { state, districts, type: 'state' }
    });
  }

  /**
     * Generate content for a district with representative - using same structure as AddressSearchModule
     */
  generateRepresentativeContent (state, district, rep, distanceInfo = null) {
    let content = '';

    // 1. Representative/District Section (Priority #1) - Use SidebarTemplates
    if (rep && rep.name) {
      content += this.templates.createRepresentativeTemplate(
        rep,
        { state, district },
        { showActions: true, showBioguide: true }
      );
    } else {
      // Vacant seat
      content += this.templates.createVacantSeatTemplate(
        { state, district }
      );
    }

    // 2. District Location Section (Priority #2) - Show click coordinates if available
    if (distanceInfo && distanceInfo.clickLocation) {
      content += this.templates.createCompactAddressTemplate({
        address: `District ${state}-${district} click location`,
        lat: distanceInfo.clickLocation.lat,
        lon: distanceInfo.clickLocation.lon,
        source: 'district_click'
      });
    }

    // 3. Boundary Distance Section (Priority #3)
    if (distanceInfo) {
      content += this.generateBoundaryDistanceSection(distanceInfo);
    }


    // Setup event listeners for copy buttons
    this.setupActionListeners();

    return content;
  }

  /**
     * Generate content for a vacant district - using same structure as AddressSearchModule
     */
  generateVacantContent (state, district, distanceInfo = null) {
    let content = '';

    // 1. Vacant Seat Section (Priority #1) - Use SidebarTemplates
    content += this.templates.createVacantSeatTemplate(
      { state, district }
    );

    // 2. District Location Section (Priority #2) - Show click coordinates if available
    if (distanceInfo && distanceInfo.clickLocation) {
      content += this.templates.createCompactAddressTemplate({
        address: `District ${state}-${district} click location`,
        lat: distanceInfo.clickLocation.lat,
        lon: distanceInfo.clickLocation.lon,
        source: 'district_click'
      });
    }

    // 3. Boundary Distance Section (Priority #3)
    if (distanceInfo) {
      content += this.generateBoundaryDistanceSection(distanceInfo);
    }


    // Setup event listeners for copy buttons
    this.setupActionListeners();

    return content;
  }

  /**
     * Generate content for state overview
     */
  generateStateContent (state, stateName, districts, partyBreakdown) {
    const stateHeader = this.sidepanelInterface.createSection('', `
            <div class="state-header">
                <h3>${stateName} (${state})</h3>
            </div>
        `);

    const statsSection = this.sidepanelInterface.createSection('Statistics', `
            <div class="stat-item">
                <span class="stat-label">Total Representatives:</span>
                <span class="stat-value">${districts.length}</span>
            </div>
        `, 'state-stats');

    const partySection = this.sidepanelInterface.createSection('Party Breakdown', `
            ${partyBreakdown.R > 0
    ? `
                <div class="party-stat republican">
                    <span class="party-icon">🐘</span>
                    <span class="party-label">Republican:</span>
                    <span class="party-count">${partyBreakdown.R}</span>
                </div>
            `
    : ''}
            ${partyBreakdown.D > 0
    ? `
                <div class="party-stat democrat">
                    <span class="party-icon">🫏</span>
                    <span class="party-label">Democrat:</span>
                    <span class="party-count">${partyBreakdown.D}</span>
                </div>
            `
    : ''}
            ${partyBreakdown.I > 0
    ? `
                <div class="party-stat independent">
                    <span class="party-icon">Ⓘ</span>
                    <span class="party-label">Independent:</span>
                    <span class="party-count">${partyBreakdown.I}</span>
                </div>
            `
    : ''}
            ${partyBreakdown.V > 0
    ? `
                <div class="party-stat vacant">
                    <span class="party-icon">•</span>
                    <span class="party-label">Vacant:</span>
                    <span class="party-count">${partyBreakdown.V}</span>
                </div>
            `
    : ''}
        `, 'party-breakdown');

    const instructionSection = this.sidepanelInterface.createSection('', `
            <p class="instruction-text">Select a district below to view representative details</p>
        `);

    return stateHeader + statsSection + partySection + instructionSection;
  }

  /**
     * Generate boundary distance section - matching AddressSearchModule format
     */
  generateBoundaryDistanceSection (distanceInfo) {
    if (!distanceInfo || !distanceInfo.distance) return '';

    const distance = distanceInfo.distance;
    const closestPoint = distanceInfo.closestPoint;

    return `
      <div class="boundary-distance-section">
        <div class="info-card">
          <h4>📏 Distance to District Boundary</h4>
          <div class="distance-info">
            <div class="distance-primary">
              <span class="distance-value">${this.formatDistance(distance)}</span>
              <span class="distance-label">to district boundary</span>
            </div>
            <div class="distance-details">
              <div class="distance-measurements">
                <div class="measurement-item">
                  <span class="measurement-label">Miles:</span>
                  <span class="measurement-value">${distance.miles.toFixed(2)}</span>
                </div>
                <div class="measurement-item">
                  <span class="measurement-label">Feet:</span>
                  <span class="measurement-value">${Math.round(distance.feet)}</span>
                </div>
                <div class="measurement-item">
                  <span class="measurement-label">Kilometers:</span>
                  <span class="measurement-value">${distance.kilometers.toFixed(2)}</span>
                </div>
              </div>
              ${closestPoint
    ? `
                <div class="boundary-coordinates">
                  <span class="coord-label">Closest boundary point:</span>
                  <span class="coord-value copyable" data-copy-text="${closestPoint.lat.toFixed(6)}, ${closestPoint.lon.toFixed(6)}">
                    ${closestPoint.lat.toFixed(6)}, ${closestPoint.lon.toFixed(6)}
                    <button class="copy-btn" data-copy-text="${closestPoint.lat.toFixed(6)}, ${closestPoint.lon.toFixed(6)}">📋</button>
                  </span>
                </div>
              `
    : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }


  /**
     * Setup event listeners for action and copy buttons
     */
  setupActionListeners () {
    // Remove existing listeners to prevent duplicates
    if (this.boundActionHandler) {
      document.removeEventListener('click', this.boundActionHandler);
    }
    if (this.boundCopyHandler) {
      document.removeEventListener('click', this.boundCopyHandler);
    }

    // Bind the handlers to preserve 'this' context
    this.boundActionHandler = this.handleActionClick.bind(this);
    this.boundCopyHandler = this.handleCopyClick.bind(this);

    // Add event listeners
    document.addEventListener('click', this.boundActionHandler);
    document.addEventListener('click', this.boundCopyHandler);
  }


  /**
   * Handle copy button clicks
   */
  handleCopyClick (event) {
    if (event.target.matches('.copy-btn') || event.target.closest('.copy-btn')) {
      const button = event.target.matches('.copy-btn') ? event.target : event.target.closest('.copy-btn');
      const textToCopy = button.dataset.copyText;
      this.copyToClipboard(textToCopy);
    }
  }






  /**
     * Copy text to clipboard
     */
  copyToClipboard (text) {
    navigator.clipboard.writeText(text).then(() => {
      // Show success feedback
      this.showCopyFeedback('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      this.showCopyFeedback('Failed to copy', 'error');
    });
  }

  /**
     * Show copy feedback message
     */
  showCopyFeedback (message, type = 'success') {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = `copy-feedback ${type}`;
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      animation: fadeInOut 2s ease-in-out;
    `;

    document.body.appendChild(feedback);

    // Remove after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }

  /**
     * Format distance for display
     */
  formatDistance (distance) {
    if (!distance) return 'Unknown distance';

    if (distance.miles < 0.1) {
      return `${Math.round(distance.feet)} feet`;
    } else if (distance.miles < 10) {
      return `${distance.miles.toFixed(2)} miles`;
    } else {
      return `${Math.round(distance.miles)} miles`;
    }
  }

  /**
     * Create distance section for boundary distance display
     */
  createDistanceSection (distanceInfo) {
    if (!distanceInfo || !distanceInfo.distance) return '';

    // Use the boundary module's formatDistance method for consistent formatting
    const formattedDistance = this.boundaryDistanceModule
      ? this.boundaryDistanceModule.formatDistance(distanceInfo.distance)
      : this.formatDistanceSimple(distanceInfo.distance);

    return this.sidepanelInterface.createSection('Distance to Boundary', `
            <div class="distance-info">
                <div class="distance-primary">
                    <span class="distance-value">${formattedDistance}</span>
                    <span class="distance-label">to district boundary</span>
                </div>
                <div class="boundary-coordinates">
                    <span class="coord-label">Closest boundary point:</span>
                    <span class="coord-value">${distanceInfo.closestPoint.lat.toFixed(6)}, ${distanceInfo.closestPoint.lon.toFixed(6)}</span>
                </div>
            </div>
        `, 'distance-section');
  }

  /**
     * Simple distance formatting (fallback if no boundary module)
     */
  formatDistanceSimple (distance) {
    if (!distance) return 'Unknown distance';

    if (distance.miles < 0.1) {
      return `${Math.round(distance.feet)} feet`;
    } else if (distance.miles < 10) {
      return `${distance.miles.toFixed(2)} miles`;
    } else {
      return `${Math.round(distance.miles)} miles`;
    }
  }

  /**
     * Calculate party breakdown for districts
     */
  calculatePartyBreakdown (districts) {
    const breakdown = { D: 0, R: 0, I: 0, V: 0 };

    districts.forEach(district => {
      const party = district.member?.party || 'V';
      breakdown[party] = (breakdown[party] || 0) + 1;
    });

    return breakdown;
  }

  /**
     * Get full party name from abbreviation
     */
  getPartyFullName (party) {
    switch (party) {
    case 'D': return 'Democrat';
    case 'R': return 'Republican';
    case 'I': return 'Independent';
    default: return 'Unknown';
    }
  }

  /**
     * Get state names mapping
     */
  getStateNames () {
    return {
      AL: 'Alabama',
      AK: 'Alaska',
      AZ: 'Arizona',
      AR: 'Arkansas',
      CA: 'California',
      CO: 'Colorado',
      CT: 'Connecticut',
      DC: 'District of Columbia',
      DE: 'Delaware',
      FL: 'Florida',
      GA: 'Georgia',
      HI: 'Hawaii',
      ID: 'Idaho',
      IL: 'Illinois',
      IN: 'Indiana',
      IA: 'Iowa',
      KS: 'Kansas',
      KY: 'Kentucky',
      LA: 'Louisiana',
      ME: 'Maine',
      MD: 'Maryland',
      MA: 'Massachusetts',
      MI: 'Michigan',
      MN: 'Minnesota',
      MS: 'Mississippi',
      MO: 'Missouri',
      MT: 'Montana',
      NE: 'Nebraska',
      NV: 'Nevada',
      NH: 'New Hampshire',
      NJ: 'New Jersey',
      NM: 'New Mexico',
      NY: 'New York',
      NC: 'North Carolina',
      ND: 'North Dakota',
      OH: 'Ohio',
      OK: 'Oklahoma',
      OR: 'Oregon',
      PA: 'Pennsylvania',
      RI: 'Rhode Island',
      SC: 'South Carolina',
      SD: 'South Dakota',
      TN: 'Tennessee',
      TX: 'Texas',
      UT: 'Utah',
      VT: 'Vermont',
      VA: 'Virginia',
      WA: 'Washington',
      WV: 'West Virginia',
      WI: 'Wisconsin',
      WY: 'Wyoming'
    };
  }

  /**
     * Clear the display
     */
  clear () {
    this.sidepanelInterface.clear();
    this.currentDistrictKey = null;
  }

  /**
     * Hide the sidepanel
     */
  hide () {
    this.sidepanelInterface.hide();
    this.currentDistrictKey = null;
  }

  /**
     * Get current district key
     */
  getCurrentDistrictKey () {
    return this.currentDistrictKey;
  }

  /**
     * Check if sidepanel is visible
     */
  isVisible () {
    return this.sidepanelInterface.isVisible();
  }

  /**
     * Get the sidepanel interface for direct access if needed
     */
  getSidepanelInterface () {
    return this.sidepanelInterface;
  }

  /**
   * Handle action button clicks
   */
  handleActionClick (event) {
    if (event.target.matches('[data-action]') || event.target.closest('[data-action]')) {
      const button = event.target.matches('[data-action]') ? event.target : event.target.closest('[data-action]');
      
      // Only handle buttons in the sidebar content
      const sidebar = document.querySelector('.sidebar-content');
      if (!sidebar || !sidebar.contains(button)) return;
      
      // Prevent default action and stop propagation
      event.preventDefault();
      event.stopPropagation();
      
      const action = button.dataset.action;
      this.handleAction(action, button);
    }
  }

  /**
   * Handle specific actions
   */
  handleAction (action, button) {
    switch (action) {
    case 'view-on-map':
      this.focusOnMap();
      break;
    default:
      console.warn('Unknown action:', action);
    }
  }

  /**
   * Focus map on current district
   */
  focusOnMap () {
    if (this.currentDistrictKey) {
      // Emit event to center map on district
      if (window.eventBus) {
        const [state, district] = this.currentDistrictKey.split('-');
        window.eventBus.emit('centerOnDistrict', { state, district });
      }
      console.log(`Centering on district ${this.currentDistrictKey}`);
    }
  }  /**
     * Cleanup when destroying
     */
  destroy () {
    this.sidepanelInterface.destroy();
    this.currentDistrictKey = null;
  }
}
