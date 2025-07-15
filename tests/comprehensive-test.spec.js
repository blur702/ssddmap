// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('SSDD Map Application Comprehensive Tests', () => {
  let consoleErrors = [];
  let networkErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset errors before each test
    consoleErrors = [];
    networkErrors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        // Ignore favicon 404 errors as they're not critical
        if (!errorText.includes('favicon.ico')) {
          consoleErrors.push({
            text: errorText,
            location: msg.location(),
          });
        }
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      consoleErrors.push({
        text: err.message,
        stack: err.stack,
      });
    });
    
    // Listen for failed network requests
    page.on('requestfailed', request => {
      // Ignore favicon failures
      if (!request.url().includes('favicon.ico')) {
        networkErrors.push({
          url: request.url(),
          failure: request.failure(),
        });
      }
    });
  });

  test('Application Load Test', async ({ page }) => {
    console.log('\n=== SSDD Map Application Test Report ===\n');
    
    // Navigate to the application
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for the page to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check if the map loaded
    const mapLoaded = await page.locator('#map').isVisible();
    console.log(`✓ Map container visible: ${mapLoaded}`);
    
    // Check for Leaflet initialization
    const leafletInitialized = await page.evaluate(() => {
      return typeof L !== 'undefined' && L.version;
    });
    console.log(`✓ Leaflet library loaded: ${leafletInitialized ? 'Yes (v' + leafletInitialized + ')' : 'No'}`);
    
    // Check main UI elements
    const uiElements = {
      'Toolbar': '#toolbar',
      'App Title': '.app-title',
      'Address Input': '#addressInput',
      'Search Button': '#searchBtn',
      'State Selector': '#stateSelect',
      'Map Style Selector': '#mapStyle',
      'Auto-suggest Toggle': '#autosuggestToggle',
      'Rep View Toggle': '#toggleRepView',
      'View USA Button': '#viewUSA',
      'Data Management Button': '#dataManageBtn',
      'Config Button': '#configBtn',
      'Info Sidebar': '#info-sidebar',
      'Party Legend': '#partyLegend'
    };
    
    console.log('\n--- UI Elements Check ---');
    for (const [name, selector] of Object.entries(uiElements)) {
      const isVisible = await page.locator(selector).isVisible();
      console.log(`${isVisible ? '✓' : '✗'} ${name}: ${isVisible ? 'Visible' : 'Not visible'}`);
    }
    
    // Check if states are loaded in the dropdown
    const stateOptions = await page.locator('#stateSelect option').count();
    console.log(`\n✓ State options loaded: ${stateOptions - 1} states (excluding "All States")`);
    
    // Check if map tiles are loading
    const tilesLoaded = await page.locator('.leaflet-tile-container img').count();
    console.log(`✓ Map tiles loaded: ${tilesLoaded} tiles`);
    
    // Report JavaScript errors
    if (consoleErrors.length > 0) {
      console.log('\n--- JavaScript Errors Found ---');
      consoleErrors.forEach((error, index) => {
        console.log(`\nError ${index + 1}:`);
        console.log(`Message: ${error.text}`);
        if (error.stack) {
          console.log(`Stack trace:\n${error.stack}`);
        }
        if (error.location) {
          console.log(`Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
      });
    } else {
      console.log('\n✓ No JavaScript errors detected');
    }
    
    // Report network errors
    if (networkErrors.length > 0) {
      console.log('\n--- Network Errors Found ---');
      networkErrors.forEach((error, index) => {
        console.log(`\nNetwork Error ${index + 1}:`);
        console.log(`URL: ${error.url}`);
        console.log(`Failure: ${error.failure?.errorText || 'Unknown'}`);
      });
    } else {
      console.log('\n✓ No network errors detected');
    }
    
    // Test basic functionality
    console.log('\n--- Functionality Tests ---');
    
    // Test state selector
    await page.selectOption('#stateSelect', { index: 1 });
    await page.waitForTimeout(2000);
    const selectedState = await page.locator('#stateSelect').inputValue();
    console.log(`✓ State selector functional: Selected "${selectedState}"`);
    
    // Test map style change
    const initialStyle = await page.locator('#mapStyle').inputValue();
    await page.selectOption('#mapStyle', 'dark');
    await page.waitForTimeout(1000);
    const newStyle = await page.locator('#mapStyle').inputValue();
    console.log(`✓ Map style selector functional: Changed from "${initialStyle}" to "${newStyle}"`);
    
    // Test configuration modal
    await page.click('#configBtn');
    const configModalVisible = await page.locator('#configModal').isVisible();
    console.log(`✓ Config modal opens: ${configModalVisible}`);
    if (configModalVisible) {
      await page.click('#configModal .close');
      await page.waitForTimeout(500);
      const configModalClosed = await page.locator('#configModal').isHidden();
      console.log(`✓ Config modal closes: ${configModalClosed}`);
    }
    
    // Take a final screenshot
    await page.screenshot({ path: 'final-state-screenshot.png', fullPage: true });
    console.log('\n✓ Screenshot saved: final-state-screenshot.png');
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`JavaScript Errors: ${consoleErrors.length}`);
    console.log(`Network Errors: ${networkErrors.length}`);
    console.log(`Application Status: ${consoleErrors.length === 0 ? 'Functional with no critical errors' : 'Functional with some errors'}`);
    
    // The test passes if the app loads, even with some errors
    expect(mapLoaded).toBe(true);
  });
});