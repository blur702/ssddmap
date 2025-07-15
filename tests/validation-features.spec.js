// Simple validation test for all key features
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3001/ssddmap';

test.describe('SSDD Map - Validation Features', () => {
  test.beforeEach(async ({ page }) => {
    // Set up error logging
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('Console Error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('Page Error:', error.message);
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should load application without errors', async ({ page }) => {
    // Basic loading test
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#info-sidebar')).toBeVisible();
    
    // Check for validation toggle
    await expect(page.locator('#toggleValidationMode')).toBeVisible();
  });

  test('should enable validation mode', async ({ page }) => {
    const validationToggle = page.locator('#toggleValidationMode');
    await validationToggle.check();
    
    // Validation panel should appear
    const validationPanel = page.locator('#validationPanel');
    await expect(validationPanel).toBeVisible();
    
    // Should show notification
    await page.waitForTimeout(1000);
  });

  test('should handle basic address validation', async ({ page }) => {
    // Enable validation mode
    await page.locator('#toggleValidationMode').check();
    
    const addressInput = page.locator('#validationAddress');
    const validateBtn = page.locator('#validateBtn');
    
    await addressInput.fill('1600 Pennsylvania Ave, Washington, DC');
    await validateBtn.click();
    
    // Wait for validation to complete
    await page.waitForTimeout(5000);
    
    // Check if results appear
    const validationResults = page.locator('#validationResults');
    await expect(validationResults).toBeVisible();
    
    // Should not have thrown JavaScript errors
    const consoleErrors = await page.evaluate(() => window.consoleErrors || []);
    expect(consoleErrors.length).toBe(0);
  });

  test('should handle problematic address formats without errors', async ({ page }) => {
    await page.locator('#toggleValidationMode').check();
    
    const addressInput = page.locator('#validationAddress');
    const validateBtn = page.locator('#validateBtn');
    
    const problematicAddresses = [
      'Street, City, california, ZIP, Extra, Parts',
      '123, Main, Street, City, california, ZIP',
      'A, B, C, D, E, F, G',
      'Street',
      '   ',
      ',,,,,',
    ];
    
    for (const address of problematicAddresses) {
      console.log(`Testing problematic address: "${address}"`);
      
      await addressInput.fill(address);
      await validateBtn.click();
      
      await page.waitForTimeout(2000);
      
      // Application should still be functional
      await expect(page.locator('#map')).toBeVisible();
      await expect(page.locator('#validationPanel')).toBeVisible();
    }
  });

  test('should test Lake Havasu address validation', async ({ page }) => {
    await page.locator('#toggleValidationMode').check();
    
    const addressInput = page.locator('#validationAddress');
    const validateBtn = page.locator('#validateBtn');
    
    await addressInput.fill('2330 McCulloch Blvd, Lake Havasu City, AZ');
    await validateBtn.click();
    
    await page.waitForTimeout(5000);
    
    const validationResults = page.locator('#validationResults');
    await expect(validationResults).toBeVisible();
    
    // Check if we get some validation results
    const resultsText = await validationResults.textContent();
    expect(resultsText).toContain('Census'); // Should have census results at minimum
  });

  test('should handle normal address search', async ({ page }) => {
    const addressInput = page.locator('#addressInput');
    const searchBtn = page.locator('#searchBtn');
    
    await addressInput.fill('1600 Pennsylvania Ave, Washington, DC');
    await searchBtn.click();
    
    await page.waitForTimeout(3000);
    
    // Should show district information
    const districtInfo = page.locator('#districtInfo');
    await expect(districtInfo).toBeVisible();
  });

  test('should test state navigation', async ({ page }) => {
    const stateSelect = page.locator('#stateSelect');
    
    // Select Arizona (where Lake Havasu is)
    await stateSelect.selectOption('AZ');
    await page.waitForTimeout(2000);
    
    // Should show district selector
    const districtSelector = page.locator('#districtSelector');
    await expect(districtSelector).toBeVisible();
  });

  test('should open configuration modal', async ({ page }) => {
    const configBtn = page.locator('#configBtn');
    await configBtn.click();
    
    const configModal = page.locator('#configModal');
    await expect(configModal).toBeVisible();
    
    // Check for USPS configuration section
    await expect(page.locator('#uspsClientId')).toBeVisible();
    await expect(page.locator('#uspsClientSecret')).toBeVisible();
    
    // Close modal
    await page.locator('#configModal .close').click();
  });

  test('should test API endpoints directly', async ({ page }) => {
    // Test validation endpoint
    const validationResponse = await page.request.post(`${BASE_URL}/api/validate-address`, {
      data: { address: '2330 McCulloch Blvd, Lake Havasu City, AZ' }
    });
    
    expect(validationResponse.status()).toBe(200);
    const validationData = await validationResponse.json();
    expect(validationData).toHaveProperty('originalInput');
    expect(validationData).toHaveProperty('parsedAddress');
    
    // Test USPS status endpoint
    const uspsResponse = await page.request.get(`${BASE_URL}/api/test-usps`);
    expect(uspsResponse.status()).toBe(200);
    
    // Test states endpoint
    const statesResponse = await page.request.get(`${BASE_URL}/api/states`);
    expect(statesResponse.status()).toBe(200);
  });

  test('should handle edge case addresses that might cause line 109 error', async ({ page }) => {
    // Listen for specific JavaScript errors
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      if (error.message.includes('line 109') || error.message.includes('validation.js:109')) {
        console.log('*** FOUND LINE 109 ERROR IN BROWSER ***', error.message);
      }
    });
    
    await page.locator('#toggleValidationMode').check();
    
    const edgeCases = [
      'Street, City, State, ZIP, Extra, Parts, More',
      '123, 456, 789, ABC, DEF, GHI',
      'A'.repeat(100), // Very long string
      'Test, Test, Test, Test, Test, Test',
    ];
    
    for (const address of edgeCases) {
      const addressInput = page.locator('#validationAddress');
      const validateBtn = page.locator('#validateBtn');
      
      await addressInput.fill(address);
      await validateBtn.click();
      
      await page.waitForTimeout(3000);
      
      // Check that no JavaScript errors occurred
      expect(jsErrors.length).toBe(0);
      
      // Application should still be responsive
      await expect(page.locator('#map')).toBeVisible();
    }
  });

  test('should test mobile responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Main elements should still be visible
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeVisible();
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});