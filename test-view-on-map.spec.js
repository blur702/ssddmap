const { test, expect } = require('@playwright/test');

test.describe('View on Map Button Functionality', () => {
  test('should zoom to district when View on Map button is clicked', async ({ page }) => {
    console.log('🚀 Starting View on Map test...');
    
    // Navigate to the application
    await page.goto('http://localhost:3001/ssddmap/');
    
    // Wait for the map to load
    await page.waitForSelector('#map');
    console.log('✅ Map loaded');
    
    // Wait for districts to load
    await page.waitForTimeout(3000);
    
    // Get initial map center and zoom
    const initialMapState = await page.evaluate(() => {
      const map = window.modularApp?.core?.map;
      if (!map) return null;
      return {
        center: map.getCenter(),
        zoom: map.getZoom()
      };
    });
    
    console.log('📍 Initial map state:', initialMapState);
    
    // Click on a district (let's try to find a visible district)
    console.log('🖱️ Looking for districts to click...');
    
    // Wait for districts to be rendered
    await page.waitForSelector('svg path', { timeout: 10000 });
    
    // Click on a district path
    const districtPath = await page.locator('svg path').first();
    await districtPath.click();
    
    console.log('✅ Clicked on district');
    
    // Wait for sidebar to appear
    await page.waitForSelector('#info-sidebar', { state: 'visible' });
    console.log('✅ Sidebar appeared');
    
    // Look for the View on Map button
    const viewOnMapButton = page.locator('button[data-action="view-on-map"]');
    await expect(viewOnMapButton).toBeVisible();
    
    console.log('✅ View on Map button found');
    
    // Get the district info from sidebar to know which district we're testing
    const districtInfo = await page.locator('#info-sidebar .sidebar-content').textContent();
    console.log('📄 District info:', districtInfo.substring(0, 100) + '...');
    
    // Click the View on Map button
    console.log('🖱️ Clicking View on Map button...');
    await viewOnMapButton.click();
    
    // Wait a moment for the map to respond
    await page.waitForTimeout(2000);
    
    // Get the new map state
    const newMapState = await page.evaluate(() => {
      const map = window.modularApp?.core?.map;
      if (!map) return null;
      return {
        center: map.getCenter(),
        zoom: map.getZoom()
      };
    });
    
    console.log('📍 New map state:', newMapState);
    
    // Check if the map actually changed
    const mapChanged = initialMapState && newMapState && 
      (Math.abs(initialMapState.center.lat - newMapState.center.lat) > 0.001 ||
       Math.abs(initialMapState.center.lng - newMapState.center.lng) > 0.001 ||
       Math.abs(initialMapState.zoom - newMapState.zoom) > 0.1);
    
    console.log('📊 Map changed:', mapChanged);
    
    // Check if event was emitted
    const eventEmitted = await page.evaluate(() => {
      return window.testEventEmitted || false;
    });
    
    console.log('📡 Event emitted:', eventEmitted);
    
    // Let's also check if the DistrictInfoModule methods exist and work
    const moduleCheck = await page.evaluate(() => {
      const app = window.modularApp;
      if (!app || !app.districtInfoModule) return { error: 'No districtInfoModule' };
      
      const module = app.districtInfoModule;
      
      return {
        hasHandleActionClick: typeof module.handleActionClick === 'function',
        hasHandleAction: typeof module.handleAction === 'function',
        hasFocusOnMap: typeof module.focusOnMap === 'function',
        currentDistrictKey: module.currentDistrictKey,
        hasEventBus: !!window.eventBus
      };
    });
    
    console.log('🔍 Module check:', moduleCheck);
    
    // Test the focusOnMap method directly
    const directTest = await page.evaluate(() => {
      const app = window.modularApp;
      if (!app || !app.districtInfoModule) return { error: 'No module' };
      
      try {
        // Set up event capture
        window.testEventEmitted = false;
        if (window.eventBus) {
          window.eventBus.on('centerOnDistrict', () => {
            window.testEventEmitted = true;
          });
        }
        
        // Call focusOnMap directly
        app.districtInfoModule.focusOnMap();
        
        return { success: true, eventEmitted: window.testEventEmitted };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('🧪 Direct test result:', directTest);
    
    // If the map didn't change, let's debug further
    if (!mapChanged) {
      console.log('❌ Map did not change - debugging...');
      
      // Check console errors
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      // Check if clicking the button actually triggers the event
      await page.evaluate(() => {
        const button = document.querySelector('button[data-action="view-on-map"]');
        if (button) {
          console.log('Button found, clicking programmatically...');
          button.click();
        }
      });
      
      await page.waitForTimeout(1000);
      
      const finalEventCheck = await page.evaluate(() => {
        return window.testEventEmitted || false;
      });
      
      console.log('🔍 Final event check:', finalEventCheck);
      console.log('📝 Console messages:', consoleMessages);
    }
    
    // The test should fail if the map didn't change
    expect(mapChanged).toBe(true);
  });
});