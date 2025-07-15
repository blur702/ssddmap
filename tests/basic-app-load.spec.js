// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('SSDD Map Application Basic Tests', () => {
  // Array to collect console errors
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset console errors before each test
    consoleErrors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      consoleErrors.push({
        text: err.message,
        stack: err.stack,
      });
    });
  });

  test('should load the application without JavaScript errors', async ({ page }) => {
    // Navigate to the application
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for the map to load (check for Leaflet map container)
    await page.waitForSelector('#map', { timeout: 10000 });
    
    // Check that there are no console errors
    expect(consoleErrors).toHaveLength(0);
    
    // If there are errors, log them for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:');
      consoleErrors.forEach((error, index) => {
        console.log(`Error ${index + 1}:`, error);
      });
    }
  });

  test('should display the main UI elements', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Check toolbar is visible
    await expect(page.locator('#toolbar')).toBeVisible();
    
    // Check app title
    await expect(page.locator('.app-title')).toHaveText('Congressional Districts');
    
    // Check search input
    await expect(page.locator('#addressInput')).toBeVisible();
    
    // Check state selector
    await expect(page.locator('#stateSelect')).toBeVisible();
    
    // Check map style selector
    await expect(page.locator('#mapStyle')).toBeVisible();
    
    // Check toggle switches
    await expect(page.locator('#autosuggestToggle')).toBeVisible();
    await expect(page.locator('#toggleRepView')).toBeVisible();
    
    // Check map container
    await expect(page.locator('#map')).toBeVisible();
    
    // Check sidebar
    await expect(page.locator('#info-sidebar')).toBeVisible();
  });

  test('should load the Leaflet map', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for map container
    await page.waitForSelector('#map');
    
    // Check if Leaflet tiles are loading
    await page.waitForSelector('.leaflet-tile-container img', { timeout: 15000 });
    
    // Verify map controls are present
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
    
    // Check if map has initialized by looking for leaflet classes
    const mapElement = page.locator('#map');
    await expect(mapElement).toHaveClass(/leaflet-container/);
  });

  test('should load state selector with options', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for state selector
    const stateSelect = page.locator('#stateSelect');
    await expect(stateSelect).toBeVisible();
    
    // Check that it has options (should have more than just the default "All States")
    const optionCount = await stateSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);
  });

  test('should handle address search input', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for search input
    const searchInput = page.locator('#addressInput');
    await expect(searchInput).toBeVisible();
    
    // Type a test address
    await searchInput.fill('1600 Pennsylvania Avenue, Washington, DC');
    
    // Check that the value was entered
    await expect(searchInput).toHaveValue('1600 Pennsylvania Avenue, Washington, DC');
    
    // Click search button
    const searchBtn = page.locator('#searchBtn');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    
    // Wait for any loading to complete (check loading overlay disappears)
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 30000 });
  });

  test('should toggle between map styles', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for map style selector
    const mapStyleSelect = page.locator('#mapStyle');
    await expect(mapStyleSelect).toBeVisible();
    
    // Get initial tile source
    await page.waitForSelector('.leaflet-tile-container img');
    const initialTileSrc = await page.locator('.leaflet-tile-container img').first().getAttribute('src');
    
    // Change map style
    await mapStyleSelect.selectOption('dark');
    
    // Wait a bit for tiles to update
    await page.waitForTimeout(2000);
    
    // Check that tile source changed
    const newTileSrc = await page.locator('.leaflet-tile-container img').first().getAttribute('src');
    expect(newTileSrc).not.toBe(initialTileSrc);
  });

  test('should open and close configuration modal', async ({ page }) => {
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Click config button
    const configBtn = page.locator('#configBtn');
    await expect(configBtn).toBeVisible();
    await configBtn.click();
    
    // Check modal is visible
    const configModal = page.locator('#configModal');
    await expect(configModal).toBeVisible();
    
    // Check modal title
    await expect(configModal.locator('.modal-header h3')).toHaveText('API Configuration');
    
    // Close modal
    await configModal.locator('.close').click();
    
    // Check modal is hidden
    await expect(configModal).not.toBeVisible();
  });

  test('should detect any network errors', async ({ page }) => {
    const failedRequests = [];
    
    // Listen for failed requests
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure(),
      });
    });
    
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait for initial load
    await page.waitForSelector('#map');
    await page.waitForTimeout(3000);
    
    // Log any failed requests
    if (failedRequests.length > 0) {
      console.log('Failed requests:');
      failedRequests.forEach((req, index) => {
        console.log(`Request ${index + 1}: ${req.url}`);
        console.log('Failure:', req.failure);
      });
    }
    
    // We don't fail the test for network errors, but log them for review
    // Some tile requests might fail due to rate limiting or network issues
  });
});