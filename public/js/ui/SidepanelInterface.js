/**
 * Sidepanel Interface - Common UI Interface for Sidepanel Layout
 * This class provides a standardized interface for displaying content in the sidepanel
 * It handles layout, visual elements, and provides a consistent API for modules
 */
export class SidepanelInterface {
  constructor (sidebarElement) {
    this.sidebar = sidebarElement;
    this.header = this.sidebar.querySelector('.sidebar-header h3');
    this.contentContainer = this.sidebar.querySelector('#sidebar-content');
    this.closeButton = this.sidebar.querySelector('#closeSidebar');
    this.isActive = false;

    this.setupEventListeners();
  }

  /**
     * Setup event listeners for the interface
     */
  setupEventListeners () {
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.hide();
      });
    }
  }

  /**
     * Show the sidepanel with content
     * @param {Object} config - Configuration object
     * @param {string} config.title - Header title
     * @param {string} config.content - HTML content
     * @param {Object} config.data - Data object for the content
     */
  show ({ title, content, data = {} }) {
    // Update header
    if (this.header && title) {
      this.header.textContent = title;
    }

    // Update content
    if (this.contentContainer && content) {
      this.contentContainer.innerHTML = content;
    }

    // Show sidebar
    this.sidebar.classList.add('active');
    this.isActive = true;

    // Store data for potential future use
    this.currentData = data;
  }

  /**
     * Hide the sidepanel
     */
  hide () {
    this.sidebar.classList.remove('active');
    this.isActive = false;
    this.currentData = null;
  }

  /**
     * Update content without changing visibility
     * @param {string} content - HTML content
     */
  updateContent (content) {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = content;
    }
  }

  /**
     * Update header title
     * @param {string} title - New title
     */
  updateTitle (title) {
    if (this.header) {
      this.header.textContent = title;
    }
  }

  /**
     * Get current visibility state
     * @returns {boolean} - Whether sidepanel is active
     */
  isVisible () {
    return this.isActive;
  }

  /**
     * Get current data
     * @returns {Object} - Current data object
     */
  getCurrentData () {
    return this.currentData;
  }

  /**
     * Clear content
     */
  clear () {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = '<p class="placeholder">Select a district to view details</p>';
    }
    this.currentData = null;
  }

  /**
     * Create standardized content sections
     */
  createSection (title, content, className = '') {
    return `
            <div class="content-section ${className}">
                ${title ? `<h4 class="section-title">${title}</h4>` : ''}
                <div class="section-content">
                    ${content}
                </div>
            </div>
        `;
  }

  /**
     * Create standardized info item
     */
  createInfoItem (label, value, className = '') {
    if (!value) return '';
    return `
            <div class="info-item ${className}">
                <span class="info-label">${label}:</span>
                <span class="info-value">${value}</span>
            </div>
        `;
  }

  /**
     * Create standardized button
     */
  createButton (text, onClick, className = 'btn-secondary') {
    const buttonId = `btn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the click handler for later cleanup
    this.buttonHandlers = this.buttonHandlers || {};
    this.buttonHandlers[buttonId] = onClick;

    setTimeout(() => {
      const btn = document.getElementById(buttonId);
      if (btn && onClick) {
        btn.addEventListener('click', onClick);
      }
    }, 0);

    return `<button id="${buttonId}" class="btn ${className}">${text}</button>`;
  }

  /**
     * Create party indicator
     */
  createPartyIndicator (party, size = 'normal') {
    const partyClass = party ? party.toLowerCase() : 'vacant';
    const sizeClass = size === 'large' ? 'large' : '';
    const partyText = party || 'V';

    return `<span class="party-indicator ${partyClass} ${sizeClass}">${partyText}</span>`;
  }

  /**
     * Create representative photo element
     */
  createRepPhoto (photo, name, className = '') {
    if (!photo) return '';
    return `<img src="${photo}" alt="${name}" class="rep-photo ${className}" onerror="this.style.display='none'">`;
  }

  /**
     * Create link element
     */
  createLink (url, text, external = true) {
    const target = external ? 'target="_blank"' : '';
    const icon = external ? ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15,3 21,3 21,9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>' : '';
    return `<a href="${url}" ${target} class="content-link">${text}${icon}</a>`;
  }

  /**
     * Cleanup event listeners when destroying
     */
  destroy () {
    if (this.buttonHandlers) {
      Object.keys(this.buttonHandlers).forEach(buttonId => {
        const btn = document.getElementById(buttonId);
        if (btn) {
          btn.removeEventListener('click', this.buttonHandlers[buttonId]);
        }
      });
      this.buttonHandlers = {};
    }
  }
}
