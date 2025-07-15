export class AddressModal {
    constructor(mapManager, ui) {
        this.mapManager = mapManager;
        this.ui = ui;
        this.modal = document.getElementById('addressModal');
        this.form = document.getElementById('addressForm');
        this.stateSelect = document.getElementById('state');
        this.resultsDiv = document.getElementById('addressValidationResults');
        
        this.init();
    }
    
    init() {
        // Load USPS states
        this.loadUSPSStates();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    async loadUSPSStates() {
        try {
            const response = await fetch('/ssddmap/api/usps-states');
            if (!response.ok) throw new Error('Failed to load states');
            
            const states = await response.json();
            
            // Clear existing options except the first one
            this.stateSelect.innerHTML = '<option value="">Select State</option>';
            
            // Add state options
            states.forEach(state => {
                const option = document.createElement('option');
                option.value = state.code;
                option.textContent = state.name;
                this.stateSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading USPS states:', error);
            // Fallback to basic US states if API fails
            this.loadFallbackStates();
        }
    }
    
    loadFallbackStates() {
        const fallbackStates = [
            { code: 'AL', name: 'Alabama' },
            { code: 'AK', name: 'Alaska' },
            { code: 'AZ', name: 'Arizona' },
            { code: 'AR', name: 'Arkansas' },
            { code: 'CA', name: 'California' },
            { code: 'CO', name: 'Colorado' },
            { code: 'CT', name: 'Connecticut' },
            { code: 'DE', name: 'Delaware' },
            { code: 'DC', name: 'District of Columbia' },
            { code: 'FL', name: 'Florida' },
            { code: 'GA', name: 'Georgia' },
            { code: 'HI', name: 'Hawaii' },
            { code: 'ID', name: 'Idaho' },
            { code: 'IL', name: 'Illinois' },
            { code: 'IN', name: 'Indiana' },
            { code: 'IA', name: 'Iowa' },
            { code: 'KS', name: 'Kansas' },
            { code: 'KY', name: 'Kentucky' },
            { code: 'LA', name: 'Louisiana' },
            { code: 'ME', name: 'Maine' },
            { code: 'MD', name: 'Maryland' },
            { code: 'MA', name: 'Massachusetts' },
            { code: 'MI', name: 'Michigan' },
            { code: 'MN', name: 'Minnesota' },
            { code: 'MS', name: 'Mississippi' },
            { code: 'MO', name: 'Missouri' },
            { code: 'MT', name: 'Montana' },
            { code: 'NE', name: 'Nebraska' },
            { code: 'NV', name: 'Nevada' },
            { code: 'NH', name: 'New Hampshire' },
            { code: 'NJ', name: 'New Jersey' },
            { code: 'NM', name: 'New Mexico' },
            { code: 'NY', name: 'New York' },
            { code: 'NC', name: 'North Carolina' },
            { code: 'ND', name: 'North Dakota' },
            { code: 'OH', name: 'Ohio' },
            { code: 'OK', name: 'Oklahoma' },
            { code: 'OR', name: 'Oregon' },
            { code: 'PA', name: 'Pennsylvania' },
            { code: 'RI', name: 'Rhode Island' },
            { code: 'SC', name: 'South Carolina' },
            { code: 'SD', name: 'South Dakota' },
            { code: 'TN', name: 'Tennessee' },
            { code: 'TX', name: 'Texas' },
            { code: 'UT', name: 'Utah' },
            { code: 'VT', name: 'Vermont' },
            { code: 'VA', name: 'Virginia' },
            { code: 'WA', name: 'Washington' },
            { code: 'WV', name: 'West Virginia' },
            { code: 'WI', name: 'Wisconsin' },
            { code: 'WY', name: 'Wyoming' }
        ];
        
        this.stateSelect.innerHTML = '<option value="">Select State</option>';
        fallbackStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state.code;
            option.textContent = state.name;
            this.stateSelect.appendChild(option);
        });
    }
    
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Cancel button
        document.getElementById('cancelAddressBtn').addEventListener('click', () => this.close());
        
        // Close button
        const closeBtn = this.modal.querySelector('.close');
        closeBtn.addEventListener('click', () => this.close());
        
        // Click outside modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }
    
    show() {
        this.modal.style.display = 'flex';
        // Reset form
        this.form.reset();
        this.resultsDiv.style.display = 'none';
        this.resultsDiv.innerHTML = '';
        // Focus on first input
        setTimeout(() => {
            document.getElementById('streetAddress').focus();
        }, 100);
    }
    
    close() {
        this.modal.style.display = 'none';
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Get form values
        const streetAddress = document.getElementById('streetAddress').value.trim();
        const apartment = document.getElementById('apartment').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value;
        const zipCode = document.getElementById('zipCode').value.trim();
        
        // Construct address string
        let addressParts = [streetAddress];
        if (apartment) addressParts[0] += ' ' + apartment;
        addressParts.push(city);
        
        let stateZip = state;
        if (zipCode) stateZip += ' ' + zipCode;
        addressParts.push(stateZip);
        
        const fullAddress = addressParts.join(', ');
        
        // Show loading state
        this.showLoading();
        
        try {
            // Validate address
            const response = await fetch('/ssddmap/api/validate-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ address: fullAddress })
            });
            
            if (!response.ok) {
                throw new Error('Validation failed');
            }
            
            const results = await response.json();
            this.displayResults(results);
            
        } catch (error) {
            console.error('Address validation error:', error);
            this.ui.showNotification('Error validating address', 'error');
            this.hideLoading();
        }
    }
    
    showLoading() {
        this.resultsDiv.innerHTML = `
            <div class="modal-loading">
                <div class="modal-spinner"></div>
                <span>Validating address...</span>
            </div>
        `;
        this.resultsDiv.style.display = 'block';
    }
    
    hideLoading() {
        this.resultsDiv.style.display = 'none';
        this.resultsDiv.innerHTML = '';
    }
    
    displayResults(results) {
        this.resultsDiv.innerHTML = '<h4>Validation Results</h4>';
        
        // Check USPS results first
        if (results.methods && results.methods.usps && results.methods.usps.success) {
            const usps = results.methods.usps;
            
            const resultCard = document.createElement('div');
            resultCard.className = 'address-result-card';
            
            resultCard.innerHTML = `
                <div class="address-result-header">
                    <div class="address-result-title">USPS Standardized Address</div>
                    <span class="address-status-badge">Verified</span>
                </div>
                <div class="address-details">
                    <div class="address-line">${usps.standardized.street}</div>
                    <div class="address-line">${usps.standardized.city}, ${usps.standardized.state} ${usps.standardized.zipCode}-${usps.standardized.zipPlus4}</div>
                </div>
            `;
            
            // Add district info if available
            if (usps.district) {
                resultCard.innerHTML += `
                    <div class="district-info-inline">
                        <span class="district-badge">${usps.district.state}-${usps.district.district}</span>
                        <span>Congressional District</span>
                    </div>
                `;
            }
            
            // Add use button
            const useBtn = document.createElement('button');
            useBtn.className = 'use-address-btn';
            useBtn.textContent = 'Use This Address';
            useBtn.onclick = () => this.useAddress(usps);
            
            resultCard.appendChild(useBtn);
            this.resultsDiv.appendChild(resultCard);
            
        } else if (results.methods && results.methods.census && results.methods.census.success) {
            // Fallback to Census results
            const census = results.methods.census;
            
            const resultCard = document.createElement('div');
            resultCard.className = 'address-result-card';
            
            resultCard.innerHTML = `
                <div class="address-result-header">
                    <div class="address-result-title">Census Geocoded Address</div>
                    <span class="address-status-badge">Found</span>
                </div>
                <div class="address-details">
                    <div class="address-line">${census.standardized.street}</div>
                    <div class="address-line">${census.standardized.city}, ${census.standardized.state} ${census.standardized.zip}</div>
                </div>
            `;
            
            // Add district info if available
            if (census.district) {
                resultCard.innerHTML += `
                    <div class="district-info-inline">
                        <span class="district-badge">${census.district.state}-${census.district.district}</span>
                        <span>Congressional District</span>
                    </div>
                `;
            }
            
            // Add use button
            const useBtn = document.createElement('button');
            useBtn.className = 'use-address-btn';
            useBtn.textContent = 'Use This Address';
            useBtn.onclick = () => this.useAddress(census);
            
            resultCard.appendChild(useBtn);
            this.resultsDiv.appendChild(resultCard);
            
        } else {
            // No results found
            this.resultsDiv.innerHTML += `
                <div class="address-result-card">
                    <div class="address-result-header">
                        <div class="address-result-title">No Results Found</div>
                        <span class="address-status-badge" style="background: #fee; color: #c00;">Not Found</span>
                    </div>
                    <div class="address-details">
                        <p>Unable to validate this address. Please check the address and try again.</p>
                    </div>
                </div>
            `;
        }
        
        this.resultsDiv.style.display = 'block';
    }
    
    async useAddress(result) {
        if (!result.coordinates || !result.district) {
            this.ui.showNotification('Cannot use this address - missing location data', 'error');
            return;
        }
        
        // Close modal
        this.close();
        
        // Navigate to the location on map
        const coords = result.coordinates;
        this.mapManager.map.flyTo([coords.lat, coords.lon], 10, {
            duration: 1.5
        });
        
        // Create a marker
        const marker = L.marker([coords.lat, coords.lon], {
            icon: L.divIcon({
                className: 'address-marker-usps',
                html: '<div class="marker-pin"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        });
        
        marker.bindPopup(`
            <div class="popup-content">
                <h4>Validated Address</h4>
                <p>${result.standardized.street}<br>
                ${result.standardized.city}, ${result.standardized.state} ${result.standardized.zipCode || result.standardized.zip}</p>
                <p><strong>District:</strong> ${result.district.state}-${result.district.district}</p>
            </div>
        `);
        
        // Add to map
        marker.addTo(this.mapManager.map);
        marker.openPopup();
        
        // Load district boundaries
        if (result.district) {
            await this.mapManager.loadStateDistricts(result.district.state);
            this.mapManager.highlightDistrict(result.district.state, result.district.district);
        }
        
        this.ui.showNotification('Address validated and displayed on map', 'success');
    }
}