/**
 * Search Module - Handles address search and geocoding functionality
 */
export class SearchManager {
    constructor() {
        this.searchTimeout = null;
        this.searchResults = [];
        this.selectedResultIndex = -1;
        this.autosuggestEnabled = true;
        this.currentLocationMethod = 'census';
        this.callbacks = {};
    }
    
    /**
     * Initialize search functionality
     * @param {Object} elements - DOM elements used by search
     */
    initialize(elements) {
        this.elements = elements;
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
                result = {
                    address: address,
                    lat: preselectedResult.lat,
                    lon: preselectedResult.lon,
                    source: 'nominatim'
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
            case 'census':
                return await this.geocodeWithCensus(address);
            case 'both':
                return await this.geocodeWithBoth(address);
            default:
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
            const response = await fetch('/ssddmap/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });
            
            if (!response.ok) throw new Error('Geocoding failed');
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return {
                address: data.address || address,
                lat: data.lat,
                lon: data.lon,
                source: 'census',
                state: data.state,
                district: data.district
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