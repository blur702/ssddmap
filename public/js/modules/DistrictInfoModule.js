/**
 * District Info Module - Handles district and representative information display
 * This module uses the SidepanelInterface to display district/rep data
 */
import { SidepanelInterface } from '../ui/SidepanelInterface.js';

export class DistrictInfoModule {
  constructor (sidebarElement, dataManager) {
    this.dataManager = dataManager;
    this.sidepanelInterface = new SidepanelInterface(sidebarElement);
    this.currentDistrictKey = null;
  }

  /**
     * Display district information
     * @param {Object} districtInfo - District information object
     * @param {string} districtInfo.state - State abbreviation
     * @param {string} districtInfo.district - District number
     * @param {Object} districtInfo.representative - Representative data
     */
  displayDistrictInfo (districtInfo) {
    const { state, district, representative } = districtInfo;
    const districtKey = `${state}-${district}`;

    // Store current district
    this.currentDistrictKey = districtKey;

    // Generate title
    const title = `District ${state}-${district}`;

    // Generate content based on whether representative exists
    let content;
    if (!representative || !representative.name) {
      content = this.generateVacantContent(state, district);
    } else {
      content = this.generateRepresentativeContent(state, district, representative);
    }

    // Show in sidepanel
    this.sidepanelInterface.show({
      title,
      content,
      data: districtInfo
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
     * Generate content for a district with representative
     */
  generateRepresentativeContent (state, district, rep) {
    const districtHeader = this.sidepanelInterface.createSection('', `
            <div class="district-header-main">
                <div class="district-title-main">
                    <h4>${state}-${district}</h4>
                    ${this.sidepanelInterface.createPartyIndicator(rep.party, 'large')}
                </div>
            </div>
        `);

    const repSection = this.sidepanelInterface.createSection('Representative', `
            <div class="rep-info-full">
                ${this.sidepanelInterface.createRepPhoto(rep.photo, rep.name)}
                <div class="rep-details">
                    <h5>${rep.name}</h5>
                    <p class="party ${rep.party?.toLowerCase()}">
                        ${this.getPartyFullName(rep.party)}
                    </p>
                    ${this.sidepanelInterface.createInfoItem('Bioguide ID', rep.bioguideId)}
                    ${this.sidepanelInterface.createInfoItem('Phone', rep.phone)}
                    ${this.sidepanelInterface.createInfoItem('Office', rep.office)}
                    ${rep.website ? `<p>${this.sidepanelInterface.createLink(rep.website, 'Official Website')}</p>` : ''}
                </div>
            </div>
        `);

    const committeesSection = rep.committees && rep.committees.length > 0
      ? this.sidepanelInterface.createSection('Committee Assignments', `
                <ul class="committees-list">
                    ${rep.committees.map(committee => `
                        <li>
                            <span class="committee-name">${committee.name}</span>
                            ${committee.role !== 'Member' ? `<span class="committee-role">(${committee.role})</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            `, 'committees-section')
      : '';

    return districtHeader + repSection + committeesSection;
  }

  /**
     * Generate content for a vacant district
     */
  generateVacantContent (state, district) {
    const districtHeader = this.sidepanelInterface.createSection('', `
            <div class="district-header-main">
                <div class="district-title-main">
                    <h4>${state}-${district}</h4>
                    ${this.sidepanelInterface.createPartyIndicator(null, 'large')}
                </div>
            </div>
        `);

    const vacantSection = this.sidepanelInterface.createSection('', `
            <div class="vacant-message">This seat is currently vacant.</div>
        `, 'vacant-section');

    return districtHeader + vacantSection;
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
     * Cleanup when destroying
     */
  destroy () {
    this.sidepanelInterface.destroy();
    this.currentDistrictKey = null;
  }
}
