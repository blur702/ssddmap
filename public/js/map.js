/**
 * Map Module - Handles all map-related functionality
 */
export class MapManager {
    constructor() {
        this.map = null;
        this.currentBaseLayer = null;
        this.currentLabelLayer = null;
        this.districtLayers = {};
        this.stateOutlineLayer = null;
        this.countyLayer = null;
        this.markers = [];
        this.currentStyle = 'voyager';
        
        // Map style configurations
        this.mapStyles = {
            dark: {
                base: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
                labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors © CARTO'
            },
            light: {
                base: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
                labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors © CARTO'
            },
            voyager: {
                base: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
                labels: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors © CARTO'
            },
            satellite: {
                base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
                attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN'
            },
            terrain: {
                base: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-background/{z}/{x}/{y}{r}.png',
                labels: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-labels/{z}/{x}/{y}{r}.png',
                attribution: 'Map tiles by Stamen Design, CC BY 3.0. Data by OpenStreetMap'
            }
        };
    }
    
    /**
     * Initialize the map
     * @param {string} containerId - The ID of the map container element
     * @returns {boolean} Success status
     */
    initialize(containerId) {
        const mapElement = document.getElementById(containerId);
        if (!mapElement) {
            console.error(`Map container element '${containerId}' not found`);
            return false;
        }
        
        try {
            // Initialize map with smooth zoom animations
            this.map = L.map(containerId, {
                zoomAnimation: true,
                zoomAnimationThreshold: 4,
                fadeAnimation: true,
                markerZoomAnimation: true,
                minZoom: 2,
                maxZoom: 12
            }).setView([39.8283, -98.5795], 4); // Center of continental USA
            
            // Create custom panes for proper layering
            this.map.createPane('districts');
            this.map.getPane('districts').style.zIndex = 200;
            this.map.createPane('countyLabels');
            this.map.getPane('countyLabels').style.zIndex = 300;
            
            // Set initial map style
            this.setStyle(this.currentStyle);
            
            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            return false;
        }
    }
    
    /**
     * Set map style
     * @param {string} style - The style name
     */
    setStyle(style) {
        const styleConfig = this.mapStyles[style] || this.mapStyles.voyager;
        
        // Remove existing layers
        if (this.currentBaseLayer) {
            this.map.removeLayer(this.currentBaseLayer);
        }
        if (this.currentLabelLayer) {
            this.map.removeLayer(this.currentLabelLayer);
        }
        
        // Add new base layer
        this.currentBaseLayer = L.tileLayer(styleConfig.base, {
            attribution: styleConfig.attribution,
            subdomains: 'abcd',
            maxZoom: 12,
            minZoom: 3,
            pane: 'tilePane'
        }).addTo(this.map);
        
        // Add new label layer
        this.currentLabelLayer = L.tileLayer(styleConfig.labels, {
            subdomains: 'abcd',
            maxZoom: 12,
            minZoom: 3,
            pane: 'shadowPane'
        }).addTo(this.map);
        
        this.currentStyle = style;
    }
    
    /**
     * Add a district layer to the map
     * @param {Object} geojsonData - GeoJSON data for the district
     * @param {Object} options - Layer options
     * @returns {L.Layer} The created layer
     */
    addDistrictLayer(geojsonData, options = {}) {
        const defaultOptions = {
            pane: 'districts',
            style: {
                weight: 1,
                opacity: 0.8,
                color: '#444444',
                fillOpacity: 0.4,
                fillColor: '#6b7280'
            }
        };
        
        const layer = L.geoJSON(geojsonData, {
            ...defaultOptions,
            ...options
        });
        
        layer.addTo(this.map);
        return layer;
    }
    
    /**
     * Clear all district layers
     */
    clearDistricts() {
        Object.values(this.districtLayers).forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.districtLayers = {};
    }
    
    /**
     * Add a marker to the map
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} options - Marker options
     * @returns {L.Marker} The created marker
     */
    addMarker(lat, lng, options = {}) {
        const marker = L.marker([lat, lng], options).addTo(this.map);
        this.markers.push(marker);
        return marker;
    }
    
    /**
     * Clear all markers
     */
    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    }
    
    /**
     * Fit map bounds to a layer or coordinates
     * @param {L.Layer|Array} target - Layer or bounds array
     * @param {Object} options - Fit bounds options
     */
    fitBounds(target, options = {}) {
        const defaultOptions = {
            padding: [50, 50],
            maxZoom: 10
        };
        
        if (target instanceof L.Layer) {
            this.map.fitBounds(target.getBounds(), { ...defaultOptions, ...options });
        } else if (Array.isArray(target)) {
            this.map.fitBounds(target, { ...defaultOptions, ...options });
        }
    }
    
    /**
     * Get the current map instance
     * @returns {L.Map} The Leaflet map instance
     */
    getMap() {
        return this.map;
    }
    
    /**
     * Set view to show entire USA
     */
    viewUSA() {
        this.map.setView([39.8283, -98.5795], 4);
    }
    
    /**
     * Handle district click
     * @param {Function} callback - Callback function for district clicks
     */
    onDistrictClick(callback) {
        this._districtClickCallback = callback;
    }
    
    /**
     * Handle district hover
     * @param {Function} callback - Callback function for district hover
     */
    onDistrictHover(callback) {
        this._districtHoverCallback = callback;
    }
}