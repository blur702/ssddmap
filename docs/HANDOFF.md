# Congressional Districts Map Application - Handoff Documentation

## Current Status

The application has been completely rewritten with a modular architecture to address the issues of:
- Map not displaying
- JavaScript errors (addEventListener on null elements)
- Tight coupling between UI and functionality
- Difficult to maintain monolithic code structure

## Architecture Overview

The application is now structured with ES6 modules:

```
/var/www/kevinalthaus.com/apps/ssddmap/
├── public/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # All styles
│   ├── js/
│   │   ├── app-modular.js  # Main application coordinator
│   │   ├── map.js          # Map management module
│   │   ├── search.js       # Search functionality module
│   │   ├── ui.js           # UI components module
│   │   └── data.js         # Data fetching/caching module
│   └── app.js              # Old monolithic file (backed up as app-old.js)
├── server.js               # Express backend
└── tests/
    ├── unit/              # Unit tests
    └── playwright/        # E2E tests
```

## Known Issues & Tasks

### 1. **Module Loading Issue**
The browser needs to load ES6 modules. The current implementation uses:
```html
<script type="module" src="js/app-modular.js"></script>
```

**Potential Issues:**
- CORS errors if modules aren't served with correct MIME type
- Path resolution for imports
- Browser compatibility with older browsers

**To Fix:**
1. Ensure nginx serves .js files with `Content-Type: application/javascript`
2. Consider using a bundler (webpack/rollup) for production
3. Add fallback for browsers without module support

### 2. **API Endpoints**
The application expects these endpoints on the backend:

- `GET /ssddmap/api/states` - List of US states
- `GET /ssddmap/api/districts` - All congressional districts GeoJSON
- `GET /ssddmap/api/districts/:state` - Districts for specific state
- `GET /ssddmap/api/house-members` - Current House members data
- `POST /ssddmap/api/geocode` - Census geocoding
- `GET /ssddmap/api/cache-status` - Cache status info
- `POST /ssddmap/api/refresh-cache` - Refresh member cache
- `GET /ssddmap/api/config-status` - API configuration status
- `POST /ssddmap/api/save-config` - Save API configuration

**To Verify:**
```bash
curl https://kevinalthaus.com/ssddmap/api/districts
curl https://kevinalthaus.com/ssddmap/api/house-members
```

### 3. **Testing Setup**

**Unit Tests:**
- Located in `/tests/unit/`
- Requires Jest setup
- Tests need to be run with proper module mocking

**Playwright Tests:**
- Located in `/tests/playwright/`
- Configuration in `playwright.config.js`
- Tests all major functionality

**To Run Tests:**
```bash
# Install dependencies
cd /var/www/kevinalthaus.com/apps/ssddmap
npm install --save-dev @playwright/test jest

# Run Playwright tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test ssddmap.spec.js
```

### 4. **Immediate Fixes Needed**

1. **Check if modules are loading:**
   ```javascript
   // Add to index.html temporarily
   <script>
   window.addEventListener('error', (e) => {
       console.error('Script error:', e);
   });
   </script>
   ```

2. **Verify Leaflet is loaded:**
   ```javascript
   // Check in browser console
   typeof L !== 'undefined'
   ```

3. **Check module imports:**
   The app uses ES6 imports which may need adjustment:
   ```javascript
   // Current
   import { MapManager } from './map.js';
   
   // May need to be
   import { MapManager } from '/ssddmap/js/map.js';
   ```

### 5. **Debugging Steps**

1. **Open Browser DevTools:**
   - Check Console for errors
   - Check Network tab for 404s
   - Check if modules are loading

2. **Common Error Fixes:**

   **If "Cannot find module":**
   - Update import paths to be absolute
   - Check file permissions (should be 644)
   
   **If "L is not defined":**
   - Ensure Leaflet loads before modules
   - Consider dynamic import
   
   **If "Cannot read property of null":**
   - DOM elements missing
   - Check if HTML IDs match what JS expects

3. **Test Basic Functionality:**
   ```javascript
   // In browser console after page loads
   window.congressApp  // Should exist
   window.congressApp.map.getMap()  // Should return Leaflet map
   ```

### 6. **Data Flow**

1. **Page Load:**
   - HTML loads → Leaflet loads → Modules load → App initializes
   - App fetches states → Loads all districts → Fetches member data

2. **User Search:**
   - User types → SearchManager handles input → Geocoding API called
   - Results displayed → User selects → Map updates → District info shown

3. **State Selection:**
   - User selects state → DataManager fetches state districts
   - MapManager clears and redraws → Fits bounds to state

### 7. **Module Responsibilities**

**MapManager (`map.js`):**
- Leaflet map initialization
- Layer management
- Style switching
- Marker management

**SearchManager (`search.js`):**
- Address input handling
- Autocomplete suggestions
- Geocoding coordination
- Search result selection

**UIManager (`ui.js`):**
- DOM element caching
- Event listener setup
- Modal management
- Loading states
- Notifications

**DataManager (`data.js`):**
- API communication
- Data caching
- Party color mapping
- Configuration management

**Main App (`app-modular.js`):**
- Module coordination
- Event routing
- State management
- Initialization flow

### 8. **Quick Fixes to Try**

1. **Replace module imports with direct script tags:**
   ```html
   <!-- Instead of module -->
   <script src="js/map.js"></script>
   <script src="js/search.js"></script>
   <script src="js/ui.js"></script>
   <script src="js/data.js"></script>
   <script src="js/app-modular.js"></script>
   ```

2. **Use the old working file:**
   ```bash
   cp /var/www/kevinalthaus.com/apps/ssddmap/public/app-old.js /var/www/kevinalthaus.com/apps/ssddmap/public/app.js
   # Update index.html to use app.js
   ```

3. **Add error boundary:**
   ```javascript
   try {
       const app = new CongressionalDistrictsApp();
       app.initialize();
   } catch (error) {
       console.error('App initialization failed:', error);
       document.getElementById('loading').innerHTML = 'Error loading application';
   }
   ```

### 9. **Production Deployment**

1. **Bundle the modules:**
   ```bash
   npm install --save-dev webpack webpack-cli
   npx webpack --entry ./public/js/app-modular.js --output-path ./public/dist
   ```

2. **Minify assets:**
   ```bash
   npm install --save-dev terser clean-css-cli
   npx terser public/js/*.js -o public/dist/app.min.js
   npx cleancss -o public/dist/styles.min.css public/styles.css
   ```

3. **Update HTML references:**
   ```html
   <link rel="stylesheet" href="dist/styles.min.css">
   <script src="dist/app.min.js"></script>
   ```

### 10. **Testing Checklist**

- [ ] Page loads without console errors
- [ ] Map displays with tiles
- [ ] Address search returns results
- [ ] Clicking search result updates map
- [ ] State selection loads districts
- [ ] District click shows info sidebar
- [ ] Toggle switches work (autosuggest, rep view)
- [ ] Modals open and close properly
- [ ] Map style selector changes tiles
- [ ] View USA button resets view
- [ ] Mobile responsive layout works

### 11. **Contact & Resources**

- **Server:** Ubuntu VPS at kevinalthaus.com
- **Process Manager:** PM2 (process name: ssddmap)
- **SSL:** Let's Encrypt via Certbot
- **Node Version:** Check with `node --version`
- **Dependencies:** Check `package.json`

### 12. **Emergency Rollback**

If nothing works, rollback to the previous version:
```bash
cd /var/www/kevinalthaus.com/apps/ssddmap/public
cp app-old.js app.js
cp index-old.html index.html
cp styles-old.css styles.css
# Remove the modular JS reference and use the old app.js
```

Then fix the addEventListener error in app-old.js by wrapping everything in:
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // All the code here
});
```

## Next Steps

1. Check browser console for specific errors
2. Verify all API endpoints are responding
3. Test module loading in isolation
4. Run Playwright tests to identify failing features
5. Consider using a build tool for production

The modular architecture is sound and follows best practices. The main issue is likely module loading or path resolution, which should be straightforward to fix once the specific error is identified.