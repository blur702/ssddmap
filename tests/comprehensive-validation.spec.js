const { test, expect } = require('@playwright/test');

test.describe('SSDD Map - Comprehensive Validation Testing', () => {
  let page;
  const baseURL = 'http://localhost:3001/ssddmap';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console Error:', msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.log('Page Error:', error.message);
    });

    // Listen for failed network requests
    page.on('requestfailed', request => {
      console.log('Failed Request:', request.url(), request.failure().errorText);
    });

    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.describe('Basic Application Loading', () => {
    test('should load the main page without errors', async () => {
      // Check if main elements are present
      await expect(page.locator('#map')).toBeVisible();
      await expect(page.locator('#toolbar')).toBeVisible();
      await expect(page.locator('#info-sidebar')).toBeVisible();
    });

    test('should have working map controls', async () => {
      // Check map style selector
      const mapStyle = page.locator('#mapStyle');
      await expect(mapStyle).toBeVisible();
      
      // Check state selector
      const stateSelect = page.locator('#stateSelect');
      await expect(stateSelect).toBeVisible();
    });

    test('should load without JavaScript errors', async () => {
      let jsErrors = [];
      page.on('pageerror', error => {
        jsErrors.push(error.message);
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
      
      expect(jsErrors).toHaveLength(0);
    });
  });

  test.describe('Address Search Functionality', () => {
    test('should perform basic address search', async () => {
      const addressInput = page.locator('#addressInput');
      const searchBtn = page.locator('#searchBtn');

      await addressInput.fill('1600 Pennsylvania Ave, Washington, DC');
      await searchBtn.click();

      // Wait for search to complete
      await page.waitForTimeout(3000);

      // Check if sidebar shows district information
      const districtInfo = page.locator('#districtInfo');
      await expect(districtInfo).toBeVisible();
    });

    test('should handle invalid addresses gracefully', async () => {
      const addressInput = page.locator('#addressInput');
      const searchBtn = page.locator('#searchBtn');

      await addressInput.fill('Invalid Address 123xyz');
      await searchBtn.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Should not crash the application
      await expect(page.locator('#map')).toBeVisible();
    });

    test('should test Lake Havasu address for ZIP+4 functionality', async () => {
      const addressInput = page.locator('#addressInput');
      
      await addressInput.fill('2330 McCulloch Blvd, Lake Havasu City, AZ');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(3000);

      // Check if district information is displayed
      const districtInfo = page.locator('#districtInfo');
      await expect(districtInfo).toBeVisible();
    });
  });

  test.describe('Validation Mode Testing', () => {
    test('should enable validation mode', async () => {
      const validationToggle = page.locator('#toggleValidationMode');
      await validationToggle.check();

      // Check if validation panel appears
      const validationPanel = page.locator('#validationPanel');
      await expect(validationPanel).toBeVisible();
    });

    test('should perform address validation', async () => {
      // Ensure validation mode is enabled
      const validationToggle = page.locator('#toggleValidationMode');
      await validationToggle.check();

      const validationAddress = page.locator('#validationAddress');
      const validateBtn = page.locator('#validateBtn');

      await validationAddress.fill('123 Main St, Springfield, IL');
      await validateBtn.click();

      // Wait for validation to complete
      await page.waitForTimeout(5000);

      // Check if validation results appear
      const validationResults = page.locator('#validationResults');
      await expect(validationResults).toBeVisible();
    });

    test('should test validation with problematic address format', async () => {
      const validationToggle = page.locator('#toggleValidationMode');
      await validationToggle.check();

      const validationAddress = page.locator('#validationAddress');
      const validateBtn = page.locator('#validateBtn');

      // Test address that might trigger line 109 error
      await validationAddress.fill('123, Main, Street, City, State, ZIP');
      await validateBtn.click();

      await page.waitForTimeout(3000);

      // Should handle gracefully without 500 error
      const validationResults = page.locator('#validationResults');
      // Results should show either success or error message, not crash
    });
  });

  test.describe('API Endpoint Testing', () => {
    test('should test validation API endpoint directly', async () => {
      const response = await page.request.post(`${baseURL}/api/validate-address`, {
        data: {
          address: '2330 McCulloch Blvd, Lake Havasu City, AZ'
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('originalInput');
    });

    test('should test problematic address that causes 500 error', async () => {
      // Test address format that might trigger line 109 error
      const response = await page.request.post(`${baseURL}/api/validate-address`, {
        data: {
          address: 'Street, City, State, ZIP, Extra, Parts, More, Data'
        }
      });

      // Should not return 500 error
      expect(response.status()).not.toBe(500);
      
      if (response.status() !== 200) {
        const errorData = await response.text();
        console.log('API Error Response:', errorData);
      }
    });

    test('should test USPS API status', async () => {
      const response = await page.request.get(`${baseURL}/api/test-usps`);
      
      // Should return status regardless of USPS configuration
      expect([200, 400, 401]).toContain(response.status());
      
      const data = await response.json();
      console.log('USPS API Status:', data);
    });

    test('should test empty address validation', async () => {
      const response = await page.request.post(`${baseURL}/api/validate-address`, {
        data: {
          address: ''
        }
      });

      // Should handle empty address gracefully
      expect([400, 422]).toContain(response.status());
    });

    test('should test null address validation', async () => {
      const response = await page.request.post(`${baseURL}/api/validate-address`, {
        data: {
          address: null
        }
      });

      // Should handle null address gracefully
      expect([400, 422]).toContain(response.status());
    });
  });

  test.describe('State and District Navigation', () => {
    test('should navigate between states', async () => {
      const stateSelect = page.locator('#stateSelect');
      
      // Select California
      await stateSelect.selectOption('CA');
      await page.waitForTimeout(2000);

      // Check if district selector is populated
      const districtSelector = page.locator('#districtSelector select');
      await expect(districtSelector).toBeVisible();
    });

    test('should select specific districts', async () => {
      const stateSelect = page.locator('#stateSelect');
      await stateSelect.selectOption('AZ');
      await page.waitForTimeout(2000);

      const districtSelector = page.locator('#districtSelector select');
      if (await districtSelector.isVisible()) {
        await districtSelector.selectOption({ index: 1 });
        await page.waitForTimeout(2000);

        // Check if district information is displayed
        const districtInfo = page.locator('#districtInfo');
        await expect(districtInfo).toBeVisible();
      }
    });
  });

  test.describe('Configuration and Settings', () => {
    test('should open API configuration modal', async () => {
      const configBtn = page.locator('#configBtn');
      await configBtn.click();

      const configModal = page.locator('#configModal');
      await expect(configModal).toBeVisible();

      // Close modal
      const closeBtn = page.locator('#configModal .close');
      await closeBtn.click();
    });

    test('should open data management modal', async () => {
      const dataManageBtn = page.locator('#dataManageBtn');
      await dataManageBtn.click();

      const dataModal = page.locator('#dataModal');
      await expect(dataModal).toBeVisible();

      // Close modal
      const closeBtn = page.locator('#dataModal .close');
      await closeBtn.click();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());

      const addressInput = page.locator('#addressInput');
      const searchBtn = page.locator('#searchBtn');

      await addressInput.fill('Test Address');
      await searchBtn.click();

      await page.waitForTimeout(2000);

      // Application should still be functional
      await expect(page.locator('#map')).toBeVisible();

      // Clear route interception
      await page.unroute('**/api/**');
    });

    test('should handle malformed address inputs', async () => {
      const testAddresses = [
        '',
        '   ',
        '123',
        'Street',
        ',,,,,',
        'A'.repeat(1000), // Very long string
        '!@#$%^&*()',
        '123 Main St, City, State, ZIP, Extra, Parts, That, Might, Cause, Issues'
      ];

      for (const address of testAddresses) {
        const response = await page.request.post(`${baseURL}/api/validate-address`, {
          data: { address }
        });

        // Should not return 500 error for any input
        expect(response.status()).not.toBe(500);
        
        if (response.status() === 500) {
          const errorText = await response.text();
          console.log(`500 Error for address "${address}":`, errorText);
        }
      }
    });
  });

  test.describe('Performance Testing', () => {
    test('should load page within reasonable time', async () => {
      const startTime = Date.now();
      await page.goto(baseURL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
      console.log(`Page load time: ${loadTime}ms`);
    });

    test('should handle multiple rapid API calls', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          page.request.post(`${baseURL}/api/validate-address`, {
            data: { address: `${i} Test St, City, State` }
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // Check that all requests completed without 500 errors
      for (const response of responses) {
        expect(response.status()).not.toBe(500);
      }
    });
  });

  test.describe('Specific Line 109 Error Investigation', () => {
    test('should test address formats that trigger line 109', async () => {
      const problematicFormats = [
        'Street, City, State, ZIP, Extra',
        'A, B, C, D, E, F',
        '123 Main, Springfield, Illinois, 62701, USA',
        'Address, City, Full State Name, ZIP',
        'Street, City, california, ZIP', // lowercase state
        'Street, City, new york, ZIP'     // multi-word state
      ];

      for (const address of problematicFormats) {
        console.log(`Testing address format: "${address}"`);
        
        const response = await page.request.post(`${baseURL}/api/validate-address`, {
          data: { address }
        });

        if (response.status() === 500) {
          const errorText = await response.text();
          console.log(`500 Error for "${address}":`, errorText);
          
          // Parse error to check if it's related to line 109
          if (errorText.includes('line 109') || errorText.includes('stateAbbreviations')) {
            console.log('Found line 109 error!');
          }
        }

        // This test should not fail, but log the results
        expect(response.status()).not.toBe(500);
      }
    });

    test('should test UI validation with problematic formats', async () => {
      const validationToggle = page.locator('#toggleValidationMode');
      await validationToggle.check();

      const validationAddress = page.locator('#validationAddress');
      const validateBtn = page.locator('#validateBtn');

      const problematicAddress = 'Street, City, california, ZIP, Extra';
      
      await validationAddress.fill(problematicAddress);
      await validateBtn.click();

      await page.waitForTimeout(3000);

      // Check for any error messages in the UI
      const errorMessages = await page.locator('.error, .alert-danger').allTextContents();
      if (errorMessages.length > 0) {
        console.log('UI Error Messages:', errorMessages);
      }

      // Application should still be responsive
      await expect(page.locator('#map')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check if main elements are still visible
      await expect(page.locator('#map')).toBeVisible();
      await expect(page.locator('#toolbar')).toBeVisible();

      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });
});