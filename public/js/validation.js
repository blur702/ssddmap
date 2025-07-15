/**
 * Address Validation Module
 * Handles validation mode functionality, comparison display, and visual markers
 */

export class ValidationManager {
    constructor() {
        this.isValidationMode = false;
        this.validationMarkers = [];
        this.boundaryLayer = null;
        this.currentValidationResult = null;
    }

    /**
     * Initialize validation manager with required dependencies
     */
    initialize(mapManager, uiManager) {
        this.map = mapManager;
        this.ui = uiManager;
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for validation mode
     */
    setupEventHandlers() {
        // Validation mode toggle
        const validationToggle = document.getElementById('toggleValidationMode');
        if (validationToggle) {
            validationToggle.addEventListener('change', (e) => {
                this.toggleValidationMode(e.target.checked);
            });
        }

        // Validation button
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validateAddress();
            });
        }

        // Enter key support for validation input
        const validationInput = document.getElementById('validationAddress');
        if (validationInput) {
            validationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.validateAddress();
                }
            });
        }
    }

    /**
     * Toggle validation mode on/off
     */
    toggleValidationMode(enabled) {
        this.isValidationMode = enabled;
        const validationPanel = document.getElementById('validationPanel');
        
        if (enabled) {
            validationPanel.style.display = 'block';
            this.ui.showNotification('Validation mode enabled - test addresses for accuracy', 'info');
        } else {
            validationPanel.style.display = 'none';
            this.clearValidationMarkers();
            this.clearBoundaryLayer();
            this.ui.showNotification('Validation mode disabled', 'info');
        }
    }

    /**
     * Validate address using all available methods
     */
    async validateAddress() {
        const addressInput = document.getElementById('validationAddress');
        const address = addressInput ? addressInput.value.trim() : '';
        
        console.log('Validating address:', address);
        
        if (!address) {
            this.ui.showNotification('Please enter an address to validate', 'warning');
            return;
        }

        const resultsContainer = document.getElementById('validationResults');
        resultsContainer.innerHTML = '<div class="loading">Validating address...</div>';

        try {
            const response = await fetch('/ssddmap/api/validate-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ address })
            });

            if (!response.ok) {
                throw new Error(`Validation failed: ${response.status}`);
            }

            const results = await response.json();
            this.currentValidationResult = results;
            
            this.displayValidationResults(results);
            this.addValidationMarkersToMap(results);
            
        } catch (error) {
            console.error('Validation error:', error);
            resultsContainer.innerHTML = `<div class="error">Validation failed: ${error.message}</div>`;
        }
    }

    /**
     * Display validation results in the UI
     */
    displayValidationResults(results) {
        const container = document.getElementById('validationResults');
        
        const html = `
            <div class="validation-comparison">
                ${this.renderMethodResults(results.methods)}
                ${this.renderAnalysis(results.analysis)}
                ${this.renderAddressMarkers(results.methods)}
            </div>
        `;
        
        container.innerHTML = html;
    }

    /**
     * Render results for each validation method
     */
    renderMethodResults(methods) {
        let html = '';
        
        // USPS Method
        if (methods.usps) {
            html += this.renderMethodCard('USPS Standardization', methods.usps, 'usps');
        }

        // Census Method
        if (methods.census) {
            html += this.renderMethodCard('Census Geocoding', methods.census, 'census');
        }

        // Google Method
        if (methods.google) {
            html += this.renderMethodCard('Google Maps', methods.google, 'google');
        }

        return html;
    }

    /**
     * Render individual method result card
     */
    renderMethodCard(title, result, source) {
        const statusClass = result.success ? 'success' : 'error';
        const statusText = result.success ? 'Success' : 'Failed';
        
        let detailsHtml = '';
        
        if (result.success) {
            // Show standardized address
            if (result.standardized) {
                detailsHtml += `
                    <div class="validation-details">
                        <div class="validation-detail">
                            <span class="validation-detail-label">Address:</span>
                            <span class="validation-detail-value">${this.formatAddress(result.standardized)}</span>
                        </div>
                `;
                
                if (result.coordinates) {
                    detailsHtml += `
                        <div class="validation-detail">
                            <span class="validation-detail-label">Coordinates:</span>
                            <span class="validation-detail-value">${result.coordinates.lat.toFixed(6)}, ${result.coordinates.lon.toFixed(6)}</span>
                        </div>
                    `;
                }
            }

            // Show district assignment
            if (result.district) {
                detailsHtml += `
                        <div class="validation-detail">
                            <span class="validation-detail-label">District:</span>
                            <span class="validation-detail-value">${result.district.state}-${result.district.district}</span>
                        </div>
                `;
            }

            detailsHtml += '</div>';

            // Add "Use This Address" button for USPS results with coordinates
            if (source === 'usps' && result.coordinates && result.district) {
                detailsHtml += `
                    <div class="validation-action" style="margin-top: 10px;">
                        <button class="btn btn-primary use-address-btn" 
                                onclick="window.validationManager.useStandardizedAddress(${JSON.stringify(result).replace(/"/g, '&quot;')})">
                            Use This Address
                        </button>
                    </div>
                `;
            }

            // Show distance to boundary if available
            if (result.distanceToBoundary) {
                const distance = result.distanceToBoundary;
                detailsHtml += `
                    <div class="boundary-distance">
                        <div class="distance-info">
                            <span>Distance to boundary:</span>
                            <span class="distance-value">${distance.distanceMiles.toFixed(2)} miles</span>
                        </div>
                    </div>
                `;
            }

            // Show nearest district if not found in district
            if (result.nearestDistrict) {
                detailsHtml += `
                    <div class="validation-detail">
                        <span class="validation-detail-label">Nearest District:</span>
                        <span class="validation-detail-value">${result.nearestDistrict.state}-${result.nearestDistrict.district} (${(result.nearestDistrict.distanceMeters / 1609.34).toFixed(2)} miles away)</span>
                    </div>
                `;
            }
        } else {
            detailsHtml = `<div class="error">${result.error}</div>`;
        }

        return `
            <div class="validation-method">
                <div class="validation-method-header">
                    <span class="validation-method-title">${title}</span>
                    <span class="validation-status ${statusClass}">${statusText}</span>
                </div>
                ${detailsHtml}
            </div>
        `;
    }

    /**
     * Render analysis section
     */
    renderAnalysis(analysis) {
        if (!analysis) return '';

        const consistencyClass = analysis.consistency === 'consistent' ? 'success' : 
                               analysis.consistency === 'inconsistent' ? 'error' : 'warning';
        
        let issuesHtml = '';
        if (analysis.issues.length > 0) {
            issuesHtml = `
                <div class="validation-details">
                    <div class="validation-detail-label">Issues:</div>
                    ${analysis.issues.map(issue => `<div style="color: var(--error-color); font-size: 0.8rem;">• ${issue}</div>`).join('')}
                </div>
            `;
        }

        let recommendationsHtml = '';
        if (analysis.recommendations.length > 0) {
            recommendationsHtml = `
                <div class="validation-details">
                    <div class="validation-detail-label">Recommendations:</div>
                    ${analysis.recommendations.map(rec => `<div style="color: var(--success-color); font-size: 0.8rem;">• ${rec}</div>`).join('')}
                </div>
            `;
        }

        return `
            <div class="validation-method">
                <div class="validation-method-header">
                    <span class="validation-method-title">Analysis</span>
                    <span class="validation-status ${consistencyClass}">${analysis.consistency}</span>
                </div>
                ${issuesHtml}
                ${recommendationsHtml}
            </div>
        `;
    }

    /**
     * Render address markers legend
     */
    renderAddressMarkers(methods) {
        const markers = [];
        
        if (methods.usps && methods.usps.success && methods.usps.coordinates) {
            markers.push({ name: 'USPS Location', class: 'usps' });
        }
        if (methods.census && methods.census.success && methods.census.coordinates) {
            markers.push({ name: 'Census Location', class: 'census' });
        }
        if (methods.google && methods.google.success && methods.google.coordinates) {
            markers.push({ name: 'Google Location', class: 'google' });
        }

        if (markers.length === 0) return '';

        return `
            <div class="address-markers">
                <div class="address-markers-title">Map Markers</div>
                <div class="markers-legend">
                    ${markers.map(marker => `
                        <div class="marker-item">
                            <div class="marker-color ${marker.class}"></div>
                            <span>${marker.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Add validation markers to the map
     */
    addValidationMarkersToMap(results) {
        this.clearValidationMarkers();
        
        const methods = results.methods;
        const bounds = [];

        // Add USPS marker (blue)
        if (methods.usps && methods.usps.success && methods.usps.coordinates) {
            const marker = this.createValidationMarker(
                methods.usps.coordinates.lat,
                methods.usps.coordinates.lon,
                'USPS Standardized Location',
                '#3b82f6'
            );
            this.validationMarkers.push(marker);
            bounds.push([methods.usps.coordinates.lat, methods.usps.coordinates.lon]);
        }

        // Add Census marker (green)
        if (methods.census && methods.census.success && methods.census.coordinates) {
            const marker = this.createValidationMarker(
                methods.census.coordinates.lat,
                methods.census.coordinates.lon,
                'Census Geocoded Location',
                '#10b981'
            );
            this.validationMarkers.push(marker);
            bounds.push([methods.census.coordinates.lat, methods.census.coordinates.lon]);
        }

        // Add Google marker (red)
        if (methods.google && methods.google.success && methods.google.coordinates) {
            const marker = this.createValidationMarker(
                methods.google.coordinates.lat,
                methods.google.coordinates.lon,
                'Google Maps Location',
                '#ef4444'
            );
            this.validationMarkers.push(marker);
            bounds.push([methods.google.coordinates.lat, methods.google.coordinates.lon]);
        }

        // Fit map to show all markers
        if (bounds.length > 0) {
            if (bounds.length === 1) {
                this.map.getMap().setView(bounds[0], 15);
            } else {
                this.map.getMap().fitBounds(bounds, { padding: [50, 50] });
            }
        }

        // Highlight the district boundary if we have a successful result
        this.highlightDistrictBoundary(results);
    }

    /**
     * Create a validation marker with custom styling
     */
    createValidationMarker(lat, lon, title, color) {
        const marker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindTooltip(title, {
            permanent: false,
            direction: 'top'
        });

        marker.addTo(this.map.getMap());
        return marker;
    }

    /**
     * Highlight district boundary for validation
     */
    highlightDistrictBoundary(results) {
        this.clearBoundaryLayer();

        // Find a successful district result to highlight
        const methods = results.methods;
        let targetDistrict = null;

        if (methods.census && methods.census.success && methods.census.district) {
            targetDistrict = methods.census.district;
        } else if (methods.usps && methods.usps.success && methods.usps.district) {
            targetDistrict = methods.usps.district;
        } else if (methods.google && methods.google.success && methods.google.district) {
            targetDistrict = methods.google.district;
        }

        if (targetDistrict) {
            this.fetchAndHighlightDistrict(targetDistrict.state, targetDistrict.district);
        }
    }

    /**
     * Fetch and highlight district geometry
     */
    async fetchAndHighlightDistrict(state, district) {
        try {
            const response = await fetch(`/ssddmap/api/district/${state}/${district}`);
            if (!response.ok) return;

            const data = await response.json();
            if (data.geojson && data.geojson.features.length > 0) {
                
                this.boundaryLayer = L.geoJSON(data.geojson, {
                    style: {
                        color: '#2563eb',
                        weight: 3,
                        opacity: 0.8,
                        fillColor: 'transparent',
                        dashArray: '10, 5'
                    }
                });

                this.boundaryLayer.addTo(this.map.getMap());
            }

        } catch (error) {
            console.error('Error highlighting district boundary:', error);
        }
    }

    /**
     * Clear validation markers from map
     */
    clearValidationMarkers() {
        this.validationMarkers.forEach(marker => {
            this.map.getMap().removeLayer(marker);
        });
        this.validationMarkers = [];
    }

    /**
     * Clear district boundary layer
     */
    clearBoundaryLayer() {
        if (this.boundaryLayer) {
            this.map.getMap().removeLayer(this.boundaryLayer);
            this.boundaryLayer = null;
        }
    }

    /**
     * Use standardized address from validation result
     */
    useStandardizedAddress(result) {
        if (!result || !result.coordinates || !result.district) {
            this.ui.showNotification('Cannot use this address - missing coordinates or district', 'error');
            return;
        }

        // Clear validation markers
        this.clearValidationMarkers();
        this.clearBoundaryLayer();

        // Create a marker for the address
        const marker = L.marker([result.coordinates.lat, result.coordinates.lon], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });

        const addressString = this.formatAddress(result.standardized);
        marker.bindPopup(`
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 10px 0;">USPS Validated Address</h4>
                <p style="margin: 5px 0;"><strong>${addressString}</strong></p>
                <p style="margin: 5px 0;">District: <strong>${result.district.state}-${result.district.district}</strong></p>
                ${result.additionalInfo ? `<p style="margin: 5px 0; font-size: 0.9em;">ZIP+4: ${result.standardized.zipCode}-${result.standardized.zipPlus4}</p>` : ''}
            </div>
        `).openPopup();

        marker.addTo(this.map.getMap());
        this.validationMarkers.push(marker);

        // Zoom to the location
        this.map.getMap().setView([result.coordinates.lat, result.coordinates.lon], 15);

        // Highlight the district
        this.fetchAndHighlightDistrict(result.district.state, result.district.district);

        // Show success message
        this.ui.showNotification(`Address validated and located in district ${result.district.state}-${result.district.district}`, 'success');

        // Update the address input with the standardized address
        const addressInput = document.getElementById('validationAddress');
        if (addressInput) {
            addressInput.value = addressString;
        }
    }

    /**
     * Format address object into readable string
     */
    formatAddress(address) {
        const parts = [];
        
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) {
            const statePart = address.state + (address.zip || address.zipCode ? ` ${address.zip || address.zipCode}` : '');
            if (address.zipPlus4 || address.zip4) {
                parts.push(statePart + `-${address.zipPlus4 || address.zip4}`);
            } else {
                parts.push(statePart);
            }
        }
        
        return parts.join(', ');
    }
}