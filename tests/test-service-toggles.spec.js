const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Service Toggle Functionality', () => {
    test('should show/hide columns based on service toggles', async ({ page }) => {
        console.log('Testing service toggle functionality...');
        
        // Navigate to the app
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open address modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Check initial state of toggles
        const uspsToggle = page.locator('#toggleUSPS');
        const censusToggle = page.locator('#toggleCensus');
        const googleToggle = page.locator('#toggleGoogle');
        
        // Check API status
        const uspsStatus = await page.locator('#uspsApiStatus').textContent();
        const censusStatus = await page.locator('#censusApiStatus').textContent();
        const googleStatus = await page.locator('#googleApiStatus').textContent();
        
        console.log('API Status:');
        console.log('- USPS:', uspsStatus);
        console.log('- Census:', censusStatus);
        console.log('- Google:', googleStatus);
        
        // Uncheck all toggles first
        if (await uspsToggle.isChecked()) await uspsToggle.click();
        if (await googleToggle.isChecked()) await googleToggle.click();
        
        // Ensure Census is checked (it's always available)
        if (!await censusToggle.isChecked()) await censusToggle.click();
        
        // Fill form
        await page.locator('#streetAddress').fill('350 5th Avenue');
        await page.locator('#city').fill('New York');
        await page.locator('#state').selectOption('NY');
        await page.locator('#zipCode').fill('10118');
        
        // Validate with only Census
        await page.locator('#validateAddressBtn').click();
        
        // Wait for results
        await page.waitForSelector('#censusResultColumn', { state: 'visible', timeout: 10000 });
        
        // Verify only Census column is visible
        await expect(page.locator('#censusResultColumn')).toBeVisible();
        await expect(page.locator('#uspsResultColumn')).not.toBeVisible();
        await expect(page.locator('#googleResultColumn')).not.toBeVisible();
        
        console.log('✅ Only Census column visible when only Census is enabled');
        
        // Now enable USPS if configured
        if (uspsStatus === 'Ready') {
            await uspsToggle.click();
            
            // Re-validate
            await page.locator('#validateAddressBtn').click();
            await page.waitForTimeout(3000);
            
            // Both columns should be visible now
            await expect(page.locator('#censusResultColumn')).toBeVisible();
            await expect(page.locator('#uspsResultColumn')).toBeVisible();
            
            console.log('✅ Both Census and USPS columns visible when both enabled');
            
            // Check if comparison summary appears
            const comparisonVisible = await page.locator('#comparisonSummary').isVisible();
            console.log('Comparison summary visible:', comparisonVisible);
            
            // Now disable Census
            await censusToggle.click();
            
            // Census column should hide immediately
            await expect(page.locator('#censusResultColumn')).not.toBeVisible();
            await expect(page.locator('#uspsResultColumn')).toBeVisible();
            
            console.log('✅ Census column hidden when toggled off');
        }
    });
    
    test('should only call enabled services', async ({ page }) => {
        console.log('Testing selective service calls...');
        
        // Set up request interception
        const apiCalls = {
            usps: 0,
            census: 0,
            google: 0
        };
        
        page.on('request', request => {
            const url = request.url();
            if (url.includes('/api/validate-address')) {
                const postData = request.postData();
                if (postData) {
                    const data = JSON.parse(postData);
                    if (data.methods) {
                        data.methods.forEach(method => {
                            apiCalls[method]++;
                        });
                    }
                }
            }
        });
        
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Disable all except Census
        const uspsToggle = page.locator('#toggleUSPS');
        const googleToggle = page.locator('#toggleGoogle');
        
        if (await uspsToggle.isChecked()) await uspsToggle.click();
        if (await googleToggle.isChecked()) await googleToggle.click();
        
        // Fill and submit
        await page.locator('#streetAddress').fill('123 Main St');
        await page.locator('#city').fill('Anytown');
        await page.locator('#state').selectOption('CA');
        
        await page.locator('#validateAddressBtn').click();
        await page.waitForTimeout(3000);
        
        console.log('API calls after validation:');
        console.log('- Census:', apiCalls.census);
        console.log('- USPS:', apiCalls.usps);
        console.log('- Google:', apiCalls.google);
        
        // Only Census should have been called
        expect(apiCalls.census).toBeGreaterThan(0);
        expect(apiCalls.usps).toBe(0);
        expect(apiCalls.google).toBe(0);
        
        console.log('✅ Only enabled services were called');
    });
});