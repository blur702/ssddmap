const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_ADDRESS = '2139 north pima drive, lake havasu city, arizona, 86403';
const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Address Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(BASE_URL);
    
    // Wait for the application to load
    await page.waitForSelector('#map', { state: 'visible' });
    
    // Enable validation mode
    const validationToggle = page.locator('#toggleValidationMode');
    await validationToggle.click();
    
    // Wait for validation panel to appear
    await page.waitForSelector('#validationPanel', { state: 'visible' });
  });

  test('Validation panel should be visible when enabled', async ({ page }) => {
    // Check that validation panel is visible
    const validationPanel = page.locator('#validationPanel');
    await expect(validationPanel).toBeVisible();
    
    // Check that validation input and button exist
    const validationInput = page.locator('#validationAddress');
    const validateButton = page.locator('#validateBtn');
    
    await expect(validationInput).toBeVisible();
    await expect(validateButton).toBeVisible();
  });

  test('Should validate address with Census geocoder', async ({ page }) => {
    // Open configuration modal
    await page.click('#configBtn');
    await page.waitForSelector('#configModal', { state: 'visible' });
    
    // Select Census as the lookup method
    await page.click('input[name="lookupMethod"][value="census"]');
    
    // Save configuration
    await page.click('#saveConfigBtn');
    await page.waitForSelector('#configModal', { state: 'hidden' });
    
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Click validate button
    await page.click('#validateBtn');
    
    // Wait for validation results
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Check that Census results are displayed
    const censusResults = page.locator('.method-result[data-method="census"]');
    await expect(censusResults).toBeVisible();
    
    // Verify address was standardized
    const standardizedAddress = censusResults.locator('.standardized-address');
    await expect(standardizedAddress).toContainText('2139');
    await expect(standardizedAddress).toContainText('PIMA');
    
    // Verify district information is displayed
    const districtInfo = censusResults.locator('.district-info');
    await expect(districtInfo).toContainText('District');
  });

  test('Should validate address with all methods comparison', async ({ page }) => {
    // Open configuration modal
    await page.click('#configBtn');
    await page.waitForSelector('#configModal', { state: 'visible' });
    
    // Select "Compare Both" as the lookup method
    await page.click('input[name="lookupMethod"][value="both"]');
    
    // Save configuration
    await page.click('#saveConfigBtn');
    await page.waitForSelector('#configModal', { state: 'hidden' });
    
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Click validate button
    await page.click('#validateBtn');
    
    // Wait for validation results
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 15000 
    });
    
    // Check that multiple method results are displayed
    const methodResults = page.locator('.method-result');
    const resultsCount = await methodResults.count();
    expect(resultsCount).toBeGreaterThan(1);
    
    // Check for analysis section
    const analysisSection = page.locator('.validation-analysis');
    await expect(analysisSection).toBeVisible();
  });

  test('Should handle USPS OAuth flow', async ({ page, context }) => {
    // Note: This test requires manual intervention for Google OAuth
    test.skip(process.env.CI, 'Skipping OAuth test in CI environment');
    
    // Open configuration modal
    await page.click('#configBtn');
    await page.waitForSelector('#configModal', { state: 'visible' });
    
    // Select ZIP+4 (USPS) as the lookup method
    await page.click('input[name="lookupMethod"][value="zip4"]');
    
    // Check if USPS needs configuration
    const uspsStatus = page.locator('#uspsStatus');
    const statusText = await uspsStatus.textContent();
    
    if (statusText.includes('Not configured') || statusText.includes('Needs auth')) {
      // Click authorize button if visible
      const authorizeBtn = page.locator('#authorizeUspsBtn');
      if (await authorizeBtn.isVisible()) {
        // Listen for new page (OAuth popup)
        const [popup] = await Promise.all([
          context.waitForEvent('page'),
          authorizeBtn.click()
        ]);
        
        // Wait for Google login page
        await popup.waitForLoadState();
        
        // This is where manual intervention would be needed for Google OAuth
        console.log('OAuth popup opened. Manual authentication required.');
        
        // For automated testing, we would need test credentials
        // which we don't want to commit to the codebase
        
        // Wait for the popup to close (after manual auth)
        await popup.waitForEvent('close', { timeout: 60000 });
      }
    }
    
    // Save configuration
    await page.click('#saveConfigBtn');
    await page.waitForSelector('#configModal', { state: 'hidden' });
    
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Click validate button
    await page.click('#validateBtn');
    
    // Wait for validation results
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 15000 
    });
    
    // Check for USPS results
    const uspsResults = page.locator('.method-result[data-method="usps"]');
    await expect(uspsResults).toBeVisible();
  });

  test('Should display validation errors for invalid addresses', async ({ page }) => {
    // Enter an incomplete address
    await page.fill('#validationAddress', 'invalid address');
    
    // Click validate button
    await page.click('#validateBtn');
    
    // Wait for error message
    await page.waitForSelector('#validationResults .error', { 
      state: 'visible',
      timeout: 5000 
    });
    
    // Check error message
    const errorMessage = page.locator('#validationResults .error');
    await expect(errorMessage).toContainText('must include at least street and city/state');
  });

  test('Should show loading state during validation', async ({ page }) => {
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Click validate button and immediately check for loading state
    const validatePromise = page.click('#validateBtn');
    
    // Check for loading indicator
    const loadingIndicator = page.locator('#validationResults .loading');
    await expect(loadingIndicator).toBeVisible();
    
    // Wait for validation to complete
    await validatePromise;
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Loading indicator should be gone
    await expect(loadingIndicator).not.toBeVisible();
  });

  test('Should display map markers for validated addresses', async ({ page }) => {
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Click validate button
    await page.click('#validateBtn');
    
    // Wait for validation results
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Check for map markers
    const mapMarkers = page.locator('.leaflet-marker-icon');
    const markerCount = await mapMarkers.count();
    expect(markerCount).toBeGreaterThan(0);
  });

  test('Validation should work with Enter key', async ({ page }) => {
    // Enter the test address
    await page.fill('#validationAddress', TEST_ADDRESS);
    
    // Press Enter key
    await page.press('#validationAddress', 'Enter');
    
    // Wait for validation results
    await page.waitForSelector('#validationResults .validation-comparison', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Check that results are displayed
    const methodResults = page.locator('.method-result');
    const resultsCount = await methodResults.count();
    expect(resultsCount).toBeGreaterThan(0);
  });
});

// Helper test for checking API configuration
test.describe('API Configuration Tests', () => {
  test('Should save API configuration', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#map', { state: 'visible' });
    
    // Open configuration modal
    await page.click('#configBtn');
    await page.waitForSelector('#configModal', { state: 'visible' });
    
    // Fill in test API credentials (these would be test/mock credentials)
    await page.fill('#uspsClientId', 'test-client-id');
    await page.fill('#uspsClientSecret', 'test-client-secret');
    
    // Save configuration
    await page.click('#saveConfigBtn');
    
    // Check for success notification
    const notification = page.locator('.notification.success');
    await expect(notification).toBeVisible();
    await expect(notification).toContainText('Configuration saved');
  });
});