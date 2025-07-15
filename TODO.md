# TODO - Next Steps for SSDD Map

## 🚨 CRITICAL - ZIP+4 Configuration Required

### API Setup & Testing
- [ ] **Obtain USPS Web Tools API User ID** 
  - Register at https://www.usps.com/business/web-tools-apis/
  - Free service, requires registration
  - Needed for address standardization and ZIP+4 lookup
- [ ] **Obtain Smarty API credentials**
  - Sign up at https://www.smarty.com/
  - Free tier: 250 lookups/month
  - Needed for ZIP+4 to congressional district mapping
- [ ] **Test API integrations with real credentials**
  - Verify USPS address standardization works
  - Verify Smarty district lookup returns correct data
  - Test error handling for invalid addresses
- [ ] **Consider alternative APIs**
  - Google Civic Information API (free tier available)
  - Geocod.io (2,500 free lookups/day)
  - Implement fallback mechanism between services

### ZIP+4 Database Population
- [ ] **Obtain ZIP+4 to congressional district mapping data**
  - Option 1: Purchase commercial database ($1,000-5,000/year)
  - Option 2: Use Smarty API to build cache over time
  - Option 3: Research alternative public data sources
  - Option 4: Contact USPS for special government access
- [ ] **Create data import tools**
  - Script to bulk import ZIP+4 mappings
  - Validation to ensure data accuracy
  - Update mechanism for quarterly changes
- [ ] **Database optimization**
  - Add proper indexes for performance
  - Implement data compression
  - Add backup/restore functionality

### Testing & Validation
- [ ] **Comprehensive testing with real data**
  - Test single address lookups with both methods
  - Test batch processing with 100+ addresses
  - Verify CSV upload/download functionality
  - Test comparison accuracy between Census and ZIP+4
- [ ] **Performance testing**
  - Load test batch endpoint with 1000+ addresses
  - Test API rate limit handling
  - Optimize database queries for speed
- [ ] **Edge case testing**
  - PO Boxes and non-standard addresses
  - Military addresses (APO/FPO)
  - New construction without ZIP+4
  - Address parsing variations

## For Next Claude Code Instance

### 🐛 Bug Fixes
1. ✅ **Fixed tooltip typo**: Multiple instances of `bindTooltip` corrected in app.js
2. **County layer performance**: Consider implementing viewport-based rendering for counties to improve performance
3. **Memory management**: Add cleanup for map layers when switching views
4. **Database initialization**: Fix SQLite table creation error on first run

### 🔧 ZIP+4 Feature Completion
1. **Add .env file support**
   - Install dotenv package
   - Create .env.example file
   - Update configuration to use process.env
   - Add .env to .gitignore

2. **Improve error handling**
   - User-friendly messages when APIs are not configured
   - Graceful fallback to Census method
   - Clear instructions for configuration in UI

3. **Add configuration UI**
   - Settings page for API key entry
   - Test connection buttons
   - Method preference selection
   - Save settings to local storage

4. **Enhance batch processing**
   - Add batch processing history
   - Allow batch result filtering/searching
   - Implement batch comparison reports
   - Add email notification option for large batches

### ✨ Feature Enhancements

#### 1. Enhanced Legislation Tracking
- [ ] Add real bill voting data API integration (ProPublica Congress API or GovTrack)
- [ ] Support for multiple bills with voting history
- [ ] Add vote timeline visualization
- [ ] Show vote margins and party breakdown
- [ ] Add search/filter for specific legislation

#### 2. Advanced Search Features
- [ ] Multi-address batch search
- [ ] Search by ZIP code with all districts in that ZIP
- [ ] Search by representative name
- [ ] Search by county name
- [ ] Save/bookmark frequently searched locations

#### 3. Data Export & Sharing
- [ ] Export district/county data as CSV/JSON
- [ ] Generate shareable links for specific views
- [ ] Print-friendly map views
- [ ] Screenshot/image export functionality
- [ ] Embed widget for other websites

#### 4. Historical Data
- [ ] Add historical district boundaries (pre-redistricting)
- [ ] Show district changes over time
- [ ] Historical election results overlay
- [ ] Population change visualizations

#### 5. Additional Overlays
- [ ] Demographics data (Census integration)
- [ ] Voting/polling locations
- [ ] District office locations
- [ ] Town hall event markers
- [ ] District competitiveness ratings

#### 6. Mobile Improvements
- [ ] Better touch controls for mobile
- [ ] Optimized mobile UI layout
- [ ] Offline mode with cached data
- [ ] Progressive Web App (PWA) support

#### 7. Accessibility
- [ ] Add ARIA labels throughout
- [ ] Keyboard navigation support
- [ ] High contrast mode option
- [ ] Screen reader optimizations
- [ ] Text size controls

### 🏗️ Technical Improvements

#### Backend Optimizations
- [ ] Implement Redis caching for API responses
- [ ] Add request rate limiting
- [ ] Compress GeoJSON responses
- [ ] Add API authentication for public deployment
- [ ] Implement WebSocket for real-time updates

#### Frontend Enhancements
- [ ] Migrate to TypeScript for better type safety
- [ ] Add state management (Redux/Zustand)
- [ ] Implement lazy loading for KML files
- [ ] Add service worker for offline support
- [ ] Bundle optimization with Webpack/Vite

#### Testing & Quality
- [ ] Add unit tests for API endpoints
- [ ] Add integration tests for map interactions
- [ ] Set up CI/CD pipeline
- [ ] Add error tracking (Sentry)
- [ ] Performance monitoring

#### Deployment
- [ ] Dockerize the application
- [ ] Add environment configuration
- [ ] Set up HTTPS/SSL
- [ ] Configure CDN for static assets
- [ ] Add health check endpoints

### 📊 New Data Integrations

1. **Election Data**
   - Presidential election results by district
   - Primary election data
   - Voter registration statistics

2. **Demographics**
   - Population density
   - Age distribution
   - Income levels
   - Education statistics

3. **Legislative Activity**
   - Bill sponsorship data
   - Committee assignments
   - Legislative scorecards
   - Town hall schedules

### 🎯 Quick Wins (Easy to Implement)

1. Add loading states for all data fetches
2. Add error boundaries for better error handling
3. Add "About" page with data sources
4. Add keyboard shortcuts for common actions
5. Add tooltip hints for first-time users
6. Add zoom controls to the map
7. Add a "Reset View" button
8. Add district comparison tool
9. Add representative voting record summary
10. Add "Contact Your Rep" quick action button

### 📝 Documentation Needs

1. API documentation with examples
2. Deployment guide
3. Data update procedures
4. Contributing guidelines
5. Architecture decision records

### 🔒 Security Considerations

1. Implement Content Security Policy (CSP)
2. Add input validation for all user inputs
3. Sanitize HTML in dynamic content
4. Add rate limiting for API endpoints
5. Implement proper CORS configuration

### 💡 Future Vision

1. **AI Integration**: Natural language queries ("Show me all Democratic districts in Texas")
2. **Real-time Updates**: WebSocket integration for live vote tracking during House sessions
3. **Collaboration Features**: Allow users to annotate and share map views
4. **Mobile App**: Native iOS/Android apps using React Native
5. **API Service**: Offer district lookup API as a service

---

## Current State Summary

- ✅ Basic district visualization working
- ✅ County overlay with political analysis
- ✅ Address search with geocoding
- ✅ Basic legislation tracking (H.R. 1)
- ✅ FIPS code display
- ✅ State representation visualization
- ✅ Dark theme UI
- ✅ GitHub repository set up
- ✅ ZIP+4 integration structure implemented
- ✅ **Streamlined district selection UI** with dropdown under "District Information"
- ✅ **Party icons in dropdown** (🐘 Republican, 🫏 Democrat, Ⓘ Independent, • Vacant)
- ✅ **Removed summary list** for cleaner interface
- ⚠️ ZIP+4 features require API configuration
- ⚠️ ZIP+4 database needs population with real data
- ⚠️ Batch processing needs real-world testing

The application is functional but the ZIP+4 features require API credentials and data to be fully operational.