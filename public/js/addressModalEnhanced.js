export class AddressModalEnhanced {
    constructor(mapManager, ui) {
        this.mapManager = mapManager;
        this.ui = ui;
        this.modal = document.getElementById('addressModal');
        this.form = document.getElementById('addressForm');
        this.stateSelect = document.getElementById('state');
        this.resultsContainer = document.getElementById('validationResultsContainer');
        
        // API status tracking
        this.apiStatus = {
            usps: { configured: false, enabled: true },
            census: { configured: true, enabled: true },
            google: { configured: false, enabled: false }
        };
        
        // Result storage
        this.currentResults = {};
        
        this.init();
    }
    
    async init() {
        // Load USPS states
        await this.loadUSPSStates();
        
        // Check API configuration status
        await this.checkAPIStatus();
        
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
                option.textContent = state.code;
                this.stateSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading USPS states:', error);
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
            option.textContent = state.code;
            this.stateSelect.appendChild(option);
        });
    }
    
    async checkAPIStatus() {
        try {
            const response = await fetch('/ssddmap/api/validation-status');
            if (!response.ok) throw new Error('Failed to check API status');
            
            const status = await response.json();
            
            // Update USPS status
            this.apiStatus.usps.configured = status.usps.configured && status.usps.tokenValid;
            const uspsStatus = document.getElementById('uspsApiStatus');
            const uspsToggle = document.getElementById('toggleUSPS');
            if (this.apiStatus.usps.configured) {
                uspsStatus.textContent = 'Ready';
                uspsStatus.className = 'api-status ready';
            } else {
                uspsStatus.textContent = 'Not Configured';
                uspsStatus.className = 'api-status not-configured';
                uspsToggle.checked = false;
                uspsToggle.disabled = true;
            }
            
            // Update Census status (always ready)
            const censusStatus = document.getElementById('censusApiStatus');
            censusStatus.textContent = 'Ready';
            censusStatus.className = 'api-status ready';
            
            // Update Google status
            this.apiStatus.google.configured = status.google.configured;
            const googleStatus = document.getElementById('googleApiStatus');
            const googleToggle = document.getElementById('toggleGoogle');
            if (this.apiStatus.google.configured) {
                googleStatus.textContent = 'Ready';
                googleStatus.className = 'api-status ready';
                googleToggle.checked = true;
            } else {
                googleStatus.textContent = 'Not Configured';
                googleStatus.className = 'api-status not-configured';
                googleToggle.checked = false;
                googleToggle.disabled = true;
            }
            
        } catch (error) {
            console.error('Error checking API status:', error);
        }
    }
    
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Cancel button
        document.getElementById('cancelAddressBtn').addEventListener('click', () => this.close());
        
        // Clear results button
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());
        
        // Close button
        const closeBtn = this.modal.querySelector('.close');
        closeBtn.addEventListener('click', () => this.close());
        
        // Click outside modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        // API toggle changes
        document.getElementById('toggleUSPS').addEventListener('change', (e) => {
            this.apiStatus.usps.enabled = e.target.checked;
            this.updateColumnVisibility('usps', e.target.checked);
        });
        
        document.getElementById('toggleCensus').addEventListener('change', (e) => {
            this.apiStatus.census.enabled = e.target.checked;
            this.updateColumnVisibility('census', e.target.checked);
        });
        
        document.getElementById('toggleGoogle').addEventListener('change', (e) => {
            this.apiStatus.google.enabled = e.target.checked;
            this.updateColumnVisibility('google', e.target.checked);
        });
    }
    
    show() {
        this.modal.style.display = 'flex';
        // Reset form but keep results if any
        this.form.reset();
        // Restore toggle states
        document.getElementById('toggleUSPS').checked = this.apiStatus.usps.enabled && this.apiStatus.usps.configured;
        document.getElementById('toggleCensus').checked = this.apiStatus.census.enabled;
        document.getElementById('toggleGoogle').checked = this.apiStatus.google.enabled && this.apiStatus.google.configured;
        // Focus on first input
        setTimeout(() => {
            document.getElementById('streetAddress').focus();
        }, 100);
    }
    
    close() {
        this.modal.style.display = 'none';
    }
    
    clearResults() {
        this.resultsContainer.style.display = 'none';
        this.currentResults = {};
        // Clear all columns
        ['usps', 'census', 'google'].forEach(api => {
            const column = document.getElementById(`${api}ResultColumn`);
            if (column) column.style.display = 'none';
        });
        document.getElementById('comparisonSummary').style.display = 'none';
    }
    
    updateColumnVisibility(api, isVisible) {
        // Only update visibility if we have results
        if (this.resultsContainer.style.display !== 'none') {
            const column = document.getElementById(`${api}ResultColumn`);
            if (column) {
                // If toggled off, hide the column
                if (!isVisible) {
                    column.style.display = 'none';
                } else if (this.currentResults[api]) {
                    // If toggled on and we have results, show the column
                    column.style.display = 'block';
                }
                
                // Update comparison if multiple results exist
                const enabledResults = Object.keys(this.currentResults).filter(key => 
                    this.apiStatus[key] && this.apiStatus[key].enabled
                );
                
                if (enabledResults.length > 1) {
                    this.compareResults();
                } else {
                    document.getElementById('comparisonSummary').style.display = 'none';
                }
            }
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Check if at least one API is enabled
        const enabledAPIs = [];
        if (this.apiStatus.usps.enabled && this.apiStatus.usps.configured) enabledAPIs.push('usps');
        if (this.apiStatus.census.enabled) enabledAPIs.push('census');
        if (this.apiStatus.google.enabled && this.apiStatus.google.configured) enabledAPIs.push('google');
        
        if (enabledAPIs.length === 0) {
            this.ui.showNotification('Please enable at least one validation service', 'error');
            return;
        }
        
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
        
        // Clear previous results
        this.currentResults = {};
        
        // Show results container
        this.resultsContainer.style.display = 'block';
        
        // Validate with each enabled API
        const validationPromises = enabledAPIs.map(api => this.validateWithAPI(api, fullAddress));
        
        try {
            await Promise.all(validationPromises);
            
            // Compare results if multiple APIs were used
            if (Object.keys(this.currentResults).length > 1) {
                this.compareResults();
            }
            
        } catch (error) {
            console.error('Validation error:', error);
            this.ui.showNotification('Error during validation', 'error');
        }
        
        // Hide loading state
        this.hideLoading();
    }
    
    showLoading() {
        const btn = document.getElementById('validateAddressBtn');
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loading').style.display = 'inline-flex';
        btn.disabled = true;
    }
    
    hideLoading() {
        const btn = document.getElementById('validateAddressBtn');
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loading').style.display = 'none';
        btn.disabled = false;
    }
    
    async validateWithAPI(api, address) {
        const column = document.getElementById(`${api}ResultColumn`);
        const content = document.getElementById(`${api}ResultContent`);
        const status = document.getElementById(`${api}ResultStatus`);
        
        // Show column with loading state
        column.style.display = 'block';
        status.textContent = 'Validating...';
        status.className = 'result-status loading';
        content.innerHTML = this.getLoadingSkeleton();
        
        try {
            // Call validation API
            const response = await fetch('/ssddmap/api/validate-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    address: address,
                    methods: [api] // Request specific method
                })
            });
            
            if (!response.ok) {
                throw new Error('Validation failed');
            }
            
            const results = await response.json();
            
            // Store results
            this.currentResults[api] = results.methods[api];
            
            // Display results
            this.displayAPIResults(api, results.methods[api]);
            
        } catch (error) {
            console.error(`${api} validation error:`, error);
            status.textContent = 'Error';
            status.className = 'result-status error';
            content.innerHTML = `
                <div class="result-error">
                    <p>Unable to validate address with ${api.toUpperCase()}</p>
                    <p class="error-detail">${error.message}</p>
                </div>
            `;
        }
    }
    
    displayAPIResults(api, result) {
        const content = document.getElementById(`${api}ResultContent`);
        const status = document.getElementById(`${api}ResultStatus`);
        
        if (!result || !result.success) {
            status.textContent = 'Failed';
            status.className = 'result-status error';
            content.innerHTML = `
                <div class="result-error">
                    <p>${result?.error || 'Validation failed'}</p>
                </div>
            `;
            return;
        }
        
        status.textContent = 'Success';
        status.className = 'result-status success';
        
        let html = '<div class="result-address">';
        
        // Display standardized address
        if (result.standardized) {
            html += '<div class="result-address-line">';
            if (api === 'usps') {
                html += `${result.standardized.street}`;
                if (result.standardized.secondaryAddress) {
                    html += ` ${result.standardized.secondaryAddress}`;
                }
                html += `</div><div class="result-address-line">`;
                html += `${result.standardized.city}, ${result.standardized.state} ${result.standardized.zipCode}`;
                if (result.standardized.zipPlus4) {
                    html += `-${result.standardized.zipPlus4}`;
                }
            } else {
                html += `${result.standardized.street}</div>`;
                html += `<div class="result-address-line">${result.standardized.city}, ${result.standardized.state} ${result.standardized.zip}</div>`;
            }
            html += '</div>';
        }
        
        html += '</div>';
        
        // Display district
        if (result.district) {
            html += `
                <div class="result-district">
                    <div class="district-label">Congressional District</div>
                    <div class="district-value">${result.district.state}-${result.district.district}</div>
                </div>
            `;
        }
        
        // Display additional details
        html += '<div class="result-details">';
        
        if (result.coordinates) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">Coordinates</span>
                    <span class="detail-value">${result.coordinates.lat.toFixed(6)}, ${result.coordinates.lon.toFixed(6)}</span>
                </div>
            `;
        }
        
        if (result.additionalInfo && api === 'usps') {
            if (result.additionalInfo.countyName) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">County</span>
                        <span class="detail-value">${result.additionalInfo.countyName}</span>
                    </div>
                `;
            }
            if (result.additionalInfo.carrierRoute) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">Carrier Route</span>
                        <span class="detail-value">${result.additionalInfo.carrierRoute}</span>
                    </div>
                `;
            }
        }
        
        if (result.distanceToBoundary) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">Distance to Boundary</span>
                    <span class="detail-value">${result.distanceToBoundary.distanceMeters.toFixed(0)}m</span>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Add use button
        html += `<button class="use-result-btn" onclick="window.addressModal.useResult('${api}')">Use This Address</button>`;
        
        content.innerHTML = html;
    }
    
    compareResults() {
        const comparisonDiv = document.getElementById('comparisonSummary');
        const comparisonContent = document.getElementById('comparisonContent');
        
        comparisonDiv.style.display = 'block';
        
        // Get all successful results
        const successfulAPIs = Object.keys(this.currentResults).filter(api => 
            this.currentResults[api] && this.currentResults[api].success
        );
        
        if (successfulAPIs.length < 2) {
            comparisonContent.innerHTML = '<p>Not enough successful results to compare.</p>';
            return;
        }
        
        let html = '';
        
        // Compare districts
        const districts = successfulAPIs.map(api => {
            const result = this.currentResults[api];
            return result.district ? `${result.district.state}-${result.district.district}` : null;
        }).filter(Boolean);
        
        const uniqueDistricts = [...new Set(districts)];
        
        if (uniqueDistricts.length === 1) {
            html += `
                <div class="comparison-item">
                    <div class="comparison-icon match">✓</div>
                    <div class="comparison-text">All services agree on district: <strong>${uniqueDistricts[0]}</strong></div>
                </div>
            `;
        } else if (uniqueDistricts.length > 1) {
            html += `
                <div class="comparison-item">
                    <div class="comparison-icon mismatch">!</div>
                    <div class="comparison-text">District mismatch detected: ${uniqueDistricts.join(' vs ')}</div>
                </div>
            `;
        }
        
        // Compare coordinates
        const coords = successfulAPIs.map(api => this.currentResults[api].coordinates).filter(Boolean);
        if (coords.length >= 2) {
            const maxLatDiff = Math.max(...coords.map(c => c.lat)) - Math.min(...coords.map(c => c.lat));
            const maxLonDiff = Math.max(...coords.map(c => c.lon)) - Math.min(...coords.map(c => c.lon));
            const maxDiff = Math.max(maxLatDiff, maxLonDiff);
            
            if (maxDiff < 0.001) {
                html += `
                    <div class="comparison-item">
                        <div class="comparison-icon match">✓</div>
                        <div class="comparison-text">Coordinates match closely (< 100m difference)</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="comparison-item">
                        <div class="comparison-icon mismatch">!</div>
                        <div class="comparison-text">Significant coordinate differences detected</div>
                    </div>
                `;
            }
        }
        
        // Check if any result is near a boundary
        const nearBoundary = successfulAPIs.some(api => {
            const result = this.currentResults[api];
            return result.distanceToBoundary && result.distanceToBoundary.distanceMeters < 100;
        });
        
        if (nearBoundary) {
            html += `
                <div class="comparison-item">
                    <div class="comparison-icon mismatch">!</div>
                    <div class="comparison-text">Address is very close to district boundary - manual verification recommended</div>
                </div>
            `;
        }
        
        comparisonContent.innerHTML = html;
    }
    
    getLoadingSkeleton() {
        return `
            <div class="result-loading">
                <div class="skeleton"></div>
                <div class="skeleton w-75"></div>
                <div class="skeleton w-50"></div>
                <div class="skeleton h-2"></div>
            </div>
        `;
    }
    
    async useResult(api) {
        const result = this.currentResults[api];
        if (!result || !result.success) {
            this.ui.showNotification('No valid result to use', 'error');
            return;
        }
        
        if (!result.coordinates || !result.district) {
            this.ui.showNotification('Missing location or district data', 'error');
            return;
        }
        
        // Close modal
        this.close();
        
        // Clear any existing validation markers and lines
        this.clearValidationResults();
        
        // Navigate to the location on map
        const coords = result.coordinates;
        this.mapManager.map.flyTo([coords.lat, coords.lon], 14, {
            duration: 1.5
        });
        
        // Create a marker
        const markerClass = `address-marker-${api}`;
        const markerColor = {
            usps: '#3b82f6',
            census: '#10b981',
            google: '#ef4444'
        }[api];
        
        const marker = L.marker([coords.lat, coords.lon], {
            icon: L.divIcon({
                className: markerClass,
                html: `<div class="marker-pin" style="background: ${markerColor}"></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        });
        
        const addressText = result.standardized ? 
            `${result.standardized.street}<br>${result.standardized.city}, ${result.standardized.state} ${result.standardized.zip || result.standardized.zipCode}` :
            'Validated Address';
        
        marker.bindPopup(`
            <div class="popup-content">
                <h4>${api.toUpperCase()} Validated Address</h4>
                <p>${addressText}</p>
                <p><strong>District:</strong> ${result.district.state}-${result.district.district}</p>
            </div>
        `);
        
        // Store marker for later cleanup
        this.currentMarker = marker;
        marker.addTo(this.mapManager.map);
        marker.openPopup();
        
        // Load district boundaries and calculate boundary point
        if (result.district) {
            await this.loadDistrictBoundaries(result.district.state, result.district.district);
            
            // Calculate and display boundary distance
            await this.displayBoundaryDistance(coords, result.district, result);
        }
        
        // Update sidebar with complete information
        this.updateSidebarWithValidation(result, api);
        
        this.ui.showNotification(`Address validated and displayed on map (${api.toUpperCase()})`, 'success');
    }
    
    clearValidationResults() {
        // Remove existing marker
        if (this.currentMarker) {
            this.mapManager.map.removeLayer(this.currentMarker);
            this.currentMarker = null;
        }
        
        // Remove existing boundary line
        if (this.boundaryLine) {
            this.mapManager.map.removeLayer(this.boundaryLine);
            this.boundaryLine = null;
        }
        
        // Remove boundary point marker
        if (this.boundaryMarker) {
            this.mapManager.map.removeLayer(this.boundaryMarker);
            this.boundaryMarker = null;
        }
    }
    
    async displayBoundaryDistance(coords, district, result) {
        try {
            // Get the closest point on the district boundary
            const response = await fetch('/ssddmap/api/closest-boundary-point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lat: coords.lat,
                    lon: coords.lon,
                    state: district.state,
                    district: district.district
                })
            });
            
            if (!response.ok) {
                console.error('Failed to get boundary point');
                return;
            }
            
            const boundaryData = await response.json();
            
            if (boundaryData.success && boundaryData.closestPoint) {
                // Create line from address to boundary
                const lineCoords = [
                    [coords.lat, coords.lon],
                    [boundaryData.closestPoint.lat, boundaryData.closestPoint.lon]
                ];
                
                this.boundaryLine = L.polyline(lineCoords, {
                    color: '#ff6b6b',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 5'
                });
                
                // Add tooltip with distance
                const distanceText = this.formatDistance(boundaryData.distance);
                this.boundaryLine.bindTooltip(`Distance to boundary: ${distanceText}`, {
                    permanent: false,
                    direction: 'center'
                });
                
                this.boundaryLine.addTo(this.mapManager.map);
                
                // Add small marker at boundary point
                this.boundaryMarker = L.circleMarker([boundaryData.closestPoint.lat, boundaryData.closestPoint.lon], {
                    radius: 6,
                    fillColor: '#ff6b6b',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
                
                this.boundaryMarker.bindTooltip('Closest boundary point', {
                    permanent: false
                });
                
                this.boundaryMarker.addTo(this.mapManager.map);
                
                // Store distance for sidebar display
                this.currentBoundaryDistance = boundaryData.distance;
            }
        } catch (error) {
            console.error('Error displaying boundary distance:', error);
        }
    }
    
    formatDistance(distance) {
        if (distance.miles < 0.1) {
            return `${Math.round(distance.feet)} feet`;
        } else if (distance.miles < 10) {
            return `${distance.miles.toFixed(2)} miles`;
        } else {
            return `${Math.round(distance.miles)} miles`;
        }
    }
    
    updateSidebarWithValidation(result, api) {
        // Show sidebar if not visible
        const sidebar = document.getElementById('info-sidebar');
        if (!sidebar.classList.contains('active')) {
            sidebar.classList.add('active');
        }
        
        // Update district info
        const districtInfo = document.getElementById('districtInfo');
        
        let html = `
            <div class="validation-result-display">
                <h4>Validated Address</h4>
                <div class="validated-address">
                    <p class="address-line">${result.standardized.street}</p>
                    <p class="address-line">${result.standardized.city}, ${result.standardized.state} ${result.standardized.zip || result.standardized.zipCode}</p>
                    <p class="api-source">Validated by ${api.toUpperCase()}</p>
                </div>
                
                <div class="district-section">
                    <h4>Congressional District</h4>
                    <div class="district-display">
                        <span class="district-number">${result.district.state}-${result.district.district}</span>
                    </div>
                </div>
        `;
        
        // Add boundary distance if available
        if (this.currentBoundaryDistance) {
            html += `
                <div class="boundary-distance-section">
                    <h4>Distance to District Boundary</h4>
                    <div class="distance-display">
                        <span class="distance-value">${this.formatDistance(this.currentBoundaryDistance)}</span>
                        <p class="distance-detail">
                            ${this.currentBoundaryDistance.meters.toFixed(0)} meters • 
                            ${this.currentBoundaryDistance.kilometers.toFixed(2)} km
                        </p>
                    </div>
                </div>
            `;
        }
        
        // Add additional info if available
        if (result.additionalInfo) {
            html += `
                <div class="additional-info-section">
                    <h4>Additional Information</h4>
                    <div class="info-details">
            `;
            
            if (result.additionalInfo.countyName) {
                html += `<p><strong>County:</strong> ${result.additionalInfo.countyName}</p>`;
            }
            if (result.additionalInfo.carrierRoute) {
                html += `<p><strong>Carrier Route:</strong> ${result.additionalInfo.carrierRoute}</p>`;
            }
            if (result.standardized.zipPlus4) {
                html += `<p><strong>ZIP+4:</strong> ${result.standardized.zipCode}-${result.standardized.zipPlus4}</p>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        districtInfo.innerHTML = html;
    }
    
    async loadDistrictBoundaries(state, district) {
        try {
            // First load all districts for the state
            await this.mapManager.loadStateDistricts(state);
            
            // Then highlight the specific district
            this.mapManager.highlightDistrict(state, district);
            
        } catch (error) {
            console.error('Error loading district boundaries:', error);
        }
    }
}

// Make it accessible globally for onclick handlers
window.addressModal = null;