# SSDD Map User Guide

A complete guide to using the US Congressional Districts Map application with address validation features.

## 🚀 Getting Started

### Accessing the Application

**Production URL**: https://kevinalthaus.com/apps/ssddmap/  
**Local Development**: http://localhost:3001/ssddmap/

### Browser Requirements

- **Chrome/Edge**: Full support with all features
- **Firefox**: Full support with all features  
- **Safari**: Full support with all features
- **Mobile**: Responsive design with touch support

## 🗺️ Main Interface Overview

### Top Toolbar

The toolbar contains all primary controls:

#### Left Section
- **App Title**: "Congressional Districts"

#### Center Section
- **Address Search Box**: Enter any US address
- **State Selector**: Choose specific state to view
- **Map Style Selector**: Change map appearance
  - Voyager (default)
  - Light
  - Dark  
  - Satellite
  - Terrain

#### Right Section
- **Toggle Switches**:
  - Auto-suggest: Enable/disable address suggestions
  - Rep View: Switch to representative visualization mode
  - Validation Mode: Enable advanced address validation features
- **Icon Buttons**:
  - View USA: Reset to full country view
  - Data Management: Refresh member data
  - API Configuration: Configure validation services

### Main Map Area

- **Interactive Map**: Click and zoom to explore districts
- **District Boundaries**: Congressional district outlines
- **County Boundaries**: US county lines (when enabled)
- **Search Markers**: Show searched address locations
- **Legends**: Party affiliation and representative count legends

### Right Sidebar

- **District Information Panel**: Shows details for selected districts
- **District Selector**: Dropdown to navigate districts within a state
- **Address Validation Panel**: Advanced validation tools (when enabled)

## 📍 Address Search Features

### Basic Address Search

1. **Enter Address**: Type any US address in the search box
   ```
   Examples:
   - 1600 Pennsylvania Ave, Washington, DC
   - 123 Main St, City, State ZIP
   - Golden Gate Bridge, San Francisco, CA
   ```

2. **Search Methods**:
   - Press Enter
   - Click the search button (🔍)
   - Select from auto-suggestions

3. **View Results**:
   - Map zooms to address location
   - District information appears in sidebar
   - Address marker shows on map

### Address Formats Supported

**Full Address Format** (Recommended):
```
123 Main Street, City, State ZIP
```

**Minimal Format**:
```
Street Address, State
```

**Landmark Format**:
```
Famous Location, City, State
```

**Address Components**:
- **Street Address**: Required (e.g., "123 Main St")
- **City**: Recommended (e.g., "Springfield")
- **State**: Required (e.g., "IL" or "Illinois")
- **ZIP Code**: Optional but improves accuracy

## 🔍 Advanced Address Validation

### Enabling Validation Mode

1. **Toggle Validation Mode**: Click the "Validation Mode" switch in the toolbar
2. **Validation Panel Appears**: New panel opens in the right sidebar
3. **Enhanced Features Activated**: Additional validation tools become available

### Using Address Validation

#### Step 1: Enter Address
1. Type address in the validation input field
2. Use any format (the system will parse it automatically)

#### Step 2: Click Validate
- Click "Validate" button or press Enter
- System processes address using multiple methods

#### Step 3: Review Results
**USPS Method** (if configured):
- ✅ **Address Standardization**: Corrected/formatted address
- ✅ **ZIP+4 Code**: Precise postal code
- ✅ **District Assignment**: Based on ZIP+4 database
- ✅ **Delivery Confirmation**: Whether address is deliverable

**Census Method**:
- ✅ **Geocoding**: Converts address to coordinates
- ✅ **Geographic Lookup**: Uses official district boundaries
- ✅ **Distance to Boundary**: How close to district edges

**Google Maps Method** (if configured):
- ✅ **Enhanced Geocoding**: High-accuracy location
- ✅ **Formatted Address**: Standardized address format
- ✅ **Location Confidence**: Quality of geocoding result

#### Step 4: Interpret Results

**Success Indicators**:
- ✅ **Green checkmark**: Method succeeded
- ⚠️ **Yellow warning**: Succeeded with issues
- ❌ **Red X**: Method failed

**Consistency Analysis**:
- **Consistent**: All methods agree on district
- **Inconsistent**: Methods disagree (needs review)
- **Boundary Issue**: Address near district boundary

### Address Correction Workflow

When USPS suggests corrections:

1. **Original vs. Suggested**:
   ```
   Original: 123 main st, city, state
   USPS Suggests: 123 MAIN ST, CITY, ST 12345-6789
   ```

2. **Review Changes**:
   - Standardized capitalization
   - Added directionals (N, S, E, W)
   - Complete ZIP+4 code
   - Corrected abbreviations

3. **Make Decision**:
   - **Accept**: Use USPS standardized address
   - **Reject**: Keep original address
   - **Edit**: Manually modify address

## 🏛️ District Navigation

### Viewing Districts

#### Method 1: State Selection
1. **Select State**: Choose from state dropdown
2. **Map Zooms**: Automatically zooms to selected state
3. **District Dropdown**: Use district selector in sidebar
4. **Navigate Districts**: Click through districts in that state

#### Method 2: Direct Map Interaction
1. **Click District**: Click any district on the map
2. **Sidebar Updates**: District information loads immediately
3. **Zoom Level**: Map adjusts to show district clearly

#### Method 3: Address Search
1. **Search Address**: Enter any address
2. **Auto-Navigation**: Map finds and highlights district
3. **Context Information**: Shows why address belongs to district

### District Information Panel

**Representative Details**:
- **Name**: Current House member
- **Party**: Republican (🐘), Democrat (🫏), Independent (Ⓘ)
- **Office**: Capitol office location
- **Phone**: Congressional office phone
- **Website**: Official House website
- **Social Media**: Twitter, Facebook links (when available)

**District Details**:
- **State**: Two-letter state code
- **District Number**: Numerical district identifier
- **Type**: Regular district or At-Large
- **Population**: District population (when available)

**Additional Information**:
- **Counties**: Counties within the district
- **Major Cities**: Significant cities in district
- **Geographic Features**: Notable landmarks

## 📊 Visualization Modes

### Party Affiliation View (Default)

**Color Coding**:
- **Blue**: Democratic districts
- **Red**: Republican districts  
- **Purple**: Independent districts
- **Gray**: Vacant seats

**Features**:
- Clear party identification
- Easy visual party balance assessment
- Hover for representative details

### Representative Count View

**Toggle**: Click "Rep View" to enable

**Color Scale**:
- **Light colors**: States with fewer representatives (1-5)
- **Dark colors**: States with more representatives (20-52)

**Use Cases**:
- Compare state representation
- Understand electoral college distribution
- Visualize population-based representation

### County Political Control

**Toggle**: Available through data management

**Color Coding**:
- **Red counties**: Republican-controlled
- **Blue counties**: Democrat-controlled
- **Purple counties**: Split party control

**Information**:
- Party control by county
- FIPS codes for counties
- District breakdown within counties

## 🔧 Configuration and Settings

### API Configuration

**Access**: Click the gear icon (⚙️) in toolbar

#### USPS API Setup
1. **Client ID**: Enter your USPS Consumer Key
2. **Client Secret**: Enter your USPS Consumer Secret  
3. **Test Connection**: Verify API connectivity
4. **Save Settings**: Store configuration

#### Google Maps API Setup
1. **API Key**: Enter your Google Maps API key
2. **Test Connection**: Verify API functionality
3. **Enable**: Activate Google Maps geocoding

#### Validation Method Selection
- **Census Geocoder**: Free, no setup required
- **ZIP+4 (USPS)**: Requires USPS API setup
- **Compare Both**: Use multiple methods for accuracy

### Data Management

**Access**: Click the database icon (💾) in toolbar

**Cache Status**: Shows last data refresh
**Refresh Data**: Forces update of House member information
**Cache Duration**: Data cached for 24 hours

## 📱 Mobile Usage

### Touch Navigation
- **Pinch to Zoom**: Zoom in/out on map
- **Pan**: Drag to move around map
- **Tap Districts**: Touch to select districts
- **Sidebar Swipe**: Swipe to open/close sidebar

### Mobile-Specific Features
- **Responsive Layout**: Adjusts to screen size
- **Touch-Friendly Buttons**: Larger touch targets
- **Simplified Interface**: Essential features prominent
- **Offline Capability**: Basic functionality without network

### Mobile Address Search
1. **Tap Search Box**: Keyboard appears automatically
2. **Voice Input**: Use device voice input (browser dependent)
3. **Location Services**: Some browsers may request location access
4. **Auto-Complete**: Touch suggestions to select

## ⚡ Performance Tips

### Optimal Usage
- **Use Specific Addresses**: More specific = better results
- **Enable Caching**: Let browser cache map data
- **Stable Network**: WiFi recommended for large datasets
- **Modern Browser**: Use latest browser version

### Speed Optimization
- **Close Unused Panels**: Hide sidebar when not needed
- **Limit Zoom Level**: Extreme zoom can slow performance
- **Clear Cache**: Refresh if performance degrades
- **Reduce Visual Effects**: Use Light map style for speed

## 🐛 Troubleshooting

### Common Issues

#### Address Not Found
**Symptoms**: "Address not found" error
**Solutions**:
- Check spelling and format
- Try without apartment/unit numbers
- Use landmark names for rural areas
- Include state in search

#### Wrong District Assignment
**Symptoms**: Address shows incorrect district
**Solutions**:
- Enable Validation Mode for comparison
- Check if address is near boundary
- Verify address spelling and format
- Report issue if consistently wrong

#### Map Not Loading
**Symptoms**: Blank map or loading errors
**Solutions**:
- Refresh the page
- Check internet connection
- Clear browser cache
- Try different browser

#### Slow Performance
**Symptoms**: Sluggish response, delays
**Solutions**:
- Close other browser tabs
- Use wired internet connection
- Clear browser cache and cookies
- Restart browser

### Error Messages

**"Validation service unavailable"**:
- USPS API temporarily down
- Falls back to Census geocoding automatically

**"Rate limit exceeded"**:
- Too many requests in short time
- Wait 60 seconds before retrying

**"Invalid address format"**:
- Address parsing failed
- Try different format or be more specific

### Getting Help

1. **Check Error Messages**: Read specific error details
2. **Try Alternative Methods**: Use different validation approaches
3. **Refresh Application**: Restart can resolve temporary issues
4. **Check Network**: Verify internet connectivity
5. **Browser Console**: Check for JavaScript errors (F12)

## 🎯 Best Practices

### Address Input Best Practices
- **Be Specific**: Include city and state
- **Use Standard Format**: "123 Main St, City, ST"
- **Avoid Abbreviations**: Spell out street names when possible
- **Include ZIP When Known**: Improves accuracy significantly

### Navigation Best Practices
- **Start with State**: Select state first for better context
- **Use Address Search**: More accurate than clicking
- **Enable Validation**: For important address verification
- **Check Multiple Methods**: When accuracy is critical

### Performance Best Practices
- **Use Modern Browser**: Chrome, Firefox, Safari latest versions
- **Enable Caching**: Let browser cache resources
- **Stable Network**: WiFi or strong cellular connection
- **Close Unused Tabs**: Free up browser memory

## 📚 Advanced Features

### Batch Address Processing
**Future Feature**: Upload CSV files with multiple addresses
**Use Cases**: Verify mailing lists, analyze constituent data
**Output**: Downloadable results with district assignments

### Historical Data
**Future Feature**: View past district boundaries
**Use Cases**: Research redistricting changes
**Timeline**: Select different election cycles

### Export Capabilities
**Current**: Screenshot maps, copy district information
**Future**: Export district data, generate reports
**Formats**: PDF maps, CSV data, GeoJSON boundaries

### API Integration
**Current**: RESTful API available for developers
**Future**: Webhook support, GraphQL endpoints
**Documentation**: See API_REFERENCE.md for details

## 📞 Support and Feedback

### Getting Support
- **Documentation**: Check this guide and other docs
- **Error Messages**: Read specific error information
- **Browser Console**: Check for technical errors
- **Test Environment**: Try different browser/device

### Reporting Issues
When reporting problems, include:
- **Specific Address**: Exact address that failed
- **Error Message**: Complete error text
- **Browser/Device**: Browser version and device type
- **Steps to Reproduce**: What you did before error occurred

### Feature Requests
Suggest improvements for:
- **Address Validation**: New validation methods
- **User Interface**: Design and usability improvements  
- **Data Visualization**: New ways to display information
- **Performance**: Speed and efficiency enhancements

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**Support**: kevin@kevinalthaus.com