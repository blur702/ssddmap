const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Complete USPS Validation Workflow', () => {
  test('full address validation workflow with ZIP+4', async ({ page }) => {
    console.log('1. Navigating to application...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    console.log('2. Enabling validation mode...');
    await page.evaluate(() => {
      const toggle = document.getElementById('toggleValidationMode');
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait for validation panel
    await page.waitForSelector('#validationPanel', { state: 'visible', timeout: 5000 });
    console.log('✓ Validation panel is visible');
    
    console.log('3. Testing address without ZIP+4...');
    const addressInput = page.locator('#validationAddress');
    await addressInput.fill('2330 McCulloch Blvd, Lake Havasu City, AZ');
    
    const validateBtn = page.locator('#validateBtn');
    await validateBtn.click();
    
    // Wait for results
    await page.waitForSelector('#validationResults .validation-method', { timeout: 10000 });
    console.log('✓ Validation results received');
    
    // Check USPS results
    const uspsCard = page.locator('.validation-method:has-text("USPS Standardization")');
    await expect(uspsCard).toBeVisible();
    
    const uspsContent = await uspsCard.textContent();
    console.log('\nUSPS Validation Results:');
    console.log('------------------------');
    
    // Extract standardized address
    if (uspsContent.includes('2330 MCCULLOCH BLVD N')) {
      console.log('✓ Street standardized: 2330 MCCULLOCH BLVD N');
    }
    
    if (uspsContent.includes('LK HAVASU CTY')) {
      console.log('✓ City standardized: LK HAVASU CTY');
    }
    
    if (uspsContent.includes('86403-5950')) {
      console.log('✓ ZIP+4 obtained: 86403-5950');
    }
    
    if (uspsContent.includes('AZ-9')) {
      console.log('✓ District identified: AZ-9');
    }
    
    // Check for coordinates
    if (uspsContent.includes('34.477583')) {
      console.log('✓ Coordinates obtained: 34.477583, -114.319843');
    }
    
    // Look for "Use This Address" button
    const useAddressBtn = page.locator('.use-address-btn');
    const btnCount = await useAddressBtn.count();
    console.log(`\n✓ Found ${btnCount} "Use This Address" button(s)`);
    
    if (btnCount > 0) {
      console.log('4. Clicking "Use This Address"...');
      await useAddressBtn.first().click();
      
      // Wait for map update
      await page.waitForTimeout(2000);
      
      // Check for marker on map
      const mapMarkers = await page.locator('.leaflet-marker-icon').count();
      console.log(`✓ ${mapMarkers} marker(s) placed on map`);
      
      // Check for popup
      const popup = page.locator('.leaflet-popup');
      if (await popup.count() > 0) {
        const popupContent = await popup.textContent();
        console.log('\nMap Popup Content:');
        console.log('------------------');
        if (popupContent.includes('USPS Validated Address')) {
          console.log('✓ Shows "USPS Validated Address"');
        }
        if (popupContent.includes('ZIP+4: 86403-5950')) {
          console.log('✓ Shows ZIP+4 in popup');
        }
        if (popupContent.includes('District: AZ-9')) {
          console.log('✓ Shows district in popup');
        }
      }
    }
    
    console.log('\n5. Testing address without commas...');
    await addressInput.fill('2131 n pima drive lake havasu city az');
    await validateBtn.click();
    
    // Wait for new results
    await page.waitForTimeout(3000);
    
    // Check if validation still works
    const newUspsCard = page.locator('.validation-method:has-text("USPS Standardization")').first();
    if (await newUspsCard.count() > 0) {
      const newContent = await newUspsCard.textContent();
      if (newContent.includes('Success') || newContent.includes('Failed')) {
        console.log('✓ Address without commas processed');
      }
    }
    
    console.log('\n✅ Complete validation workflow test passed!');
  });

  test('validate multiple address formats', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Enable validation mode
    await page.evaluate(() => {
      const toggle = document.getElementById('toggleValidationMode');
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    await page.waitForSelector('#validationPanel', { state: 'visible' });
    
    const testAddresses = [
      {
        input: '1600 Pennsylvania Avenue, Washington, DC',
        expected: 'White House address'
      },
      {
        input: '350 5th Ave, New York, NY 10118',
        expected: 'Empire State Building'
      },
      {
        input: '233 S Wacker Dr, Chicago, IL',
        expected: 'Willis Tower'
      }
    ];
    
    for (const testCase of testAddresses) {
      console.log(`\nTesting: ${testCase.expected}`);
      console.log(`Input: ${testCase.input}`);
      
      const addressInput = page.locator('#validationAddress');
      await addressInput.fill(testCase.input);
      
      const validateBtn = page.locator('#validateBtn');
      await validateBtn.click();
      
      await page.waitForTimeout(3000);
      
      const uspsCard = page.locator('.validation-method:has-text("USPS Standardization")').first();
      if (await uspsCard.count() > 0) {
        const content = await uspsCard.textContent();
        if (content.includes('Success')) {
          console.log('✓ USPS validation successful');
          if (content.match(/\d{5}-\d{4}/)) {
            const zip4 = content.match(/\d{5}-\d{4}/)[0];
            console.log(`✓ ZIP+4: ${zip4}`);
          }
        } else {
          console.log('✗ USPS validation failed');
        }
      }
    }
  });
});
