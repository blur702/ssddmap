# Address Input Modal

## Overview
The address input modal provides a user-friendly interface for entering addresses to find congressional districts. The design is inspired by the House Digital PRF (Public Release Form) interface.

## Features

### Modal Design
- Professional navy blue (#003366) header with white text
- Clean, spacious form layout
- Required field indicators with red asterisks
- Responsive design that works on all screen sizes

### Form Fields
1. **Street Address** (required)
   - Main street address input
   - Placeholder: "123 Main Street"

2. **Apartment/Suite/Unit** (optional)
   - Secondary address information
   - Placeholder: "Apt 4B"

3. **City** (required)
   - City name input
   - Placeholder: "Washington"

4. **State** (required)
   - Dropdown populated with USPS-accepted state codes
   - Includes all 50 states, territories, and military codes
   - Data fetched from `/api/usps-states` endpoint

5. **ZIP Code** (optional)
   - 5-digit ZIP code
   - Pattern validation for numeric input

### USPS States Support
The state dropdown includes:
- All 50 US states
- US territories (Puerto Rico, Virgin Islands, Guam, American Samoa, Northern Mariana Islands)
- Military postal codes (AA, AE, AP)
- Federal districts (DC)
- Pacific territories (FM, MH, PW)

### Validation Integration
When the form is submitted:
1. Address is sent to USPS API for standardization
2. Returns ZIP+4 and corrected address format
3. Geocodes the address to get coordinates
4. Looks up congressional district
5. Displays results in a clean card format

### Result Actions
After validation, users can:
- View the standardized USPS address
- See the congressional district assignment
- Click "Use This Address" to:
  - Place a marker on the map
  - Navigate to the location
  - Load and highlight the district boundaries

## Usage

### Opening the Modal
1. Click the **location pin icon** 📍 in the toolbar (rightmost section)
2. The button is the first icon button, with tooltip "Enter Address"

### Entering an Address
1. Fill in at least the required fields (Street, City, State)
2. ZIP code is optional but recommended
3. Click "Find My District" to validate

### Using Results
1. Review the standardized address
2. Check the district assignment
3. Click "Use This Address" to display on map

## Technical Implementation

### Files Modified
- `/public/index.html` - Added modal HTML structure
- `/public/styles.css` - Added modal styling and address marker styles
- `/public/js/addressModal.js` - New modal controller class
- `/public/js/app-modular.js` - Integrated modal with app
- `/server.js` - Added `/api/usps-states` endpoint

### API Endpoints
- `GET /api/usps-states` - Returns array of USPS state codes and names
- `POST /api/validate-address` - Validates address through USPS

### Styling Classes
- `.address-modal` - Main modal container
- `.address-form` - Form element styling
- `.address-result-card` - Result display cards
- `.district-badge` - Congressional district display
- `.use-address-btn` - Action button styling

## Error Handling
- Displays user-friendly messages for validation failures
- Falls back to Census geocoding if USPS fails
- Shows "Not Found" status for invalid addresses
- Handles lowercase state inputs by converting to uppercase

## Accessibility
- Proper label associations for all form fields
- Keyboard navigation support
- Focus management when modal opens
- ARIA-compliant form structure