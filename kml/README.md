# KML Files Directory

This directory contains KML (Keyhole Markup Language) files for the SSDD (Simple State District Database) mapping application.

## Directory Structure

```
kml/
├── ssdd/           # US Congressional District boundary files
│   ├── AK-0.kml    # Alaska At-Large District
│   ├── AL-1.kml    # Alabama District 1
│   ├── AL-2.kml    # Alabama District 2
│   └── ...         # All 435 US Congressional Districts
└── README.md       # This file
```

## File Naming Convention

KML files follow the pattern: `{STATE}-{DISTRICT}.kml`

- **STATE**: Two-letter state code (e.g., CA, TX, NY)
- **DISTRICT**: District number (0 for at-large districts)

### Examples:
- `CA-1.kml` - California District 1
- `TX-23.kml` - Texas District 23  
- `AK-0.kml` - Alaska At-Large District
- `WY-0.kml` - Wyoming At-Large District

## File Contents

Each KML file contains:
- **Boundary geometry**: Precise geographic boundaries for the congressional district
- **Metadata**: District identification and basic information
- **Coordinate data**: Latitude/longitude points defining the district perimeter

## Usage in Application

These KML files are used by:

1. **Server-side processing** (`server-file-based.js`):
   - Loading district boundaries for API responses
   - Generating GeoJSON data for mapping
   - Processing geographic queries

2. **Database import** (`database/import.js`):
   - Importing district geometries into PostgreSQL
   - Converting KML to PostGIS-compatible formats
   - Building searchable geographic indexes

3. **Map rendering**:
   - Displaying district boundaries on interactive maps
   - Highlighting districts based on user interactions
   - Providing visual context for address lookups

## File Statistics

- **Total Files**: 435 (one for each US Congressional District)
- **File Format**: KML (Keyhole Markup Language)
- **Total Size**: ~200MB (varies by district complexity)
- **Coordinate System**: WGS84 (EPSG:4326)

## Data Sources

Congressional district boundaries are sourced from:
- US Census Bureau's TIGER/Line Shapefiles
- 2020 Redistricting cycle data
- Converted to KML format for web application use

## Maintenance

### Adding New Districts
1. Obtain KML file following naming convention
2. Place in `kml/ssdd/` directory
3. Run database import: `node database/import.js`
4. Restart application to refresh file-based APIs

### Updating Existing Districts
1. Replace existing KML file
2. Clear relevant caches
3. Re-import to database if using DB mode
4. Test boundary accuracy

## Technical Notes

- **Geometry Type**: Primarily Polygon and MultiPolygon
- **Precision**: High-resolution boundaries for accurate mapping
- **Optimization**: Files are optimized for web delivery
- **Validation**: All files validated for geographic accuracy

## Related Files

- `counties/cb_2020_us_county_500k.kml` - County boundary data
- `cache/district-geometries.json` - Cached district data
- `public/js/map.js` - Frontend map rendering logic

---

**Note**: These files are essential for the application's geographic functionality. Do not modify or move without updating corresponding code references.