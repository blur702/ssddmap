/**
 * Search Module - Handles address search and geocoding functionality
 */
export class SearchManager {
    constructor() {
        this.searchTimeout = null;
        this.searchResults = [];
        this.selectedResultIndex = -1;
        this.autosuggestEnabled = true;
        this.currentLocationMethod = 'usps_ai'; // Changed to use USPS + AI workflow
        this.callbacks = {};
        this.addressResolutionModule = null;
    }
    
    /**
     * Initialize search functionality
     * @param {Object} elements - DOM elements used by search
     * @param {Object} addressResolutionModule - Address resolution module for USPS + AI workflow
     */
    initialize(elements, addressResolutionModule = null) {
        this.elements = elements;
        this.addressResolutionModule = addressResolutionModule;
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners for search functionality
     */
    setupEventListeners() {
        if (!this.elements.addressInput || !this.elements.searchBtn) {
            console.error('Required search elements not found');
            return;
        }
        
        // Address input events
        this.elements.addressInput.addEventListener('input', (e) => {
            this.handleAddressInput(e.target.value);
        });
        
        this.elements.addressInput.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        // Search button click
        this.elements.searchBtn.addEventListener('click', () => {
            this.performSearch(this.elements.addressInput.value);
        });
        
        // Form submission
        const form = this.elements.addressInput.closest('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performSearch(this.elements.addressInput.value);
            });
        }
        
        // Autosuggest toggle
        if (this.elements.autosuggestToggle) {
            this.elements.autosuggestToggle.addEventListener('change', (e) => {
                this.autosuggestEnabled = e.target.checked;
                if (!this.autosuggestEnabled) {
                    this.hideResults();
                }
            });
        }
        
        // Click outside to close results
        document.addEventListener('click', (e) => {
            if (!this.elements.addressInput.contains(e.target) && 
                !this.elements.searchResults.contains(e.target)) {
                this.hideResults();
            }
        });
    }
    
    /**
     * Handle address input changes
     * @param {string} value - Input value
     */
    handleAddressInput(value) {
        if (!this.autosuggestEnabled) return;
        
        clearTimeout(this.searchTimeout);
        
        if (value.length < 3) {
            this.hideResults();
            return;
        }
        
        this.searchTimeout = setTimeout(() => {
            this.fetchSuggestions(value);
        }, 300);
    }
    
    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (!this.searchResults.length) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedResultIndex = Math.min(
                    this.selectedResultIndex + 1, 
                    this.searchResults.length - 1
                );
                this.updateResultsDisplay();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.selectedResultIndex = Math.max(this.selectedResultIndex - 1, 0);
                this.updateResultsDisplay();
                break;
                
            case 'Enter':
                event.preventDefault();
                if (this.selectedResultIndex >= 0) {
                    this.selectResult(this.searchResults[this.selectedResultIndex]);
                } else {
                    this.performSearch(this.elements.addressInput.value);
                }
                break;
                
            case 'Escape':
                this.hideResults();
                break;
        }
    }
    
    /**
     * Fetch address suggestions
     * @param {string} query - Search query
     */
    async fetchSuggestions(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` + 
                `format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`
            );
            
            if (!response.ok) throw new Error('Suggestion fetch failed');
            
            const data = await response.json();
            this.searchResults = data.map(item => ({
                display_name: item.display_name,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                boundingbox: item.boundingbox,
                type: item.type,
                importance: item.importance
            }));
            
            this.selectedResultIndex = -1;
            this.updateResultsDisplay();
            
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.searchResults = [];
            this.hideResults();
        }
    }
    
    /**
     * Update the display of search results
     */
    updateResultsDisplay() {
        if (!this.searchResults.length) {
            this.hideResults();
            return;
        }
        
        const resultsHtml = this.searchResults
            .map((result, index) => {
                const isSelected = index === this.selectedResultIndex;
                return `
                    <div class="search-result ${isSelected ? 'selected' : ''}" 
                         data-index="${index}">
                        ${this.formatAddress(result.display_name)}
                    </div>
                `;
            })
            .join('');
        
        this.elements.searchResults.innerHTML = resultsHtml;
        this.elements.searchResults.style.display = 'block';
        
        // Add click handlers
        this.elements.searchResults.querySelectorAll('.search-result').forEach((el, index) => {
            el.addEventListener('click', () => {
                this.selectResult(this.searchResults[index]);
            });
        });
    }
    
    /**
     * Format address for display
     * @param {string} address - Full address string
     * @returns {string} Formatted address
     */
    formatAddress(address) {
        // Remove country from the end if it's USA
        return address.replace(/, United States$/, '');
    }
    
    /**
     * Select a search result
     * @param {Object} result - Selected result
     */
    selectResult(result) {
        this.elements.addressInput.value = this.formatAddress(result.display_name);
        this.hideResults();
        this.performSearch(result.display_name, result);
    }
    
    /**
     * Hide search results
     */
    hideResults() {
        this.elements.searchResults.style.display = 'none';
        this.searchResults = [];
        this.selectedResultIndex = -1;
    }
    
    /**
     * Perform address search
     * @param {string} address - Address to search
     * @param {Object} preselectedResult - Optional pre-selected result
     */
    async performSearch(address, preselectedResult = null) {
        if (!address.trim()) return;
        
        try {
            if (this.callbacks.onSearchStart) {
                this.callbacks.onSearchStart();
            }
            
            let result;
            
            if (preselectedResult) {
                // For preselected results (from autosuggest), we need to do district lookup
                const districtResponse = await fetch(`/ssddmap/api/find-district?lat=${preselectedResult.lat}&lon=${preselectedResult.lon}`);
                const districtData = await districtResponse.json();
                
                result = {
                    address: address,
                    lat: preselectedResult.lat,
                    lon: preselectedResult.lon,
                    source: 'nominatim',
                    state: districtData.found ? districtData.state : null,
                    district: districtData.found ? districtData.district : null,
                    member: districtData.found ? districtData.member : null,
                    districtInfo: districtData
                };
            } else {
                // Use selected location method
                result = await this.geocodeAddress(address);
            }
            
            if (result && this.callbacks.onSearchComplete) {
                this.callbacks.onSearchComplete(result);
            }
            
        } catch (error) {
            console.error('Search error:', error);
            if (this.callbacks.onSearchError) {
                this.callbacks.onSearchError(error);
            }
        }
    }
    
    /**
     * Geocode an address using the selected method
     * @param {string} address - Address to geocode
     * @returns {Object} Geocoding result
     */
    async geocodeAddress(address) {
        switch (this.currentLocationMethod) {
            case 'usps_ai':
                return await this.geocodeWithUSPSAI(address);
            case 'census':
                return await this.geocodeWithCensus(address);
            case 'both':
                return await this.geocodeWithBoth(address);
            default:
                return await this.geocodeWithUSPSAI(address);
        }
    }
    
    /**
     * Geocode using USPS + AI intelligent address resolution
     * @param {string} address - Address to geocode
     * @returns {Object} Geocoding result
     */
    async geocodeWithUSPSAI(address) {
        try {
            if (!this.addressResolutionModule) {
                console.warn('AddressResolutionModule not available, falling back to Census');
                return await this.geocodeWithCensus(address);
            }

            console.log('🚀 Starting USPS + AI address resolution for:', address);
            
            // Step 1: Resolve address using USPS + AI to get ZIP+4
            const resolutionResult = await this.addressResolutionModule.resolveAddress(address);
            
            if (!resolutionResult.success) {
                console.warn('USPS + AI resolution failed, falling back to Census');
                return await this.geocodeWithCensus(address);
            }

            console.log('✅ Address resolved with ZIP+4:', resolutionResult.zip4);

            // Step 2: Check if we already have district info from the validation response
            let districtData = { found: false };
            if (resolutionResult.uspsData && resolutionResult.uspsData.methods && resolutionResult.uspsData.methods.usps && resolutionResult.uspsData.methods.usps.district) {
                const uspsDistrict = resolutionResult.uspsData.methods.usps.district;
                districtData = {
                    found: true,
                    state: uspsDistrict.state,
                    district: uspsDistrict.district,
                    member: uspsDistrict.member || null
                };
            }

            // Step 3: If ZIP+4 district lookup fails, try coordinate-based lookup
            let coordinates = null;
            if (!districtData.found && resolutionResult.uspsData && resolutionResult.uspsData.coordinates) {
                coordinates = resolutionResult.uspsData.coordinates;
                const coordDistrictResponse = await fetch(`/ssddmap/api/find-district?lat=${coordinates.lat}&lon=${coordinates.lon}`);
                if (coordDistrictResponse.ok) {
                    const coordDistrictData = await coordDistrictResponse.json();
                    if (coordDistrictData.found) {
                        districtData = coordDistrictData;
                    }
                }
            }

            // Step 4: If we still don't have coordinates, geocode the final address
            if (!coordinates) {
                const geocodeResponse = await fetch(`/ssddmap/api/geocode?address=${encodeURIComponent(resolutionResult.finalAddress)}`);
                if (geocodeResponse.ok) {
                    const geocodeData = await geocodeResponse.json();
                    if (geocodeData && geocodeData.length > 0) {
                        coordinates = {
                            lat: geocodeData[0].lat,
                            lon: geocodeData[0].lon
                        };
                        
                        // Try district lookup with geocoded coordinates if we don't have district yet
                        if (!districtData.found) {
                            const coordDistrictResponse = await fetch(`/ssddmap/api/find-district?lat=${coordinates.lat}&lon=${coordinates.lon}`);
                            if (coordDistrictResponse.ok) {
                                const coordDistrictData = await coordDistrictResponse.json();
                                if (coordDistrictData.found) {
                                    districtData = coordDistrictData;
                                }
                            }
                        }
                    }
                }
            }

            // Ensure we have coordinates
            if (!coordinates) {
                throw new Error('Could not obtain coordinates for resolved address');
            }

            return {
                address: resolutionResult.finalAddress,
                lat: coordinates.lat,
                lon: coordinates.lon,
                source: 'usps_ai',
                zip4: resolutionResult.zip4,
                state: districtData.found ? districtData.state : null,
                district: districtData.found ? districtData.district : null,
                member: districtData.found ? districtData.member : null,
                districtInfo: districtData,
                resolutionSummary: this.addressResolutionModule.getResolutionSummary(resolutionResult),
                uspsStandardized: true,
                geminiCorrections: resolutionResult.geminiCorrections
            };
            
        } catch (error) {
            console.error('USPS + AI geocoding error:', error);
            console.warn('Falling back to Census geocoder');
            return await this.geocodeWithCensus(address);
        }
    }
    
    /**
     * Geocode using Census Geocoder
     * @param {string} address - Address to geocode
     * @returns {Object} Geocoding result
     */
    async geocodeWithCensus(address) {
        try {
            const response = await fetch(`/ssddmap/api/geocode?address=${encodeURIComponent(address)}`);
            
            if (!response.ok) throw new Error('Geocoding failed');
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('No geocoding results found');
            }
            
            // Get the first (best) result
            const result = data[0];
            
            // Now find district information for these coordinates
            const districtResponse = await fetch(`/ssddmap/api/find-district?lat=${result.lat}&lon=${result.lon}`);
            const districtData = await districtResponse.json();
            
            return {
                address: result.display_name || address,
                lat: result.lat,
                lon: result.lon,
                source: 'census',
                state: districtData.found ? districtData.state : null,
                district: districtData.found ? districtData.district : null,
                member: districtData.found ? districtData.member : null,
                districtInfo: districtData
            };
            
        } catch (error) {
            console.error('Census geocoding error:', error);
            throw error;
        }
    }
    
    /**
     * Geocode using both methods for comparison
     * @param {string} address - Address to geocode
     * @returns {Object} Geocoding result
     */
    async geocodeWithBoth(address) {
        try {
            const response = await fetch('/ssddmap/api/geocode-compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });
            
            if (!response.ok) throw new Error('Geocoding comparison failed');
            
            const data = await response.json();
            
            // Use Census result as primary
            return {
                address: data.census?.address || address,
                lat: data.census?.lat,
                lon: data.census?.lon,
                source: 'both',
                comparison: data,
                state: data.census?.state,
                district: data.census?.district
            };
            
        } catch (error) {
            console.error('Geocoding comparison error:', error);
            // Fall back to Census only
            return await this.geocodeWithCensus(address);
        }
    }
    
    /**
     * Set location method
     * @param {string} method - Location method ('census', 'zip4', 'both')
     */
    setLocationMethod(method) {
        this.currentLocationMethod = method;
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