const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('USPS Validation UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should enable validation mode and validate address', async ({ page }) => {
    // Enable validation mode
    const validationToggle = await page.locator('#toggleValidationMode');
    
    // Check if toggle is visible, if not open the toolbar
    const isToggleVisible = await validationToggle.isVisible();
    console.log('Toggle visible:', isToggleVisible);
    
    // Force click the checkbox
    await page.evaluate(() => {
      const toggle = document.getElementById('toggleValidationMode');
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait for validation panel to appear
    await page.waitForSelector('#validationPanel', { state: 'visible', timeout: 5000 });
    
    // Enter address
    const addressInput = page.locator('#validationAddress');
    await addressInput.fill('2330 McCulloch Blvd, Lake Havasu City, AZ');
    
    // Click validate button
    const validateBtn = page.locator('#validateBtn');
    await validateBtn.click();
    
    // Wait for results
    await page.waitForSelector('#validationResults .validation-method', { timeout: 10000 });
    
    // Check if USPS results are displayed
    const uspsCard = page.locator('.validation-method:has-text("USPS Standardization")');
    await expect(uspsCard).toBeVisible();
    
    // Check for ZIP+4
    const uspsContent = await uspsCard.textContent();
    console.log('USPS Results:', uspsContent);
    expect(uspsContent).toContain('86403-5950');
    
    // Check for "Use This Address" button
    const useAddressBtn = page.locator('.use-address-btn');
    const btnCount = await useAddressBtn.count();
    console.log('Use Address buttons found:', btnCount);
    
    if (btnCount > 0) {
      // Click the first "Use This Address" button
      await useAddressBtn.first().click();
      
      // Wait for map to update
      await page.waitForTimeout(2000);
      
      // Check for success notification
      const notification = page.locator('.notification.success');
      if (await notification.count() > 0) {
        await expect(notification).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
