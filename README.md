# US Congressional Districts Map (SSDD Map)

An interactive web application for visualizing US Congressional Districts, county boundaries, and legislative voting patterns. Built with Node.js, Express, and Leaflet.js.

## Features

### 🗺️ Congressional District Mapping
- Interactive map of all 435 US Congressional Districts
- Special handling for 6 at-large states (Alaska, Delaware, North Dakota, South Dakota, Vermont, Wyoming)
- Real-time member information from the official House XML feed
- District-by-district navigation with smooth zoom animations

### 🏛️ Representative Information
- Current House member data integrated from https://member-info.house.gov/members.xml
- Party affiliation display (Republican, Democrat, Independent)
- Contact information including office, phone, website, and social media
- Member photos when available

### 📍 Address Search & Geocoding
- Search any US address to find its congressional district
- Powered by OpenStreetMap Nominatim geocoding
- Automatic district and county detection using point-in-polygon analysis
- Visual markers showing searched locations

### 🗳️ County Analysis
- 3,234 US county boundaries from 2020 Census data
- **County Political Control**: Shows which party's congressional districts cover each county
  - Red: Republican-controlled counties
  - Blue: Democratic-controlled counties  
  - Purple: Counties split between parties
- **FIPS Code Display**: Shows Federal Information Processing Standards codes for each county
- County statistics and breakdown by party control

### 📊 Data Visualizations
- **State Representation View**: Colors states by number of representatives (1-52)
- **Legislation Voting Patterns**: Track how representatives voted on bills
  - Currently includes H.R. 1 - "One Big Beautiful Bill Act"
  - Green for YES votes, Red for NO votes
- Interactive legends for all visualization modes

### 🎨 Modern UI/UX
- Dark theme with smooth animations
- Responsive design for desktop and mobile
- Real-time loading indicators
- Intuitive navigation between states and districts

## Technical Architecture

### Backend (Node.js/Express)
- **server.js**: Main Express server with RESTful API endpoints
- KML to GeoJSON conversion using @mapbox/togeojson
- Efficient caching of district and county geometries
- Point-in-polygon detection using Turf.js

### Frontend (Vanilla JavaScript)
- **public/app.js**: Core application logic
- **public/styles.css**: Dark theme styling with CSS variables
- **public/index.html**: Application structure
- Leaflet.js for interactive mapping
- CartoDB dark tiles for base map

### Data Sources
- Congressional district boundaries: KML files for each district
- County boundaries: cb_2020_us_county_500k.kml from US Census
- Member information: Live XML feed from house.gov
- Geocoding: OpenStreetMap Nominatim API

## API Endpoints

- `GET /api/states` - List all states with districts
- `GET /api/state/:stateCode` - Get districts for a specific state
- `GET /api/district/:state/:district` - Get specific district GeoJSON and member info
- `GET /api/all-districts` - Get all districts as GeoJSON
- `GET /api/members` - Get all House member data
- `GET /api/geocode?address=` - Geocode an address
- `GET /api/find-location?lat=&lon=` - Find district and county for coordinates
- `GET /api/county-boundaries` - Get all county boundaries
- `GET /api/county-politics` - Get county political control analysis
- `GET /api/state-rep-counts` - Get representative counts by state
- `GET /api/bill-votes/:billId` - Get voting data for specific legislation

## Installation & Setup

1. Clone the repository:
```bash
git clone git@github.com:blur702/ssddmap.git
cd ssddmap
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000 in your browser

## Usage Guide

### Viewing Districts
1. Click "View Full USA Map" to see all districts
2. Select a state from the dropdown to zoom to that state
3. Click any district to view detailed information
4. Use the address search to find specific locations

### Analyzing Counties
1. Click "Show Counties" to display county boundaries
2. Use "Show County Politics" to see party control
3. Use "Show County FIPS" to display FIPS codes
4. Hover over counties for detailed information

### Tracking Legislation
1. Select a bill from the Legislation Tracking dropdown
2. Click "Show Voting Pattern" to see how representatives voted
3. Districts will be colored by vote (Green=Yes, Red=No)

## Performance Optimizations

- Server-side geometry caching for fast lookups
- Lazy loading of district data
- Efficient point-in-polygon algorithms
- Batched API requests for better performance

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design with touch support

## Data Accuracy

- Congressional districts: Current 118th Congress boundaries
- County boundaries: 2020 Census data
- Member information: Live data from house.gov
- Voting data: Approximated based on party lines for demonstration

## License

This project uses public domain data from US government sources.

---

Built with 🤖 by Claude Code and Kevin Althaus