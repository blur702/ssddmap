// Approximate state boundaries for at-large states
// These are simplified bounding boxes - in production you'd want actual state boundary data
const STATE_BOUNDARIES = {
    'AK': {
        type: 'Feature',
        properties: { name: 'Alaska' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-168.0, 71.5], [-168.0, 54.5], [-130.0, 54.5], [-130.0, 71.5], [-168.0, 71.5]
            ]]
        }
    },
    'DE': {
        type: 'Feature',
        properties: { name: 'Delaware' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-75.8, 39.85], [-75.8, 38.45], [-75.0, 38.45], [-75.0, 39.85], [-75.8, 39.85]
            ]]
        }
    },
    'ND': {
        type: 'Feature',
        properties: { name: 'North Dakota' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-104.05, 49.0], [-104.05, 45.93], [-96.55, 45.93], [-96.55, 49.0], [-104.05, 49.0]
            ]]
        }
    },
    'SD': {
        type: 'Feature',
        properties: { name: 'South Dakota' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-104.06, 45.95], [-104.06, 42.48], [-96.44, 42.48], [-96.44, 45.95], [-104.06, 45.95]
            ]]
        }
    },
    'VT': {
        type: 'Feature',
        properties: { name: 'Vermont' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-73.44, 45.02], [-73.44, 42.73], [-71.47, 42.73], [-71.47, 45.02], [-73.44, 45.02]
            ]]
        }
    },
    'WY': {
        type: 'Feature',
        properties: { name: 'Wyoming' },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-111.05, 45.0], [-111.05, 41.0], [-104.05, 41.0], [-104.05, 45.0], [-111.05, 45.0]
            ]]
        }
    }
};

module.exports = STATE_BOUNDARIES;