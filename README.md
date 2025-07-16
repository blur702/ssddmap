# US Congressional Districts Map (SSDD Map)

An interactive web application for visualizing US Congressional Districts with comprehensive address validation, congressional district lookup, and legislative analysis features. Built with Node.js, Express, PostgreSQL, and Leaflet.js.

## 🌟 Key Features

### 🗺️ Interactive Congressional District Mapping
- **All 435 US Congressional Districts** with current 118th Congress boundaries
- **At-large state handling** for Alaska, Delaware, North Dakota, South Dakota, Vermont, Wyoming
- **Real-time member information** from official House XML feed
- **District navigation** with smooth zoom animations and party affiliation indicators
- **Multiple map styles**: Voyager, Light, Dark, Satellite, Terrain

### 📍 Advanced Address Validation & Lookup
- **USPS OAuth API v3 Integration** for address standardization and ZIP+4 lookup
- **Multi-method validation**:
  - **USPS Standardization**: Address correction + ZIP+4 → District mapping
  - **Census Geocoding**: Address → Coordinates → District (via PostGIS)
  - **Google Maps** (optional): Enhanced geocoding with formatted addresses
- **Address correction suggestions** with user-friendly approval workflow
- **Batch processing** for multiple addresses with CSV import/export
- **Comparison analysis** between geocoding and ZIP+4 methods
- **Boundary proximity detection** for addresses near district edges

### 🏛️ Representative Information System
- **Live member data** from https://member-info.house.gov/members.xml
- **Party affiliation display** with visual indicators (🐘 Republican, 🫏 Democrat, Ⓘ Independent)
- **Contact information** including office, phone, website, and social media
- **Member photos** when available
- **Voting patterns** for legislative tracking

### 🗳️ County Analysis & Political Control
- **3,234 US county boundaries** from 2020 Census data
- **Political control visualization**:
  - Red: Republican-controlled counties
  - Blue: Democratic-controlled counties
  - Purple: Counties split between parties
- **FIPS code display** for federal identification
- **County statistics** and party breakdown

### 📊 Data Visualization & Analysis
- **State representation view** colored by representative count (1-52)
- **Legislative voting patterns** with vote tracking
- **Interactive legends** for all visualization modes
- **Comparison reports** between validation methods
- **Boundary distance calculations** with simplified feet/miles display
- **Professional sidebar design** with consistent templates for all district views
- **Real-time distance calculations** from click locations to district boundaries

## 🏗️ Technical Architecture

### Backend Infrastructure
- **Node.js/Express** server with RESTful API
- **PostgreSQL** with PostGIS for spatial data
- **OAuth 2.0** integration for USPS API
- **Modular service architecture**:
  - `USPSOAuthService`: USPS API integration and token management
  - `ValidationService`: Multi-method address validation
  - `DatabaseService`: PostgreSQL operations
  - `AddressService`: Geocoding and standardization

### Frontend Technology
- **Vanilla JavaScript** ES6 modules with modular architecture
- **Leaflet.js** for interactive mapping
- **Responsive design** with dark theme
- **Real-time validation** with user feedback
- **Progressive loading** for large datasets
- **Professional sidebar interface** with consistent design templates
- **Event-driven architecture** with EventBus for component communication
- **Boundary distance integration** with BoundaryDistanceModule

### Data Sources & APIs
- **Congressional districts**: KML files converted to PostGIS geometries
- **County boundaries**: 2020 Census cb_2020_us_county_500k dataset
- **Member information**: Live XML feed from house.gov
- **Address validation**: USPS OAuth API v3
- **Geocoding**: Census Geocoder, Google Maps API (optional)

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 12+ with PostGIS extension
- USPS Developer Account (for address validation)

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/kevinalthaus/ssddmap.git
cd ssddmap

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
npm run db:setup

# 5. Start development server
npm start

# 6. Open application
open http://localhost:3001/ssddmap
```

### Environment Configuration
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ssddmap
DB_USER=ssddmap_user
DB_PASSWORD=your_password

# USPS OAuth Configuration
USPS_CLIENT_ID=your_consumer_key
USPS_CLIENT_SECRET=your_consumer_secret
USPS_BASE_URL=https://apis.usps.com
USPS_CRID=your_customer_registration_id
USPS_OUTBOUND_MID=your_outbound_mailer_id
USPS_RETURN_MID=your_return_mailer_id

# Optional APIs
GOOGLE_MAPS_API_KEY=your_google_api_key
SMARTY_AUTH_ID=your_smarty_auth_id
SMARTY_AUTH_TOKEN=your_smarty_auth_token
```

## 📋 API Documentation

### Address Validation Endpoints
```
POST /ssddmap/api/validate-address
Body: { "address": "123 Main St, City, State ZIP" }
Returns: Comprehensive validation results from multiple methods

GET /ssddmap/api/test-usps
Returns: USPS API connection status and configuration

POST /ssddmap/api/batch-validate
Body: { "addresses": ["address1", "address2", ...] }
Returns: Batch validation results with progress tracking
```

### District & Geography Endpoints
```
GET /ssddmap/api/states
Returns: List of all states with district counts

GET /ssddmap/api/state/:stateCode
Returns: Districts for specific state

GET /ssddmap/api/district/:state/:district
Returns: District geometry and member information

GET /ssddmap/api/find-location?lat=&lon=
Returns: District and county for coordinates

GET /ssddmap/api/county-boundaries
Returns: All county boundaries with political control data
```

### Data Management Endpoints
```
GET /ssddmap/api/members
Returns: All House member data with caching

POST /ssddmap/api/refresh-cache
Returns: Refreshed member data from house.gov

GET /ssddmap/api/bill-votes/:billId
Returns: Voting patterns for specific legislation
```

## 🎯 Usage Guide

### Address Validation Workflow
1. **Enter address** in search box or validation panel
2. **Review USPS corrections** if suggested
3. **Accept or modify** the standardized address
4. **View district assignment** on map with member information
5. **Compare methods** to verify accuracy

### Batch Processing
1. **Upload CSV** or paste addresses (one per line)
2. **Select validation method** (USPS, Census, or Both)
3. **Monitor progress** with real-time updates
4. **Download results** as CSV with comparison data

### District Navigation
1. **Select state** from dropdown to zoom to region
2. **Choose district** from district selector (shows party and representative)
3. **Click map** to view detailed district information with boundary distance
4. **Use address search** to find specific locations
5. **View consistent sidebar** with professional templates for all district types
6. **See simplified distance display** in feet or miles to closest boundary

### Validation Mode Features
1. **Toggle validation mode** to enable advanced features
2. **Compare geocoding vs ZIP+4** results
3. **View boundary proximity** warnings
4. **Analyze consistency** between methods

## 🔧 Configuration Guides

### USPS OAuth Setup
See [USPS_OAUTH_SETUP.md](./USPS_OAUTH_SETUP.md) for detailed instructions on:
- Developer account registration
- Application configuration
- OAuth credential management
- Business account linking

### Database Setup
See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for:
- PostgreSQL installation and configuration
- PostGIS extension setup
- District geometry import
- ZIP+4 database creation

### API Configuration
See [API_CONFIGURATION.md](./API_CONFIGURATION.md) for:
- USPS API registration and setup
- Google Maps API configuration
- Smarty API integration
- Rate limiting and error handling

## 🧪 Testing

### Automated Testing
```bash
# Run all tests
npm test

# Run Playwright end-to-end tests
npm run test:e2e

# Run validation tests
npm run test:validation

# Generate test reports
npm run test:report
```

### Manual Testing
- Test address validation with various formats
- Verify district assignments across state boundaries
- Check batch processing with large datasets
- Validate API responses and error handling

## 📊 Performance & Monitoring

### Optimization Features
- **Server-side caching** for district geometries and member data
- **Lazy loading** of district data on demand
- **Efficient PostGIS queries** for point-in-polygon detection
- **Token management** for USPS OAuth with automatic refresh
- **Rate limiting** for API endpoints

### Monitoring
- **Application logs** for debugging and performance tracking
- **API response times** and error rates
- **Database query optimization** with PostGIS indexes
- **OAuth token usage** and refresh cycles

## 🔒 Security Considerations

### API Security
- **OAuth 2.0** implementation for USPS API
- **Environment variables** for sensitive configuration
- **Input validation** for all user inputs
- **Rate limiting** to prevent abuse

### Data Privacy
- **No persistent storage** of user addresses (except for caching)
- **Secure API communication** with HTTPS
- **Minimal data collection** for functionality only

## 🐛 Troubleshooting

### Common Issues
1. **USPS API 401 Errors**: Check OAuth credentials and token refresh
2. **Database Connection**: Verify PostgreSQL service and credentials
3. **District Not Found**: Check coordinate precision and boundary data
4. **Performance Issues**: Review caching and database indexes

### Debug Mode
Enable debug logging:
```bash
DEBUG=ssddmap:* npm start
```

## 📝 Contributing

### Development Setup
1. Fork repository and create feature branch
2. Install development dependencies
3. Run tests before submitting changes
4. Follow existing code style and patterns

### Code Structure
- `services/` - Backend service modules
- `public/js/` - Frontend JavaScript modules
- `tests/` - Test files and specifications
- `database/` - Database schemas and migrations
- `kml/ssdd/` - Congressional district boundary files (435 KML files)
- `counties/` - County boundary data files

## 📚 Documentation

### Core Documentation
- [Complete Documentation Index](./docs/README.md) - Comprehensive guide to all documentation
- [API Reference](./docs/API_REFERENCE.md) - Complete API endpoint documentation
- [User Guide](./docs/USER_GUIDE.md) - Complete user guide for the application
- [Configuration Guide](./docs/CONFIGURATION_GUIDE.md) - Setup and configuration instructions

### Quick Links
- [USPS Setup](./docs/USPS_OAUTH_SETUP.md) - USPS API registration and OAuth configuration
- [Address Validation](./docs/ADDRESS_VALIDATION_GUIDE.md) - Address validation workflows and best practices
- [Distance Features](./docs/DISTANCE_FEATURES.md) - Boundary distance calculation documentation
- [Boundary Analysis](./docs/BOUNDARY_ANALYSIS.md) - District boundary geometry analysis
- [Testing Guide](./docs/PLAYWRIGHT_TESTING_GUIDE.md) - Comprehensive E2E testing guide

### Project Files
- [CHANGELOG.md](./CHANGELOG.md) - Version history and updates
- [TODO.md](./TODO.md) - Current development tasks and roadmap

## 🆘 Support

For issues and questions:
- Check existing [Issues](https://github.com/kevinalthaus/ssddmap/issues)
- Review documentation files
- Contact: kevin@kevinalthaus.com

## 📄 License

This project uses public domain data from US government sources.
Built with 🤖 by Claude Code and Kevin Althaus

---

**Version**: 2.0.0  
**Last Updated**: January 2025  
**Compatible with**: USPS API v3, PostgreSQL 12+, Node.js 18+