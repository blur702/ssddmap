/**
 * Sidebar Templates - Reusable UI templates for consistent sidebar layouts
 * Provides standardized templates for displaying representative and district information
 */
export class SidebarTemplates {
  constructor () {
    this.socialIcons = {
      facebook: '📘',
      twitter: '🐦',
      instagram: '📷',
      youtube: '📺',
      linkedin: '💼'
    };
  }

  /**
   * Create comprehensive representative information template
   * @param {Object} representative - Representative data
   * @param {Object} district - District information
   * @param {Object} options - Template options
   * @returns {string} HTML template
   */
  createRepresentativeTemplate (representative, district = null, options = {}) {
    if (!representative || !representative.name) {
      return this.createVacantSeatTemplate(district);
    }

    const {
      showActions = true,
      showBioguide = true,
      compactMode = false
    } = options;

    return `
      <div class="representative-profile">
        ${this.createRepresentativeHeader(representative, district)}
        ${this.createRepresentativeDetails(representative, { showBioguide, compactMode })}
        ${this.createContactSection(representative)}
        ${this.createSocialMediaSection(representative)}
        ${representative.committees ? this.createCommitteesSection(representative.committees) : ''}
        ${showActions ? this.createRepresentativeActions(representative, district) : ''}
      </div>
    `;
  }

  /**
   * Create representative header with photo and basic info
   */
  createRepresentativeHeader (representative, district) {
    const partyColor = this.getPartyColor(representative.party);
    const partyName = this.getFullPartyName(representative.party);
    const districtDisplay = district
      ? `${district.state}-${district.district}`
      : representative.state && representative.district
        ? `${representative.state}-${representative.district}`
        : '';

    return `
      <div class="rep-header">
        <div class="rep-photo-container">
          ${this.createRepPhoto(representative.photo, representative.name)}
          <div class="party-indicator" style="background-color: ${partyColor}" title="${partyName}">
            ${representative.party || '?'}
          </div>
        </div>
        <div class="rep-basic-info">
          <h3 class="rep-name">${representative.name}</h3>
          <div class="rep-title-info">
            ${districtDisplay ? `<span class="district-badge">${districtDisplay}</span>` : ''}
            <span class="party-name" style="color: ${partyColor}">${partyName}</span>
          </div>
          ${representative.state ? `<div class="rep-state">${this.getStateName(representative.state)}</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Create detailed representative information
   */
  createRepresentativeDetails (representative, options = {}) {
    const { showBioguide = true, compactMode = false } = options;

    return `
      <div class="rep-details ${compactMode ? 'compact' : ''}">
        <div class="detail-grid">
          ${representative.phone ? this.createDetailItem('📞', 'Phone', this.formatPhone(representative.phone), `tel:${representative.phone}`) : ''}
          ${representative.office ? this.createDetailItem('🏛️', 'Office', representative.office) : ''}
          ${representative.website ? this.createDetailItem('🌐', 'Website', this.getDomainFromUrl(representative.website), representative.website) : ''}
          ${showBioguide && representative.bioguideId ? this.createDetailItem('🆔', 'Bioguide ID', representative.bioguideId, `https://bioguide.congress.gov/search/bio/${representative.bioguideId}`) : ''}
          ${representative.yearElected ? this.createDetailItem('🗳️', 'First Elected', representative.yearElected) : ''}
          ${representative.termStart ? this.createDetailItem('📅', 'Term Start', this.formatDate(representative.termStart)) : ''}
        </div>
      </div>
    `;
  }

  /**
   * Create contact section
   */
  createContactSection (representative) {
    if (!representative.phone && !representative.contactForm) return '';

    return `
      <div class="contact-section">
        <h5 class="section-title">📞 Contact Information</h5>
        <div class="contact-options">
          ${representative.phone
    ? `
            <a href="tel:${representative.phone}" class="contact-button phone-button">
              <span class="contact-icon">📞</span>
              <span class="contact-text">Call Office</span>
            </a>
          `
    : ''}
          ${representative.contactForm
    ? `
            <a href="${representative.contactForm}" target="_blank" class="contact-button form-button">
              <span class="contact-icon">📧</span>
              <span class="contact-text">Contact Form</span>
            </a>
          `
    : ''}
        </div>
      </div>
    `;
  }

  /**
   * Create social media section
   */
  createSocialMediaSection (representative) {
    if (!representative.social) return '';

    const socialLinks = Object.entries(representative.social)
      .filter(([platform, url]) => url && url.trim())
      .map(([platform, url]) => {
        const icon = this.getSocialIcon(platform);
        const displayName = this.formatSocialPlatform(platform);
        return `
          <a href="${url}" target="_blank" class="social-link" title="${displayName}">
            <span class="social-icon">${icon}</span>
            <span class="social-platform">${displayName}</span>
          </a>
        `;
      });

    if (socialLinks.length === 0) return '';

    return `
      <div class="social-section">
        <h5 class="section-title">📱 Social Media</h5>
        <div class="social-links">
          ${socialLinks.join('')}
        </div>
      </div>
    `;
  }

  /**
   * Create committees section
   */
  createCommitteesSection (committees) {
    if (!committees || committees.length === 0) return '';

    const committeeList = committees.map(committee => `
      <div class="committee-item">
        <span class="committee-name">${committee.name}</span>
        ${committee.role && committee.role !== 'Member'
    ? `<span class="committee-role">${committee.role}</span>`
    : ''}
      </div>
    `).join('');

    return `
      <div class="committees-section">
        <h5 class="section-title">🏛️ Committee Assignments</h5>
        <div class="committees-list">
          ${committeeList}
        </div>
      </div>
    `;
  }

  /**
   * Create representative actions section
   */
  createRepresentativeActions (representative, district) {
    return `
      <div class="rep-actions">
        <div class="action-buttons">
          ${this.createActionButton('🗺️', 'View on Map', 'view-on-map')}
          ${representative.website ? this.createActionButton('🌐', 'Official Website', 'visit-website', representative.website) : ''}
          ${representative.contactForm ? this.createActionButton('📧', 'Contact Rep', 'contact-rep', representative.contactForm) : ''}
          ${this.createActionButton('🔄', 'New Search', 'new-search')}
        </div>
      </div>
    `;
  }

  /**
   * Create compact copyable address template
   * @param {Object} addressData - Address information
   * @returns {string} HTML template
   */
  createCompactAddressTemplate (addressData) {
    const {
      address,
      lat,
      lon,
      source,
      zip4
    } = addressData;

    // Clean up address for display
    const cleanAddress = this.cleanAddressForDisplay(address);
    const coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    return `
      <div class="compact-address-section">
        <div class="address-header">
          <h5 class="section-title">📍 Address Information</h5>
          <button class="copy-address-btn" data-copy-text="${cleanAddress}" title="Copy address">
            📋
          </button>
        </div>
        
        <div class="address-content">
          <div class="address-main" data-copyable="${cleanAddress}">
            ${cleanAddress}
          </div>
          
          <div class="address-metadata">
            <div class="metadata-grid">
              <div class="metadata-item">
                <span class="metadata-label">Coordinates:</span>
                <span class="metadata-value coordinates" data-copyable="${coordinates}">
                  ${coordinates}
                  <button class="mini-copy-btn" data-copy-text="${coordinates}" title="Copy coordinates">📋</button>
                </span>
              </div>
              
              ${zip4
    ? `
                <div class="metadata-item">
                  <span class="metadata-label">ZIP+4:</span>
                  <span class="metadata-value">${zip4}</span>
                </div>
              `
    : ''}
              
              <div class="metadata-item">
                <span class="metadata-label">Source:</span>
                <span class="metadata-value source">${this.formatDataSource(source)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create DC delegate information template
   */
  createDCDelegateTemplate () {
    return `
      <div class="dc-delegate-section">
        <div class="delegate-header">
          <div class="delegate-icon">🏛️</div>
          <div class="delegate-info">
            <h3 class="delegate-title">Washington D.C.</h3>
            <div class="delegate-subtitle">Non-voting Delegate to Congress</div>
          </div>
        </div>
        
        <div class="delegate-explanation">
          <div class="info-card">
            <h5>About D.C. Representation</h5>
            <p class="info-text">
              Washington D.C. has a non-voting delegate to the U.S. House of Representatives who can:
            </p>
            <ul class="delegate-powers">
              <li>✅ Vote in congressional committees</li>
              <li>✅ Sponsor and co-sponsor legislation</li>
              <li>✅ Speak on the House floor</li>
              <li>❌ Vote on final passage of bills</li>
            </ul>
          </div>
          
          <div class="delegate-note">
            <p><strong>Note:</strong> D.C. residents also elect a shadow representative and shadow senators who advocate for D.C. statehood.</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create vacant seat template
   */
  createVacantSeatTemplate (district) {
    const districtDisplay = district ? `${district.state}-${district.district}` : '';

    return `
      <div class="vacant-seat-section">
        <div class="vacant-header">
          <div class="vacant-icon">🏛️</div>
          <div class="vacant-info">
            <h3 class="vacant-title">${districtDisplay ? `District ${districtDisplay}` : 'Congressional District'}</h3>
            <div class="vacant-subtitle">Seat Currently Vacant</div>
          </div>
        </div>
        
        <div class="vacant-explanation">
          <p class="info-text">
            This congressional seat is currently vacant. This may be due to resignation, 
            death, or the representative taking another office.
          </p>
          <p class="info-note">
            A special election or appointment may be scheduled to fill this position.
          </p>
        </div>
      </div>
    `;
  }

  // Helper methods
  createRepPhoto (photoUrl, name) {
    if (!photoUrl) {
      return '<div class="rep-photo-placeholder">👤</div>';
    }

    return `
      <img src="${photoUrl}" 
           alt="${name}" 
           class="rep-photo"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="rep-photo-placeholder" style="display: none;">👤</div>
    `;
  }

  createDetailItem (icon, label, value, link = null) {
    const content = link
      ? `<a href="${link}" target="_blank" class="detail-link">${value}</a>`
      : `<span class="detail-value">${value}</span>`;

    return `
      <div class="detail-item">
        <span class="detail-icon">${icon}</span>
        <span class="detail-label">${label}:</span>
        ${content}
      </div>
    `;
  }

  createActionButton (icon, text, action, url = null) {
    const attributes = url
      ? `href="${url}" target="_blank"`
      : `data-action="${action}"`;

    const tag = url ? 'a' : 'button';

    return `
      <${tag} ${attributes} class="action-btn ${action}">
        <span class="btn-icon">${icon}</span>
        <span class="btn-text">${text}</span>
      </${tag}>
    `;
  }

  // Utility methods
  getPartyColor (party) {
    switch (party) {
    case 'D': return '#3b82f6';
    case 'R': return '#ef4444';
    case 'I': return '#8b5cf6';
    default: return '#6b7280';
    }
  }

  getFullPartyName (party) {
    switch (party) {
    case 'D': return 'Democrat';
    case 'R': return 'Republican';
    case 'I': return 'Independent';
    default: return 'Unknown';
    }
  }

  getSocialIcon (platform) {
    const icons = {
      facebook: '📘',
      twitter: '🐦',
      instagram: '📷',
      youtube: '📺',
      linkedin: '💼'
    };
    return icons[platform.toLowerCase()] || '🔗';
  }

  formatSocialPlatform (platform) {
    const names = {
      facebook: 'Facebook',
      twitter: 'Twitter/X',
      instagram: 'Instagram',
      youtube: 'YouTube',
      linkedin: 'LinkedIn'
    };
    return names[platform.toLowerCase()] || platform;
  }

  formatPhone (phone) {
    // Format phone number for display
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  formatDate (dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  formatDataSource (source) {
    const sources = {
      usps_ai: 'USPS + AI Resolution',
      census: 'Census Geocoder',
      usps: 'USPS API',
      nominatim: 'OpenStreetMap',
      both: 'Multiple Sources'
    };
    return sources[source] || source || 'Unknown';
  }

  getDomainFromUrl (url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  getStateName (stateCode) {
    const states = {
      AL: 'Alabama',
      AK: 'Alaska',
      AZ: 'Arizona',
      AR: 'Arkansas',
      CA: 'California',
      CO: 'Colorado',
      CT: 'Connecticut',
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
    return states[stateCode] || stateCode;
  }

  cleanAddressForDisplay (address) {
    // Remove extra commas and clean up address formatting
    return address
      .replace(/,\s*,/g, ',')
      .replace(/,\s*United States$/i, '')
      .replace(/,\s*USA$/i, '')
      .trim();
  }
}

