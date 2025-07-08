# Distance to District Boundary Feature

## Overview
This feature adds the ability to calculate and display the distance from a searched address to the nearest congressional district boundary.

## Implementation Details

### Backend (server.js)
- Added new endpoint `/api/find-location` that:
  - Finds the congressional district containing a given lat/lon point
  - Calculates the distance from the point to the district boundary using PostGIS spatial functions
  - Returns the closest point on the district boundary
  - If the point is outside all districts, finds the nearest district and its distance
  - Also returns county information for the location

### Frontend (public/app.js)
- Modified `findDistrictForLocation()` to use the new endpoint
- Added `drawDistanceLine()` function to visually show the distance with:
  - Animated dashed line from the search point to the nearest boundary
  - Marker at the closest boundary point
- Updated the info panel to display:
  - Distance in both meters and miles
  - Special message if location is on the boundary
  - Nearest district info if outside all districts
- Updated address marker popup to show distance information

### Key Features
1. **Accurate Distance Calculation**: Uses PostGIS geography type for precise distance calculations
2. **Visual Feedback**: Animated line shows the shortest path to the district boundary
3. **Edge Cases Handled**: 
   - Locations outside all districts (e.g., Washington DC, water bodies)
   - Locations exactly on district boundaries
4. **Clean UI**: Distance information integrated into existing info panels and popups

### PostGIS Functions Used
- `ST_Distance()`: Calculate distance between geometries
- `ST_Boundary()`: Get the outline of a district polygon
- `ST_ClosestPoint()`: Find the nearest point on a geometry
- `ST_Contains()`: Check if a point is within a district

### Testing
Test script provided (`test-distance.js`) to verify functionality with sample locations.

## Usage
1. Enter an address in the search box
2. Select the address from the dropdown
3. The map will show:
   - A marker at the searched location
   - The congressional district containing that point
   - Distance to the nearest district boundary
   - An animated line to the closest boundary point
4. The info panel displays detailed distance information