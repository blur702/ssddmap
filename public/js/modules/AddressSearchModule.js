/**
 * Address Search Module - Handles address search results and SSDD information display
 * This module uses the SidepanelInterface to display comprehensive address and district data
 */
import { SidepanelInterface } from '../ui/SidepanelInterface.js';

export class AddressSearchModule {
    constructor(sidebarElement, dataManager, eventBus = null, boundaryDistanceModule = null) {
        this.dataManager = dataManager;
        this.sidepanelInterface = new SidepanelInterface(sidebarElement);
        this.currentSearchResult = null;
        this.eventBus = eventBus;
        this.callbacks = {};
        this.boundaryDistanceModule = boundaryDistanceModule;
        this.currentBoundaryResult = null;
    }

    /**
     * Display address search result with SSDD information
     * @param {Object} searchResult - Search result object
     * @param {string} searchResult.address - Found address
     * @param {number} searchResult.lat - Latitude
     * @param {number} searchResult.lon - Longitude
     * @param {string} searchResult.state - State abbreviation
     * @param {string} searchResult.district - District number
     * @param {string} searchResult.source - Data source (census, nominatim, etc.)
     * @param {Object} searchResult.comparison - Optional comparison data
     * @param {Object} searchResult.districtInfo - District info from API
     */
    async displaySearchResult(searchResult) {
        this.currentSearchResult = searchResult;

        // Get district information - prefer from searchResult if available
        let districtInfo = null;
        let representative = null;

        if (searchResult.districtInfo && searchResult.districtInfo.found) {
            // Use district info from search result
            districtInfo = {
                state: searchResult.districtInfo.state,
                district: searchResult.districtInfo.district,
                representative: searchResult.districtInfo.member
            };
            representative = searchResult.districtInfo.member;
        } else if (searchResult.state && searchResult.district) {
            // Fallback to fetching representative data
            try {
                representative = await this.dataManager.getMember(searchResult.state, searchResult.district);
                districtInfo = {
                    state: searchResult.state,
                    district: searchResult.district,
                    representative
                };
            } catch (error) {
                console.error('Error fetching representative data:', error);
            }
        }

        // Calculate boundary distance if we have district info and boundary module
        let boundaryResult = null;
        if (districtInfo && this.boundaryDistanceModule) {
            try {
                boundaryResult = await this.boundaryDistanceModule.calculateBoundaryDistance(
                    { lat: searchResult.lat, lon: searchResult.lon },
                    { state: districtInfo.state, district: districtInfo.district }
                );
                this.currentBoundaryResult = boundaryResult;
                
                // Display boundary visualization on map
                if (boundaryResult.success) {
                    this.boundaryDistanceModule.displayBoundaryVisualization(boundaryResult);
                }
            } catch (error) {
                console.error('Error calculating boundary distance:', error);
            }
        }

        const title = 'Address Search Result';
        const content = this.generateSearchResultContent(searchResult, districtInfo, boundaryResult);

        this.sidepanelInterface.show({
            title,
            content,
            data: { searchResult, districtInfo, boundaryResult }
        });
    }

    /**
     * Generate content for address search result
     */
    generateSearchResultContent(searchResult, districtInfo, boundaryResult = null) {
        // Address section
        const addressSection = this.sidepanelInterface.createSection('Found Address', `
            <div class="search-address">
                <p class="address-main">${searchResult.address}</p>
                <div class="coordinates">
                    <span class="coord-label">Coordinates:</span>
                    <span class="coord-value">${searchResult.lat.toFixed(6)}, ${searchResult.lon.toFixed(6)}</span>
                </div>
                <div class="data-source">
                    <span class="source-label">Data Source:</span>
                    <span class="source-value">${this.formatDataSource(searchResult.source)}</span>
                </div>
            </div>
        `, 'address-section');

        // District section
        let districtSection = '';
        if (districtInfo) {
            districtSection = this.sidepanelInterface.createSection('Congressional District', `
                <div class="district-assignment">
                    <div class="district-header">
                        <h4 class="district-number">${districtInfo.state}-${districtInfo.district}</h4>
                        ${districtInfo.representative ? 
                            this.sidepanelInterface.createPartyIndicator(districtInfo.representative.party, 'large') : 
                            this.sidepanelInterface.createPartyIndicator(null, 'large')}
                    </div>
                    ${this.generateRepresentativeInfo(districtInfo.representative)}
                </div>
            `, 'district-section');
        } else if (searchResult.state || searchResult.district) {
            // Partial district info available
            districtSection = this.sidepanelInterface.createSection('Congressional District', `
                <div class="district-partial">
                    <p class="warning-message">
                        ${searchResult.state ? `State: ${searchResult.state}` : ''}
                        ${searchResult.district ? `District: ${searchResult.district}` : ''}
                    </p>
                    <p class="info-message">Complete district information not available</p>
                </div>
            `, 'district-section');
        } else {
            districtSection = this.sidepanelInterface.createSection('Congressional District', `
                <div class="no-district-info">
                    <p class="info-message">District information not available for this location</p>
                    <p class="suggestion">Try using a more specific address or ZIP code</p>
                </div>
            `, 'district-section');
        }

        // Boundary distance section (if available)
        let boundarySection = '';
        if (boundaryResult && boundaryResult.success) {
            boundarySection = this.generateBoundaryDistanceSection(boundaryResult);
        }

        // Resolution summary section (for USPS + AI results)
        let resolutionSection = '';
        if (searchResult.source === 'usps_ai' && searchResult.resolutionSummary) {
            resolutionSection = this.generateResolutionSection(searchResult);
        }

        // Comparison section (if available)
        let comparisonSection = '';
        if (searchResult.comparison) {
            comparisonSection = this.generateComparisonSection(searchResult.comparison);
        }

        // Action buttons section
        const actionsSection = this.sidepanelInterface.createSection('Actions', `
            <div class="action-buttons">
                ${this.sidepanelInterface.createButton('View on Map', () => this.focusOnMap(), 'btn-primary')}
                ${districtInfo ? this.sidepanelInterface.createButton('View District Details', () => this.showDistrictDetails(districtInfo), 'btn-secondary') : ''}
                ${boundaryResult && boundaryResult.success ? this.sidepanelInterface.createButton('Toggle Boundary View', () => this.toggleBoundaryVisualization(), 'btn-secondary') : ''}
                ${this.sidepanelInterface.createButton('New Search', () => this.clearAndFocusSearch(), 'btn-secondary')}
            </div>
        `, 'actions-section');

        return addressSection + districtSection + boundarySection + resolutionSection + comparisonSection + actionsSection;
    }

    /**
     * Generate boundary distance section
     */
    generateBoundaryDistanceSection(boundaryResult) {
        const distanceDetails = this.boundaryDistanceModule.getDistanceDetails(boundaryResult.distance);
        
        return this.sidepanelInterface.createSection('Distance to District Boundary', `
            <div class="boundary-distance-info">
                <div class="distance-primary">
                    <span class="distance-value">${distanceDetails.primary}</span>
                    <span class="distance-label">to district boundary</span>
                </div>
                <div class="distance-details">
                    <div class="distance-grid">
                        <div class="distance-item">
                            <span class="distance-number">${distanceDetails.feet}</span>
                            <span class="distance-unit">feet</span>
                        </div>
                        <div class="distance-item">
                            <span class="distance-number">${distanceDetails.meters}</span>
                            <span class="distance-unit">meters</span>
                        </div>
                        <div class="distance-item">
                            <span class="distance-number">${distanceDetails.miles}</span>
                            <span class="distance-unit">miles</span>
                        </div>
                        <div class="distance-item">
                            <span class="distance-number">${distanceDetails.kilometers}</span>
                            <span class="distance-unit">kilometers</span>
                        </div>
                    </div>
                </div>
                <div class="boundary-coordinates">
                    <p class="coord-label">Closest boundary point:</p>
                    <p class="coord-value">${boundaryResult.closestPoint.lat.toFixed(6)}, ${boundaryResult.closestPoint.lon.toFixed(6)}</p>
                </div>
                <div class="boundary-info">
                    <p class="info-text">📍 White line on map shows distance to closest district boundary</p>
                </div>
            </div>
        `, 'boundary-distance-section');
    }

    /**
     * Generate resolution summary section for USPS + AI results
     */
    generateResolutionSection(searchResult) {
        let content = `
            <div class="resolution-summary">
                <div class="resolution-status">
                    <h5>Address Resolution Details</h5>
                    <div class="resolution-badges">
                        <span class="badge badge-success">✅ USPS Standardized</span>
                        ${searchResult.zip4 ? `<span class="badge badge-primary">📮 ZIP+4: ${searchResult.zip4}</span>` : ''}
                        ${searchResult.geminiCorrections && searchResult.geminiCorrections.length > 0 ? 
                            `<span class="badge badge-info">🤖 AI Corrected</span>` : 
                            `<span class="badge badge-success">✅ Direct Match</span>`}
                    </div>
                </div>
        `;

        // Show Gemini corrections if any were made
        if (searchResult.geminiCorrections && searchResult.geminiCorrections.length > 0) {
            content += `
                <div class="ai-corrections">
                    <h6>Address Corrections Made</h6>
                    <div class="corrections-list">
            `;
            
            searchResult.geminiCorrections.forEach((correction, index) => {
                content += `
                    <div class="correction-item">
                        <div class="correction-attempt">Attempt ${correction.attempt}</div>
                        <div class="correction-text">"${correction.corrected}"</div>
                        <div class="correction-reason">${correction.reasoning}</div>
                    </div>
                `;
            });

            content += `
                    </div>
                </div>
            `;
        }

        content += `
            </div>
        `;

        return this.sidepanelInterface.createSection('Address Resolution', content, 'resolution-section');
    }

    /**
     * Generate representative information HTML
     */
    generateRepresentativeInfo(representative) {
        if (!representative || !representative.name) {
            return `
                <div class="vacant-seat">
                    <p class="vacant-message">This seat is currently vacant</p>
                </div>
            `;
        }

        return `
            <div class="rep-details">
                ${this.sidepanelInterface.createRepPhoto(representative.photo, representative.name)}
                <div class="rep-info">
                    <h5 class="rep-name">${representative.name}</h5>
                    <p class="rep-party">${this.getFullPartyName(representative.party)}</p>
                    ${this.sidepanelInterface.createInfoItem('Bioguide ID', representative.bioguideId)}
                    ${this.sidepanelInterface.createInfoItem('Phone', representative.phone)}
                    ${this.sidepanelInterface.createInfoItem('Office', representative.office)}
                    ${representative.website ? `
                        <div class="info-item">
                            <span class="info-label">Website:</span>
                            <span class="info-value">${this.sidepanelInterface.createLink(representative.website, 'Official Website')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${this.generateCommitteesInfo(representative.committees)}
        `;
    }

    /**
     * Generate committees information
     */
    generateCommitteesInfo(committees) {
        if (!committees || committees.length === 0) return '';

        return `
            <div class="committees-info">
                <h6>Committee Assignments</h6>
                <ul class="committees-list">
                    ${committees.map(committee => `
                        <li class="committee-item">
                            <span class="committee-name">${committee.name}</span>
                            ${committee.role && committee.role !== 'Member' ? 
                                `<span class="committee-role">(${committee.role})</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Generate comparison section for multiple data sources
     */
    generateComparisonSection(comparison) {
        if (!comparison.census && !comparison.usps) return '';

        return this.sidepanelInterface.createSection('Data Source Comparison', `
            <div class="comparison-grid">
                ${comparison.census ? `
                    <div class="comparison-item">
                        <h6>Census Geocoder</h6>
                        <div class="comparison-details">
                            <p><strong>Address:</strong> ${comparison.census.address || 'Not available'}</p>
                            <p><strong>Coordinates:</strong> ${comparison.census.lat}, ${comparison.census.lon}</p>
                            ${comparison.census.state && comparison.census.district ? 
                                `<p><strong>District:</strong> ${comparison.census.state}-${comparison.census.district}</p>` : ''}
                        </div>
                    </div>
                ` : ''}
                ${comparison.usps ? `
                    <div class="comparison-item">
                        <h6>USPS API</h6>
                        <div class="comparison-details">
                            <p><strong>Address:</strong> ${comparison.usps.address || 'Not available'}</p>
                            <p><strong>Coordinates:</strong> ${comparison.usps.lat}, ${comparison.usps.lon}</p>
                            ${comparison.usps.state && comparison.usps.district ? 
                                `<p><strong>District:</strong> ${comparison.usps.state}-${comparison.usps.district}</p>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
            ${this.generateDistrictDiscrepancy(comparison)}
        `, 'comparison-section');
    }

    /**
     * Generate district discrepancy warning if needed
     */
    generateDistrictDiscrepancy(comparison) {
        const censusDistrict = comparison.census ? `${comparison.census.state}-${comparison.census.district}` : null;
        const uspsDistrict = comparison.usps ? `${comparison.usps.state}-${comparison.usps.district}` : null;

        if (censusDistrict && uspsDistrict && censusDistrict !== uspsDistrict) {
            return `
                <div class="discrepancy-warning">
                    <p class="warning-text">⚠️ District assignment differs between sources</p>
                    <p class="warning-detail">This may indicate the address is near a district boundary</p>
                </div>
            `;
        }

        return '';
    }

    /**
     * Format data source name
     */
    formatDataSource(source) {
        switch (source) {
            case 'usps_ai': return 'USPS + AI Resolution';
            case 'census': return 'Census Geocoder';
            case 'usps': return 'USPS API';
            case 'nominatim': return 'OpenStreetMap Nominatim';
            case 'both': return 'Multiple Sources';
            default: return source || 'Unknown';
        }
    }

    /**
     * Get full party name
     */
    getFullPartyName(party) {
        switch (party) {
            case 'D': return 'Democrat';
            case 'R': return 'Republican';
            case 'I': return 'Independent';
            default: return 'Unknown';
        }
    }

    /**
     * Focus on the location on map
     */
    focusOnMap() {
        if (this.currentSearchResult) {
            // Use event bus or callback to request map focus
            if (this.eventBus) {
                this.eventBus.emit('focusMapLocation', {
                    lat: this.currentSearchResult.lat,
                    lon: this.currentSearchResult.lon,
                    zoom: 12
                });
            } else if (this.callbacks.onFocusMap) {
                this.callbacks.onFocusMap(
                    this.currentSearchResult.lat,
                    this.currentSearchResult.lon,
                    12
                );
            }
        }
    }

    /**
     * Show district details in the sidebar
     */
    showDistrictDetails(districtInfo) {
        // Use event bus or callback to request district details display
        if (this.eventBus) {
            this.eventBus.emit('showDistrictDetails', districtInfo);
        } else if (this.callbacks.onShowDistrictDetails) {
            this.callbacks.onShowDistrictDetails(districtInfo);
        }
    }

    /**
     * Toggle boundary visualization on/off
     */
    toggleBoundaryVisualization() {
        if (this.boundaryDistanceModule && this.currentBoundaryResult) {
            if (this.boundaryDistanceModule.boundaryLine) {
                // Clear visualization
                this.boundaryDistanceModule.clearBoundaryVisualization();
            } else {
                // Show visualization
                this.boundaryDistanceModule.displayBoundaryVisualization(this.currentBoundaryResult);
            }
        }
    }

    /**
     * Clear search and focus on search input
     */
    clearAndFocusSearch() {
        // Use event bus or callback to request search clear
        if (this.eventBus) {
            this.eventBus.emit('clearSearchInput');
        } else if (this.callbacks.onClearSearch) {
            this.callbacks.onClearSearch();
        }
        this.clear();
    }

    /**
     * Clear the display
     */
    clear() {
        this.sidepanelInterface.clear();
        this.currentSearchResult = null;
        if (this.boundaryDistanceModule) {
            this.boundaryDistanceModule.clearBoundaryVisualization();
        }
        this.currentBoundaryResult = null;
    }

    /**
     * Hide the sidepanel
     */
    hide() {
        this.sidepanelInterface.hide();
        this.currentSearchResult = null;
        if (this.boundaryDistanceModule) {
            this.boundaryDistanceModule.clearBoundaryVisualization();
        }
        this.currentBoundaryResult = null;
    }

    /**
     * Get current search result
     */
    getCurrentSearchResult() {
        return this.currentSearchResult;
    }

    /**
     * Check if sidepanel is visible
     */
    isVisible() {
        return this.sidepanelInterface.isVisible();
    }

    /**
     * Get the sidepanel interface for direct access if needed
     */
    getSidepanelInterface() {
        return this.sidepanelInterface;
    }

    /**
     * Register callback functions for actions (alternative to event bus)
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    /**
     * Set event bus for communication
     * @param {Object} eventBus - Event bus instance
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Set boundary distance module
     * @param {Object} boundaryDistanceModule - Boundary distance module instance
     */
    setBoundaryDistanceModule(boundaryDistanceModule) {
        this.boundaryDistanceModule = boundaryDistanceModule;
    }

    /**
     * Cleanup when destroying
     */
    destroy() {
        this.sidepanelInterface.destroy();
        this.currentSearchResult = null;
        this.currentBoundaryResult = null;
        if (this.boundaryDistanceModule) {
            this.boundaryDistanceModule.clearBoundaryVisualization();
        }
        this.callbacks = {};
        this.eventBus = null;
        this.boundaryDistanceModule = null;
    }
}