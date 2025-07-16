/**
 * Boundary Distance Module - Calculates and displays distance to district boundaries
 * This module handles boundary distance calculations and visualization on the map
 */
export class BoundaryDistanceModule {
    constructor(mapCore, eventBus = null) {
        this.mapCore = mapCore;
        this.eventBus = eventBus;
        this.callbacks = {};
        
        // Map elements for boundary visualization
        this.boundaryLine = null;
        this.boundaryMarker = null;
        this.addressMarker = null;
    }

    /**
     * Calculate distance to district boundary for a given address
     * @param {Object} coordinates - Address coordinates
     * @param {number} coordinates.lat - Latitude
     * @param {number} coordinates.lon - Longitude
     * @param {Object} districtInfo - District information
     * @param {string} districtInfo.state - State abbreviation
     * @param {string} districtInfo.district - District number
     * @returns {Object} Boundary distance result
     */
    async calculateBoundaryDistance(coordinates, districtInfo) {
        try {
            if (!districtInfo.state || !districtInfo.district) {
                return {
                    success: false,
                    error: 'District information required for boundary calculation'
                };
            }

            const response = await fetch('/ssddmap/api/closest-boundary-point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lat: coordinates.lat,
                    lon: coordinates.lon,
                    state: districtInfo.state,
                    district: districtInfo.district
                })
            });

            if (!response.ok) {
                throw new Error(`Boundary API error: ${response.status}`);
            }

            const boundaryData = await response.json();

            if (boundaryData.success && boundaryData.closestPoint) {
                return {
                    success: true,
                    distance: boundaryData.distance,
                    closestPoint: boundaryData.closestPoint,
                    addressPoint: coordinates,
                    districtInfo: districtInfo
                };
            } else {
                return {
                    success: false,
                    error: boundaryData.error || 'Boundary calculation failed'
                };
            }

        } catch (error) {
            console.error('Boundary distance calculation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Display boundary distance visualization on the map
     * @param {Object} boundaryResult - Result from calculateBoundaryDistance
     * @param {Object} options - Display options
     */
    displayBoundaryVisualization(boundaryResult, options = {}) {
        if (!boundaryResult.success || !this.mapCore) {
            return;
        }

        // Clear any existing boundary visualization
        this.clearBoundaryVisualization();

        const map = this.mapCore.getMap();
        if (!map) return;

        try {
            // Add address marker
            this.addressMarker = L.marker([
                boundaryResult.addressPoint.lat, 
                boundaryResult.addressPoint.lon
            ], {
                icon: L.divIcon({
                    className: 'address-marker',
                    html: '📍',
                    iconSize: [20, 20],
                    iconAnchor: [10, 20]
                })
            }).addTo(map);

            // Add boundary point marker
            this.boundaryMarker = L.circleMarker([
                boundaryResult.closestPoint.lat, 
                boundaryResult.closestPoint.lon
            ], {
                radius: 6,
                fillColor: '#ffffff',
                color: '#000000',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(map);

            // Add line connecting address to boundary
            const lineCoords = [
                [boundaryResult.addressPoint.lat, boundaryResult.addressPoint.lon],
                [boundaryResult.closestPoint.lat, boundaryResult.closestPoint.lon]
            ];

            this.boundaryLine = L.polyline(lineCoords, {
                color: options.lineColor || '#ffffff',
                weight: options.lineWeight || 3,
                opacity: options.lineOpacity || 0.9,
                dashArray: options.dashArray || '10, 5'
            }).addTo(map);

            // Add tooltips
            const distanceText = this.formatDistance(boundaryResult.distance);
            
            this.addressMarker.bindTooltip('Address Location', {
                permanent: false,
                direction: 'top'
            });

            this.boundaryMarker.bindTooltip('Closest Boundary Point', {
                permanent: false,
                direction: 'top'
            });

            this.boundaryLine.bindTooltip(`Distance to boundary: ${distanceText}`, {
                permanent: false,
                direction: 'center'
            });

            // Fit map to show both points
            const group = L.featureGroup([this.addressMarker, this.boundaryMarker]);
            map.fitBounds(group.getBounds(), { 
                padding: [20, 20],
                maxZoom: 15 
            });

            return {
                success: true,
                markers: {
                    address: this.addressMarker,
                    boundary: this.boundaryMarker,
                    line: this.boundaryLine
                }
            };

        } catch (error) {
            console.error('Error displaying boundary visualization:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear boundary visualization from the map
     */
    clearBoundaryVisualization() {
        const map = this.mapCore.getMap();
        if (!map) return;

        if (this.addressMarker) {
            map.removeLayer(this.addressMarker);
            this.addressMarker = null;
        }

        if (this.boundaryMarker) {
            map.removeLayer(this.boundaryMarker);
            this.boundaryMarker = null;
        }

        if (this.boundaryLine) {
            map.removeLayer(this.boundaryLine);
            this.boundaryLine = null;
        }
    }

    /**
     * Format distance for display
     * @param {Object} distance - Distance object with multiple units
     * @returns {string} Formatted distance string
     */
    formatDistance(distance) {
        if (!distance) return 'Unknown distance';

        if (distance.miles < 0.1) {
            return `${Math.round(distance.feet)} feet`;
        } else if (distance.miles < 10) {
            return `${distance.miles.toFixed(2)} miles`;
        } else {
            return `${Math.round(distance.miles)} miles`;
        }
    }

    /**
     * Get detailed distance information for display
     * @param {Object} distance - Distance object
     * @returns {Object} Formatted distance details
     */
    getDistanceDetails(distance) {
        if (!distance) return null;

        return {
            primary: this.formatDistance(distance),
            feet: `${Math.round(distance.feet)} feet`,
            meters: `${Math.round(distance.meters)} meters`,
            miles: `${distance.miles.toFixed(3)} miles`,
            kilometers: `${distance.kilometers.toFixed(3)} km`
        };
    }

    /**
     * Calculate and display boundary distance in one call
     * @param {Object} coordinates - Address coordinates
     * @param {Object} districtInfo - District information
     * @param {Object} displayOptions - Display options
     * @returns {Object} Complete boundary result with visualization
     */
    async calculateAndDisplay(coordinates, districtInfo, displayOptions = {}) {
        const boundaryResult = await this.calculateBoundaryDistance(coordinates, districtInfo);
        
        if (boundaryResult.success) {
            const visualResult = this.displayBoundaryVisualization(boundaryResult, displayOptions);
            
            // Emit events if available
            if (this.eventBus) {
                this.eventBus.emit('boundaryDistanceCalculated', {
                    ...boundaryResult,
                    visualization: visualResult
                });
            }
            
            // Call callbacks
            if (this.callbacks.onBoundaryCalculated) {
                this.callbacks.onBoundaryCalculated(boundaryResult, visualResult);
            }
        }

        return boundaryResult;
    }

    /**
     * Register callback functions
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
     * Cleanup when destroying
     */
    destroy() {
        this.clearBoundaryVisualization();
        this.callbacks = {};
        this.eventBus = null;
    }
}