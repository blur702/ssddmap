/**
 * Unit tests for MapManager module
 */
import { MapManager } from '../../public/js/map.js';

describe('MapManager', () => {
    let mapManager;
    let mockMapElement;
    
    beforeEach(() => {
        // Mock DOM element
        mockMapElement = document.createElement('div');
        mockMapElement.id = 'test-map';
        document.body.appendChild(mockMapElement);
        
        // Mock Leaflet
        global.L = {
            map: jest.fn().mockReturnValue({
                setView: jest.fn().mockReturnThis(),
                createPane: jest.fn(),
                getPane: jest.fn().mockReturnValue({ style: {} }),
                addLayer: jest.fn(),
                removeLayer: jest.fn(),
                fitBounds: jest.fn()
            }),
            tileLayer: jest.fn().mockReturnValue({
                addTo: jest.fn().mockReturnThis()
            }),
            geoJSON: jest.fn().mockReturnValue({
                addTo: jest.fn().mockReturnThis()
            }),
            marker: jest.fn().mockReturnValue({
                addTo: jest.fn().mockReturnThis()
            }),
            featureGroup: jest.fn().mockReturnValue({
                getBounds: jest.fn()
            })
        };
        
        mapManager = new MapManager();
    });
    
    afterEach(() => {
        document.body.removeChild(mockMapElement);
    });
    
    test('should initialize map successfully', () => {
        const result = mapManager.initialize('test-map');
        
        expect(result).toBe(true);
        expect(L.map).toHaveBeenCalledWith('test-map', expect.any(Object));
        expect(mapManager.map.setView).toHaveBeenCalledWith([39.8283, -98.5795], 4);
    });
    
    test('should fail initialization with invalid element ID', () => {
        const result = mapManager.initialize('non-existent');
        
        expect(result).toBe(false);
        expect(L.map).not.toHaveBeenCalled();
    });
    
    test('should set map style', () => {
        mapManager.initialize('test-map');
        mapManager.setStyle('dark');
        
        expect(L.tileLayer).toHaveBeenCalledWith(
            expect.stringContaining('dark_nolabels'),
            expect.any(Object)
        );
    });
    
    test('should add district layer', () => {
        mapManager.initialize('test-map');
        const mockGeoJSON = { type: 'Feature', properties: {} };
        
        const layer = mapManager.addDistrictLayer(mockGeoJSON);
        
        expect(L.geoJSON).toHaveBeenCalledWith(mockGeoJSON, expect.any(Object));
        expect(layer).toBeDefined();
    });
    
    test('should clear all districts', () => {
        mapManager.initialize('test-map');
        mapManager.districtLayers = {
            'CA-1': { remove: jest.fn() },
            'CA-2': { remove: jest.fn() }
        };
        
        mapManager.clearDistricts();
        
        expect(mapManager.districtLayers).toEqual({});
    });
    
    test('should add marker', () => {
        mapManager.initialize('test-map');
        
        const marker = mapManager.addMarker(34.0522, -118.2437);
        
        expect(L.marker).toHaveBeenCalledWith([34.0522, -118.2437], {});
        expect(mapManager.markers).toHaveLength(1);
    });
    
    test('should clear all markers', () => {
        mapManager.initialize('test-map');
        const mockMarker = { remove: jest.fn() };
        mapManager.markers = [mockMarker];
        
        mapManager.clearMarkers();
        
        expect(mockMarker.remove).toHaveBeenCalled();
        expect(mapManager.markers).toHaveLength(0);
    });
});