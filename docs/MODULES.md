# Module Documentation

## Frontend Modules

### DistrictInfoModule

The `DistrictInfoModule` is responsible for displaying district and representative information in the sidebar with consistent professional design and boundary distance integration.

#### Features

- **Consistent Sidebar Design**: Professional templates for all district types (representative, vacant, DC delegate)
- **Boundary Distance Integration**: Real-time distance calculations from click locations to district boundaries
- **Simplified Distance Display**: Shows distance in feet (< 0.1 miles) or miles (≥ 0.1 miles) for easy reading
- **Professional Styling**: Blue accent borders and clean typography for enhanced user experience
- **Event-Driven Architecture**: Integrates with EventBus for seamless component communication

#### Constructor

```javascript
constructor(sidebarElement, dataManager, boundaryDistanceModule = null)
```

**Parameters:**
- `sidebarElement`: DOM element for the sidebar container
- `dataManager`: Data manager instance for member information
- `boundaryDistanceModule`: Optional boundary distance module for distance calculations

#### Key Methods

##### `displayDistrictInfo(districtInfo)`

Displays comprehensive district information with optional boundary distance.

**Parameters:**
- `districtInfo.state`: State abbreviation
- `districtInfo.district`: District number
- `districtInfo.representative`: Representative data object
- `districtInfo.clickLocation`: Optional click coordinates `{lat, lon}` for distance calculation
- `districtInfo.boundaryDistance`: Optional pre-calculated distance information

**Features:**
- Automatic distance calculation when click location provided
- Professional styling with consistent templates
- Simplified distance formatting (feet or miles only)
- Error handling for distance calculation failures

##### `displayStateInfo(state, districts)`

Shows state overview with district breakdown and party statistics.

**Parameters:**
- `state`: State abbreviation
- `districts`: Array of district objects with member information

##### `createDistanceSection(distanceInfo)`

Creates a professionally styled distance section for the sidebar.

**Parameters:**
- `distanceInfo`: Distance calculation results from BoundaryDistanceModule

**Returns:** HTML string with formatted distance display

#### Integration with BoundaryDistanceModule

The DistrictInfoModule seamlessly integrates with the BoundaryDistanceModule to provide real-time boundary distance calculations:

```javascript
// Automatic distance calculation
if (!distanceInfo && clickLocation && this.boundaryDistanceModule) {
  try {
    const result = await this.boundaryDistanceModule.calculateBoundaryDistance(
      clickLocation,
      { state, district }
    );
    if (result.success) {
      distanceInfo = result;
    }
  } catch (error) {
    console.error('Error calculating boundary distance:', error);
  }
}
```

#### Distance Display Format

The module uses simplified distance formatting for enhanced user experience:

- **Feet**: For distances less than 0.1 miles (e.g., "850 feet")
- **Miles**: For distances 0.1 miles or greater (e.g., "1.2 miles", "15 miles")

#### CSS Classes

The module uses these CSS classes for professional styling:

- `.distance-section`: Main container with blue accent border
- `.distance-info`: Padding and layout for distance content
- `.distance-primary`: Primary distance display with value and label
- `.distance-value`: Large, bold distance number in blue
- `.distance-label`: Descriptive text for the distance
- `.boundary-coordinates`: Coordinates of closest boundary point

#### Example Usage

```javascript
// Initialize with boundary distance support
const districtInfoModule = new DistrictInfoModule(
  sidebarElement, 
  dataManager, 
  boundaryDistanceModule
);

// Display district with click location for distance calculation
await districtInfoModule.displayDistrictInfo({
  state: 'CA',
  district: '1',
  representative: representativeData,
  clickLocation: { lat: 39.7391, lon: -121.8375 }
});
```

### BoundaryDistanceModule

The `BoundaryDistanceModule` provides boundary distance calculations between points and congressional district boundaries.

#### Features

- **PostGIS Integration**: Uses spatial database functions for accurate distance calculations
- **Multiple Distance Units**: Returns distance in feet, miles, meters, and kilometers
- **Simplified Formatting**: Provides user-friendly distance formatting
- **Error Handling**: Comprehensive error handling for calculation failures
- **Performance Optimization**: Efficient spatial queries for real-time calculations

#### Key Methods

##### `calculateBoundaryDistance(point, district)`

Calculates the shortest distance from a point to a district boundary.

**Parameters:**
- `point`: Coordinates object `{lat, lon}`
- `district`: District object `{state, district}`

**Returns:** Promise resolving to:
```javascript
{
  success: true,
  distance: {
    feet: 1250,
    miles: 0.24,
    meters: 381,
    kilometers: 0.38
  },
  closestPoint: {
    lat: 39.7401,
    lon: -121.8385
  }
}
```

##### `formatDistance(distance)`

Formats distance for user display with simplified units.

**Parameters:**
- `distance`: Distance object with feet and miles properties

**Returns:** Formatted string (e.g., "1,250 feet", "2.1 miles")

### AddressSearchModule

Enhanced address search module with boundary distance integration for comprehensive address validation and district assignment.

#### Features

- **Multi-Method Validation**: USPS, Census, and Google geocoding integration
- **Boundary Distance Integration**: Shows distance from address to district boundary
- **Professional Sidebar Templates**: Consistent design with DistrictInfoModule
- **Comprehensive Address Display**: Shows standardized address, coordinates, and metadata

#### Integration Updates

The AddressSearchModule now integrates with BoundaryDistanceModule for enhanced address validation results:

```javascript
// Enhanced constructor with boundary distance support
constructor(sidebarElement, dataManager, eventBus, boundaryDistanceModule)
```

## Backend Services

### ValidationService

Handles multi-method address validation with boundary distance integration.

#### Enhanced Features

- **Distance Calculation Integration**: Automatically calculates boundary distance for validated addresses
- **Simplified API Responses**: Returns formatted distance in user-friendly units
- **Comprehensive Validation Results**: Includes distance information in validation responses

## Event System

### EventBus Integration

The modules use an event-driven architecture for seamless communication:

#### District Selection Events

```javascript
// District clicked with location capture
eventBus.emit('districtClicked', { 
  state, 
  district, 
  districtKey, 
  clickLocation: { lat, lon } 
});

// District selected from dropdown
eventBus.emit('districtSelected', { 
  state, 
  district, 
  clickLocation 
});
```

#### Address Search Events

```javascript
// Focus map on location with zoom
eventBus.emit('focusMapLocation', { lat, lon, zoom });

// Show district details in sidebar
eventBus.emit('showDistrictDetails', districtInfo);

// Clear search input
eventBus.emit('clearSearchInput');
```

## CSS Framework

### Sidebar Templates

The application uses a consistent CSS framework for professional sidebar design:

#### Key Classes

- `.distance-section`: Professional distance display with blue accent
- `.rep-header`: Representative profile header layout
- `.detail-grid`: Grid layout for contact and office information
- `.contact-section`: Highlighted contact information section
- `.committees-section`: Committee assignments display

#### Responsive Design

All sidebar templates include responsive breakpoints for mobile devices:

```css
@media (max-width: 768px) {
  .distance-primary {
    flex-direction: column;
    gap: 4px;
  }
}
```

## Error Handling

### Distance Calculation Errors

The modules include comprehensive error handling for distance calculations:

```javascript
try {
  const result = await this.boundaryDistanceModule.calculateBoundaryDistance(
    clickLocation,
    { state, district }
  );
  if (result.success) {
    distanceInfo = result;
  }
} catch (error) {
  console.error('Error calculating boundary distance:', error);
  // Continue without distance information
}
```

### Fallback Mechanisms

- **Distance Calculation Failures**: Display continues without distance information
- **Missing Boundary Module**: Uses simplified distance formatting fallback
- **API Errors**: Graceful degradation with user notifications

## Performance Considerations

### Optimization Features

- **Lazy Distance Calculation**: Only calculates distance when click location provided
- **Cached Results**: Boundary distance results cached for repeat calculations
- **Efficient Queries**: PostGIS spatial indexes for fast boundary calculations
- **Minimal DOM Updates**: Efficient template rendering with minimal reflows

### Memory Management

- **Event Cleanup**: Proper event listener cleanup on module destruction
- **Reference Management**: Weak references to prevent memory leaks
- **Efficient Rendering**: Minimal DOM manipulation for performance

## Testing

### Unit Tests

Each module includes comprehensive unit tests:

```javascript
// DistrictInfoModule tests
describe('DistrictInfoModule', () => {
  test('displays district info with boundary distance', async () => {
    // Test implementation
  });
});

// BoundaryDistanceModule tests
describe('BoundaryDistanceModule', () => {
  test('calculates boundary distance correctly', async () => {
    // Test implementation
  });
});
```

### Integration Tests

End-to-end tests verify complete workflows:

- District selection with distance calculation
- Address search with boundary distance
- Sidebar template consistency
- Responsive design behavior

---

**Module Documentation Version**: 2.0.0  
**Last Updated**: January 2025  
**Compatible with**: SSDD Map v2.0.0