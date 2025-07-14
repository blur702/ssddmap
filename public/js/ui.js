/**
 * UI Module - Handles all UI components and interactions
 */
export class UIManager {
    constructor() {
        this.elements = {};
        this.callbacks = {};
        this.sidebarActive = false;
    }
    
    /**
     * Initialize UI components
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.hideLoading();
    }
    
    /**
     * Cache all DOM elements
     */
    cacheElements() {
        // Toolbar elements
        this.elements.toolbar = document.getElementById('toolbar');
        this.elements.stateSelect = document.getElementById('stateSelect');
        this.elements.mapStyle = document.getElementById('mapStyle');
        this.elements.addressInput = document.getElementById('addressInput');
        this.elements.searchBtn = document.getElementById('searchBtn');
        this.elements.searchResults = document.getElementById('searchResults');
        this.elements.autosuggestToggle = document.getElementById('autosuggestToggle');
        this.elements.toggleRepView = document.getElementById('toggleRepView');
        this.elements.viewUSA = document.getElementById('viewUSA');
        this.elements.dataManageBtn = document.getElementById('dataManageBtn');
        this.elements.configBtn = document.getElementById('configBtn');
        
        // Sidebar elements
        this.elements.infoSidebar = document.getElementById('info-sidebar');
        this.elements.closeSidebar = document.getElementById('closeSidebar');
        this.elements.districtInfo = document.getElementById('districtInfo');
        this.elements.districtList = document.getElementById('districtList');
        
        // Modal elements
        this.elements.dataModal = document.getElementById('dataModal');
        this.elements.configModal = document.getElementById('configModal');
        this.elements.batchModal = document.getElementById('batchModal');
        
        // Loading overlay
        this.elements.loading = document.getElementById('loading');
        
        // Config modal elements
        this.elements.saveConfigBtn = document.getElementById('saveConfigBtn');
        this.elements.testUspsBtn = document.getElementById('testUspsBtn');
        this.elements.testSmartyBtn = document.getElementById('testSmartyBtn');
        this.elements.authorizeUspsBtn = document.getElementById('authorizeUspsBtn');
        this.elements.refreshCacheBtn = document.getElementById('refreshCacheBtn');
        
        // Cache status
        this.elements.cacheStatus = document.getElementById('cacheStatus');
        
        // Legend elements
        this.elements.legend = document.getElementById('legend');
        this.elements.partyLegend = document.getElementById('partyLegend');
    }
    
    /**
     * Setup event listeners for UI components
     */
    setupEventListeners() {
        // Map style selector
        if (this.elements.mapStyle) {
            this.elements.mapStyle.addEventListener('change', (e) => {
                if (this.callbacks.onMapStyleChange) {
                    this.callbacks.onMapStyleChange(e.target.value);
                }
            });
        }
        
        // State selector
        if (this.elements.stateSelect) {
            this.elements.stateSelect.addEventListener('change', (e) => {
                if (this.callbacks.onStateChange) {
                    this.callbacks.onStateChange(e.target.value);
                }
            });
        }
        
        // View USA button
        if (this.elements.viewUSA) {
            this.elements.viewUSA.addEventListener('click', () => {
                if (this.callbacks.onViewUSA) {
                    this.callbacks.onViewUSA();
                }
            });
        }
        
        // Toggle rep view
        if (this.elements.toggleRepView) {
            this.elements.toggleRepView.addEventListener('change', (e) => {
                if (this.callbacks.onToggleRepView) {
                    this.callbacks.onToggleRepView(e.target.checked);
                }
            });
        }
        
        // Data management button
        if (this.elements.dataManageBtn) {
            this.elements.dataManageBtn.addEventListener('click', () => {
                this.showModal('dataModal');
            });
        }
        
        // Config button
        if (this.elements.configBtn) {
            this.elements.configBtn.addEventListener('click', () => {
                this.showModal('configModal');
            });
        }
        
        // Close sidebar button
        if (this.elements.closeSidebar) {
            this.elements.closeSidebar.addEventListener('click', () => {
                this.hideSidebar();
            });
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Config handlers
        this.setupConfigHandlers();
        
        // Cache refresh button
        if (this.elements.refreshCacheBtn) {
            this.elements.refreshCacheBtn.addEventListener('click', () => {
                if (this.callbacks.onRefreshCache) {
                    this.callbacks.onRefreshCache();
                }
            });
        }
    }
    
    /**
     * Setup configuration modal handlers
     */
    setupConfigHandlers() {
        // Save config button
        if (this.elements.saveConfigBtn) {
            this.elements.saveConfigBtn.addEventListener('click', async () => {
                const config = {
                    uspsClientId: document.getElementById('uspsClientId').value,
                    uspsClientSecret: document.getElementById('uspsClientSecret').value,
                    smartyAuthId: document.getElementById('smartyAuthId').value,
                    smartyAuthToken: document.getElementById('smartyAuthToken').value
                };
                
                if (this.callbacks.onSaveConfig) {
                    this.callbacks.onSaveConfig(config);
                }
            });
        }
        
        // Test USPS button
        if (this.elements.testUspsBtn) {
            this.elements.testUspsBtn.addEventListener('click', () => {
                if (this.callbacks.onTestUsps) {
                    this.callbacks.onTestUsps();
                }
            });
        }
        
        // Test Smarty button
        if (this.elements.testSmartyBtn) {
            this.elements.testSmartyBtn.addEventListener('click', () => {
                if (this.callbacks.onTestSmarty) {
                    this.callbacks.onTestSmarty();
                }
            });
        }
        
        // Location method radio buttons
        document.querySelectorAll('input[name="lookupMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (this.callbacks.onLocationMethodChange) {
                    this.callbacks.onLocationMethodChange(e.target.value);
                }
            });
        });
    }
    
    /**
     * Show loading overlay
     * @param {string} message - Optional loading message
     */
    showLoading(message = 'Loading...') {
        if (this.elements.loading) {
            const messageEl = this.elements.loading.querySelector('span');
            if (messageEl) {
                messageEl.textContent = message;
            }
            this.elements.loading.classList.add('show');
        }
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.classList.remove('show');
        }
    }
    
    /**
     * Show modal
     * @param {string} modalId - Modal element ID
     */
    showModal(modalId) {
        const modal = this.elements[modalId];
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    /**
     * Hide modal
     * @param {string} modalId - Modal element ID
     */
    hideModal(modalId) {
        const modal = this.elements[modalId];
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * Show sidebar
     */
    showSidebar() {
        if (this.elements.infoSidebar) {
            this.elements.infoSidebar.classList.add('active');
            this.sidebarActive = true;
        }
    }
    
    /**
     * Hide sidebar
     */
    hideSidebar() {
        if (this.elements.infoSidebar) {
            this.elements.infoSidebar.classList.remove('active');
            this.sidebarActive = false;
        }
    }
    
    /**
     * Update district info in sidebar
     * @param {Object} info - District information
     */
    updateDistrictInfo(info) {
        if (!this.elements.districtInfo) return;
        
        if (!info) {
            this.elements.districtInfo.innerHTML = '<p class="placeholder">Select a district to view details</p>';
            return;
        }
        
        const html = `
            <div class="district-details">
                <h4>${info.state} - District ${info.district}</h4>
                ${info.representative ? `
                    <div class="rep-info">
                        <img src="${info.representative.photo}" alt="${info.representative.name}" class="rep-photo">
                        <div class="rep-details">
                            <h5>${info.representative.name}</h5>
                            <p class="party ${info.representative.party}">${info.representative.party === 'D' ? 'Democrat' : 'Republican'}</p>
                            ${info.representative.website ? `<a href="${info.representative.website}" target="_blank">Official Website</a>` : ''}
                        </div>
                    </div>
                    ${info.representative.committees && info.representative.committees.length > 0 ? `
                        <div class="committees-section">
                            <h6>Committee Assignments</h6>
                            <ul class="committees-list">
                                ${info.representative.committees.map(committee => `
                                    <li>
                                        <span class="committee-name">${committee.name}</span>
                                        ${committee.role !== 'Member' ? `<span class="committee-role">(${committee.role})</span>` : ''}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                ` : '<p>No representative information available</p>'}
                
                ${info.population ? `<p><strong>Population:</strong> ${info.population.toLocaleString()}</p>` : ''}
                ${info.area ? `<p><strong>Area:</strong> ${info.area} sq mi</p>` : ''}
            </div>
        `;
        
        this.elements.districtInfo.innerHTML = html;
        this.showSidebar();
    }
    
    /**
     * Update district list for state view
     * @param {string} state - State abbreviation
     * @param {Array} districts - Array of district objects with member info
     */
    updateStateDistrictList(state, districts) {
        if (!this.elements.districtList) return;
        
        if (!districts || districts.length === 0) {
            this.elements.districtList.innerHTML = '';
            return;
        }
        
        // Sort districts by district number
        districts.sort((a, b) => {
            const aNum = parseInt(a.district) || 0;
            const bNum = parseInt(b.district) || 0;
            return aNum - bNum;
        });
        
        // Calculate party summary
        const partySummary = {
            D: 0,
            R: 0,
            I: 0,
            vacant: 0
        };
        
        districts.forEach(district => {
            if (!district.member || !district.member.name) {
                partySummary.vacant++;
            } else {
                const party = district.member.party || 'vacant';
                if (party === 'D') partySummary.D++;
                else if (party === 'R') partySummary.R++;
                else if (party === 'I') partySummary.I++;
                else partySummary.vacant++;
            }
        });
        
        const html = `
            <div class="state-districts-header">
                <h4>${state} Congressional Districts</h4>
                <p class="district-count">${districts.length} districts</p>
                <div class="party-summary">
                    <div class="summary-item democrat">
                        <span class="party-indicator d"></span>
                        <span class="count">${partySummary.D}</span>
                        <span class="label">Democrats</span>
                    </div>
                    <div class="summary-item republican">
                        <span class="party-indicator r"></span>
                        <span class="count">${partySummary.R}</span>
                        <span class="label">Republicans</span>
                    </div>
                    ${partySummary.I > 0 ? `
                    <div class="summary-item independent">
                        <span class="party-indicator i"></span>
                        <span class="count">${partySummary.I}</span>
                        <span class="label">Independents</span>
                    </div>
                    ` : ''}
                    ${partySummary.vacant > 0 ? `
                    <div class="summary-item vacant">
                        <span class="party-indicator vacant"></span>
                        <span class="count">${partySummary.vacant}</span>
                        <span class="label">Vacant</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="districts-accordion">
                ${districts.map((district, index) => {
                    const member = district.member;
                    const districtKey = `${state}-${district.district}`;
                    const isVacant = !member || !member.name;
                    const partyClass = member?.party ? member.party.toLowerCase() : 'vacant';
                    
                    return `
                        <div class="district-item ${partyClass}" data-district="${districtKey}">
                            <div class="district-header" onclick="window.congressApp.toggleDistrictAccordion('${districtKey}')">
                                <div class="district-title">
                                    <span class="district-number">${state}-${district.district}</span>
                                    <span class="party-indicator ${partyClass}">${member?.party || 'V'}</span>
                                </div>
                                <div class="district-rep">
                                    ${isVacant ? 'Vacant' : member.name}
                                </div>
                                <span class="accordion-arrow">▼</span>
                            </div>
                            <div class="district-content" id="content-${districtKey}" style="display: none;">
                                ${isVacant ? '<p class="vacant-message">This seat is currently vacant.</p>' : `
                                    <div class="rep-detail-info">
                                        <img src="${member.photo}" alt="${member.name}" class="rep-photo-small">
                                        <div class="rep-details">
                                            <p class="party ${member.party}">${member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent'}</p>
                                            ${member.phone ? `<p><strong>Phone:</strong> ${member.phone}</p>` : ''}
                                            ${member.office ? `<p><strong>Office:</strong> ${member.office}</p>` : ''}
                                            ${member.website ? `<p><a href="${member.website}" target="_blank">Official Website</a></p>` : ''}
                                        </div>
                                    </div>
                                    ${member.committees && member.committees.length > 0 ? `
                                        <div class="committees-mini">
                                            <h6>Committees:</h6>
                                            <ul>
                                                ${member.committees.slice(0, 3).map(committee => `
                                                    <li>${committee.name}${committee.role !== 'Member' ? ` (${committee.role})` : ''}</li>
                                                `).join('')}
                                                ${member.committees.length > 3 ? `<li class="more-committees">...and ${member.committees.length - 3} more</li>` : ''}
                                            </ul>
                                        </div>
                                    ` : ''}
                                `}
                                <button class="view-on-map-btn" onclick="window.congressApp.selectDistrict('${state}', '${district.district}')">
                                    View on Map
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        this.elements.districtList.innerHTML = html;
        this.elements.districtList.style.display = 'block';
        
        // Show the sidebar if not already visible
        this.showSidebar();
    }
    
    /**
     * Clear district list
     */
    clearDistrictList() {
        if (this.elements.districtList) {
            this.elements.districtList.innerHTML = '';
            this.elements.districtList.style.display = 'none';
        }
    }
    
    /**
     * Update cache status display
     * @param {Object} status - Cache status information
     */
    updateCacheStatus(status) {
        if (!this.elements.cacheStatus) return;
        
        if (status.error) {
            this.elements.cacheStatus.textContent = 'Error checking cache status';
            this.elements.cacheStatus.style.color = '#f44336';
            return;
        }
        
        const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'Never';
        const memberCount = status.memberCount || 0;
        
        this.elements.cacheStatus.innerHTML = `
            <strong>Cache Status:</strong> ${memberCount} members cached<br>
            <strong>Last Update:</strong> ${lastUpdate}
        `;
        this.elements.cacheStatus.style.color = memberCount > 0 ? '#4caf50' : '#ff9800';
    }
    
    /**
     * Populate state selector
     * @param {Array} states - Array of state objects
     */
    populateStates(states) {
        if (!this.elements.stateSelect) return;
        
        // Clear existing options except the first one
        while (this.elements.stateSelect.options.length > 1) {
            this.elements.stateSelect.remove(1);
        }
        
        // Add state options
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.abbreviation;
            option.textContent = state.name;
            this.elements.stateSelect.appendChild(option);
        });
    }
    
    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * Get all cached elements
     * @returns {Object} All cached DOM elements
     */
    getElements() {
        return this.elements;
    }
    
    /**
     * Register callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }
}