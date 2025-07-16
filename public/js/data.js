/**
 * Data Module - Handles all data fetching and management
 */
export class DataManager {
    constructor() {
        this.cache = {
            states: [],
            districts: {},
            members: {},
            counties: {}
        };
        this.partyColors = {
            'D': '#3b82f6',
            'R': '#ef4444',
            'I': '#8b5cf6',
            'default': '#6b7280'
        };
    }
    
    /**
     * Fetch all US states
     * @returns {Array} Array of state objects
     */
    async fetchStates() {
        if (this.cache.states.length > 0) {
            return this.cache.states;
        }
        
        try {
            const response = await fetch('/ssddmap/api/states');
            if (!response.ok) throw new Error('Failed to fetch states');
            
            const stateCodes = await response.json();
            // Convert state codes to the expected format
            const states = this.getDefaultStates().filter(state => 
                stateCodes.includes(state.abbreviation)
            );
            this.cache.states = states;
            return states;
        } catch (error) {
            console.error('Error fetching states:', error);
            // Return hardcoded states as fallback
            return this.getDefaultStates();
        }
    }
    
    /**
     * Fetch districts for a state or all districts
     * @param {string} state - State abbreviation (optional)
     * @returns {Object} GeoJSON FeatureCollection
     */
    async fetchDistricts(state = null) {
        const cacheKey = state || 'all';
        
        if (this.cache.districts[cacheKey]) {
            return this.cache.districts[cacheKey];
        }
        
        try {
            const url = state 
                ? `/ssddmap/api/state/${state}`
                : '/ssddmap/api/all-districts';
                
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch districts');
            
            const data = await response.json();
            this.cache.districts[cacheKey] = data;
            return data;
            
        } catch (error) {
            console.error('Error fetching districts:', error);
            throw error;
        }
    }
    
    /**
     * Fetch House members data
     * @returns {Object} Members indexed by state-district
     */
    async fetchMembers() {
        if (Object.keys(this.cache.members).length > 0) {
            return this.cache.members;
        }
        
        try {
            const response = await fetch('/ssddmap/api/members');
            if (!response.ok) throw new Error('Failed to fetch members');
            
            const data = await response.json();
            
            // Data is already indexed by state-district
            this.cache.members = data;
            return data;
            
        } catch (error) {
            console.error('Error fetching members:', error);
            throw error;
        }
    }
    
    /**
     * Get member for a specific district
     * @param {string} state - State abbreviation
     * @param {string} district - District number
     * @returns {Object} Member information
     */
    async getMember(state, district) {
        if (Object.keys(this.cache.members).length === 0) {
            await this.fetchMembers();
        }
        
        const key = `${state}-${district}`;
        return this.cache.members[key] || null;
    }
    
    /**
     * Fetch county boundaries
     * @returns {Object} GeoJSON FeatureCollection
     */
    async fetchCounties() {
        if (this.cache.counties.boundaries) {
            return this.cache.counties.boundaries;
        }
        
        try {
            const response = await fetch('/ssddmap/api/county-boundaries');
            if (!response.ok) throw new Error('Failed to fetch counties');
            
            const data = await response.json();
            this.cache.counties.boundaries = data;
            return data;
            
        } catch (error) {
            console.error('Error fetching counties:', error);
            throw error;
        }
    }
    
    /**
     * Get cache status
     * @returns {Object} Cache status information
     */
    async getCacheStatus() {
        try {
            const response = await fetch('/ssddmap/api/cache-status');
            if (!response.ok) throw new Error('Failed to fetch cache status');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching cache status:', error);
            return { error: true };
        }
    }
    
    /**
     * Refresh member cache
     * @returns {Object} Refresh result
     */
    async refreshMemberCache() {
        try {
            const response = await fetch('/ssddmap/api/refresh-cache', {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to refresh cache');
            
            const result = await response.json();
            
            // Clear local cache
            this.cache.members = {};
            
            return result;
        } catch (error) {
            console.error('Error refreshing cache:', error);
            throw error;
        }
    }
    
    /**
     * Get configuration status
     * @returns {Object} Configuration status
     */
    async getConfigStatus() {
        try {
            const response = await fetch('/ssddmap/api/config-status');
            if (!response.ok) throw new Error('Failed to fetch config status');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching config status:', error);
            return { error: true };
        }
    }
    
    /**
     * Save configuration
     * @param {Object} config - Configuration object
     * @returns {Object} Save result
     */
    async saveConfig(config) {
        try {
            const response = await fetch('/ssddmap/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (!response.ok) throw new Error('Failed to save configuration');
            
            return await response.json();
        } catch (error) {
            console.error('Error saving configuration:', error);
            throw error;
        }
    }
    
    /**
     * Get color for party
     * @param {string} party - Party letter (D, R, I)
     * @returns {string} Hex color code
     */
    getPartyColor(party) {
        return this.partyColors[party] || this.partyColors.default;
    }
    
    /**
     * Get default states (fallback)
     * @returns {Array} Array of state objects
     */
    getDefaultStates() {
        return [
            { abbreviation: 'AL', name: 'Alabama' },
            { abbreviation: 'AK', name: 'Alaska' },
            { abbreviation: 'AZ', name: 'Arizona' },
            { abbreviation: 'AR', name: 'Arkansas' },
            { abbreviation: 'CA', name: 'California' },
            { abbreviation: 'CO', name: 'Colorado' },
            { abbreviation: 'CT', name: 'Connecticut' },
            { abbreviation: 'DC', name: 'District of Columbia' },
            { abbreviation: 'DE', name: 'Delaware' },
            { abbreviation: 'FL', name: 'Florida' },
            { abbreviation: 'GA', name: 'Georgia' },
            { abbreviation: 'HI', name: 'Hawaii' },
            { abbreviation: 'ID', name: 'Idaho' },
            { abbreviation: 'IL', name: 'Illinois' },
            { abbreviation: 'IN', name: 'Indiana' },
            { abbreviation: 'IA', name: 'Iowa' },
            { abbreviation: 'KS', name: 'Kansas' },
            { abbreviation: 'KY', name: 'Kentucky' },
            { abbreviation: 'LA', name: 'Louisiana' },
            { abbreviation: 'ME', name: 'Maine' },
            { abbreviation: 'MD', name: 'Maryland' },
            { abbreviation: 'MA', name: 'Massachusetts' },
            { abbreviation: 'MI', name: 'Michigan' },
            { abbreviation: 'MN', name: 'Minnesota' },
            { abbreviation: 'MS', name: 'Mississippi' },
            { abbreviation: 'MO', name: 'Missouri' },
            { abbreviation: 'MT', name: 'Montana' },
            { abbreviation: 'NE', name: 'Nebraska' },
            { abbreviation: 'NV', name: 'Nevada' },
            { abbreviation: 'NH', name: 'New Hampshire' },
            { abbreviation: 'NJ', name: 'New Jersey' },
            { abbreviation: 'NM', name: 'New Mexico' },
            { abbreviation: 'NY', name: 'New York' },
            { abbreviation: 'NC', name: 'North Carolina' },
            { abbreviation: 'ND', name: 'North Dakota' },
            { abbreviation: 'OH', name: 'Ohio' },
            { abbreviation: 'OK', name: 'Oklahoma' },
            { abbreviation: 'OR', name: 'Oregon' },
            { abbreviation: 'PA', name: 'Pennsylvania' },
            { abbreviation: 'RI', name: 'Rhode Island' },
            { abbreviation: 'SC', name: 'South Carolina' },
            { abbreviation: 'SD', name: 'South Dakota' },
            { abbreviation: 'TN', name: 'Tennessee' },
            { abbreviation: 'TX', name: 'Texas' },
            { abbreviation: 'UT', name: 'Utah' },
            { abbreviation: 'VT', name: 'Vermont' },
            { abbreviation: 'VA', name: 'Virginia' },
            { abbreviation: 'WA', name: 'Washington' },
            { abbreviation: 'WV', name: 'West Virginia' },
            { abbreviation: 'WI', name: 'Wisconsin' },
            { abbreviation: 'WY', name: 'Wyoming' },
            { abbreviation: 'AS', name: 'American Samoa' },
            { abbreviation: 'GU', name: 'Guam' },
            { abbreviation: 'MP', name: 'Northern Mariana Islands' },
            { abbreviation: 'PR', name: 'Puerto Rico' },
            { abbreviation: 'VI', name: 'Virgin Islands' }
        ];
    }
    
    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache = {
            states: [],
            districts: {},
            members: {},
            counties: {}
        };
    }
}