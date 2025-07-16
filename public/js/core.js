/**
 * Core Module - Essential map and district functionality
 * Manages the core map instance and district layer system
 */
export class Core {
    constructor() {
        this.map = null;
        this.districtLayers = {};
        this.currentGlowLayer = null;
        this.eventBus = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the core with event bus
     */
    initialize(mapElementId, eventBus) {
        console.log('🏗️ Initializing Core module...');
        
        this.eventBus = eventBus;
        
        // Initialize Leaflet map
        this.map = L.map(mapElementId, {
            center: [39.8283, -98.5795],
            zoom: 4,
            zoomControl: true,
            attributionControl: true
        });

        // Set default tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.isInitialized = true;
        console.log('✅ Core module initialized');
        
        return this.map;
    }

    /**
     * Add a district layer to the map
     */
    addDistrictLayer(feature, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Core not initialized');
        }

        const layer = L.geoJSON(feature, {
            style: options.style || {
                weight: 1,
                opacity: 0.8,
                color: '#444444',
                fillOpacity: 0.4,
                fillColor: '#6b7280'
            },
            onEachFeature: options.onEachFeature
        }).addTo(this.map);

        // Store layer with district key
        const state = feature.properties.state;
        const district = feature.properties.district;
        const districtKey = `${state}-${district}`;
        
        this.districtLayers[districtKey] = layer;

        // Emit event for plugins
        this.eventBus?.emit('districtLayerAdded', {
            districtKey,
            layer,
            feature
        });

        return layer;
    }

    /**
     * Update district layer style
     */
    updateDistrictStyle(districtKey, style) {
        const layer = this.districtLayers[districtKey];
        if (layer && layer.setStyle) {
            layer.setStyle(style);
            
            // Emit event for plugins
            this.eventBus?.emit('districtStyleUpdated', {
                districtKey,
                style
            });
            
            return true;
        }
        return false;
    }

    /**
     * Get all district layers
     */
    getDistrictLayers() {
        return { ...this.districtLayers };
    }

    /**
     * Clear all district layers
     */
    clearDistrictLayers() {
        Object.values(this.districtLayers).forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.districtLayers = {};
        
        this.eventBus?.emit('districtLayersCleared');
    }

    /**
     * Get the Leaflet map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Set map view
     */
    setView(lat, lon, zoom = 10) {
        if (this.map) {
            this.map.setView([lat, lon], zoom);
        }
    }

    /**
     * Fit map to bounds
     */
    fitBounds(bounds) {
        if (this.map && bounds) {
            this.map.fitBounds(bounds);
        }
    }

    /**
     * View USA (default view)
     */
    viewUSA() {
        this.setView(39.8283, -98.5795, 4);
    }

    /**
     * Add marker to map
     */
    addMarker(lat, lon, options = {}) {
        const marker = L.marker([lat, lon], options).addTo(this.map);
        return marker;
    }

    /**
     * Clear all markers
     */
    clearMarkers() {
        this.map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                this.map.removeLayer(layer);
            }
        });
    }

    /**
     * Highlight district with glow effect
     */
    highlightDistrict(districtKey, style = {}) {
        // Remove previous glow
        if (this.currentGlowLayer) {
            this.map.removeLayer(this.currentGlowLayer);
            this.currentGlowLayer = null;
        }

        const layer = this.districtLayers[districtKey];
        if (layer) {
            // Update layer style
            layer.setStyle({
                weight: 6,
                color: style.color || '#ffffff',
                opacity: 1,
                fillOpacity: 0.6
            });
            layer.bringToFront();

            this.eventBus?.emit('districtHighlighted', { districtKey });
        }
    }

    /**
     * Remove district highlight
     */
    removeHighlight(districtKey) {
        if (this.currentGlowLayer) {
            this.map.removeLayer(this.currentGlowLayer);
            this.currentGlowLayer = null;
        }

        this.eventBus?.emit('districtHighlightRemoved', { districtKey });
    }
}