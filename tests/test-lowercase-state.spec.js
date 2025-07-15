const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('USPS Validation with Lowercase State', () => {
  test('should handle lowercase state abbreviations', async ({ page }) => {
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
    
    await page.waitForSelector('#validationPanel', { state: 'visible' });
    
    console.log('3. Testing address with lowercase state "az"...');
    const addressInput = page.locator('#validationAddress');
    await addressInput.fill('2131 n pima drive lake havasu city az');
    
    const validateBtn = page.locator('#validateBtn');
    await validateBtn.click();
    
    // Wait for results
    await page.waitForSelector('#validationResults .validation-method', { timeout: 10000 });
    
    // Check USPS results
    const uspsCard = page.locator('.validation-method:has-text("USPS Standardization")');
    await expect(uspsCard).toBeVisible();
    
    const uspsContent = await uspsCard.textContent();
    console.log('\nUSPS Results:');
    
    // Check for successful validation
    if (uspsContent.includes('Success')) {
      console.log('✓ USPS validation successful');
    }
    
    // Check standardized address
    if (uspsContent.includes('2131 PIMA DR N')) {
      console.log('✓ Street standardized: 2131 PIMA DR N');
    }
    
    if (uspsContent.includes('LK HAVASU CTY')) {
      console.log('✓ City standardized: LK HAVASU CTY');
    }
    
    if (uspsContent.includes('AZ')) {
      console.log('✓ State converted to uppercase: AZ');
    }
    
    if (uspsContent.includes('86403-6796')) {
      console.log('✓ ZIP+4 obtained: 86403-6796');
    }
    
    // Should not have any USPS errors
    expect(uspsContent).not.toContain('OASValidation');
    expect(uspsContent).not.toContain('regex');
    
    console.log('\n✅ Lowercase state handling test passed!');
  });
});
