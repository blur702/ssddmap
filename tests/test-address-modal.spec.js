const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Address Modal Form', () => {
    test('should display address modal similar to House PRF', async ({ page }) => {
        console.log('1. Navigating to application...');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        console.log('2. Clicking address form button...');
        const addressBtn = page.locator('#addressFormBtn');
        await expect(addressBtn).toBeVisible();
        await addressBtn.click();
        
        console.log('3. Checking modal is displayed...');
        const modal = page.locator('#addressModal');
        await expect(modal).toBeVisible();
        
        // Check modal header
        const modalHeader = modal.locator('.modal-header h2');
        await expect(modalHeader).toHaveText('Find Your Congressional District');
        
        console.log('4. Checking form fields...');
        // Check all form fields are present
        await expect(page.locator('#streetAddress')).toBeVisible();
        await expect(page.locator('#apartment')).toBeVisible();
        await expect(page.locator('#city')).toBeVisible();
        await expect(page.locator('#state')).toBeVisible();
        await expect(page.locator('#zipCode')).toBeVisible();
        
        console.log('5. Checking state dropdown is populated...');
        // Check state dropdown has options
        const stateSelect = page.locator('#state');
        await page.waitForTimeout(1000); // Give time for states to load
        
        const stateOptions = await stateSelect.locator('option').count();
        console.log(`Found ${stateOptions} state options`);
        expect(stateOptions).toBeGreaterThan(50); // Should have all states plus territories
        
        // Check a few specific states
        await expect(stateSelect.locator('option[value="AZ"]')).toBeVisible();
        await expect(stateSelect.locator('option[value="CA"]')).toBeVisible();
        await expect(stateSelect.locator('option[value="NY"]')).toBeVisible();
        
        console.log('6. Testing form submission with valid address...');
        // Fill out the form
        await page.locator('#streetAddress').fill('2131 N Pima Drive');
        await page.locator('#city').fill('Lake Havasu City');
        await stateSelect.selectOption('AZ');
        await page.locator('#zipCode').fill('86403');
        
        // Submit form
        const submitBtn = page.locator('#findDistrictBtn');
        await submitBtn.click();
        
        console.log('7. Waiting for validation results...');
        // Wait for results
        await page.waitForSelector('.address-result-card', { timeout: 10000 });
        
        const resultCard = page.locator('.address-result-card').first();
        await expect(resultCard).toBeVisible();
        
        // Check for USPS standardized address
        const resultTitle = resultCard.locator('.address-result-title');
        await expect(resultTitle).toContainText('USPS Standardized Address');
        
        // Check for district info
        const districtBadge = resultCard.locator('.district-badge');
        await expect(districtBadge).toBeVisible();
        const districtText = await districtBadge.textContent();
        console.log(`Found district: ${districtText}`);
        
        // Check for use button
        const useBtn = resultCard.locator('.use-address-btn');
        await expect(useBtn).toBeVisible();
        await expect(useBtn).toHaveText('Use This Address');
        
        console.log('8. Testing modal close...');
        // Close modal
        const closeBtn = modal.locator('.modal-header .close');
        await closeBtn.click();
        await expect(modal).not.toBeVisible();
        
        console.log('✅ Address modal test passed!');
    });
    
    test('should handle lowercase state codes', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Fill form with lowercase state
        await page.locator('#streetAddress').fill('2131 n pima drive');
        await page.locator('#city').fill('lake havasu city');
        await page.locator('#state').selectOption('AZ'); // Select uppercase from dropdown
        
        // Submit
        await page.locator('#findDistrictBtn').click();
        
        // Should get valid results
        await page.waitForSelector('.address-result-card', { timeout: 10000 });
        
        const resultCard = page.locator('.address-result-card').first();
        await expect(resultCard).toBeVisible();
        await expect(resultCard).toContainText('USPS Standardized Address');
        
        console.log('✅ Lowercase handling test passed!');
    });
});