const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Enhanced Address Validation Modal', () => {
    test('should display enhanced modal with API toggles', async ({ page }) => {
        console.log('1. Navigating to application...');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        console.log('2. Opening address modal...');
        const addressBtn = page.locator('#addressFormBtn');
        await expect(addressBtn).toBeVisible();
        await addressBtn.click();
        
        console.log('3. Checking modal structure...');
        const modal = page.locator('#addressModal');
        await expect(modal).toBeVisible();
        
        // Check modal title
        await expect(modal.locator('.modal-header h2')).toHaveText('Address Validation & District Lookup');
        
        console.log('4. Checking API toggles...');
        // Check all three API toggles are present
        const uspsToggle = page.locator('#toggleUSPS');
        const censusToggle = page.locator('#toggleCensus');
        const googleToggle = page.locator('#toggleGoogle');
        
        await expect(uspsToggle).toBeVisible();
        await expect(censusToggle).toBeVisible();
        await expect(googleToggle).toBeVisible();
        
        // Check default states
        const uspsStatus = page.locator('#uspsApiStatus');
        const censusStatus = page.locator('#censusApiStatus');
        const googleStatus = page.locator('#googleApiStatus');
        
        // Census should always be ready
        await expect(censusStatus).toHaveText('Ready');
        await expect(censusStatus).toHaveClass(/ready/);
        
        // USPS should be ready (we know it's configured)
        await expect(uspsStatus).toHaveText('Ready');
        
        // Google is likely not configured
        const googleStatusText = await googleStatus.textContent();
        console.log(`Google API status: ${googleStatusText}`);
        
        console.log('✅ Modal structure test passed!');
    });
    
    test('should validate with Census API only', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        console.log('1. Disabling USPS, enabling only Census...');
        // Uncheck USPS if checked
        const uspsToggle = page.locator('#toggleUSPS');
        if (await uspsToggle.isChecked()) {
            await uspsToggle.click();
        }
        
        // Ensure Census is checked
        const censusToggle = page.locator('#toggleCensus');
        if (!await censusToggle.isChecked()) {
            await censusToggle.click();
        }
        
        // Ensure Google is unchecked
        const googleToggle = page.locator('#toggleGoogle');
        if (await googleToggle.isChecked()) {
            await googleToggle.click();
        }
        
        console.log('2. Filling form...');
        await page.locator('#streetAddress').fill('1600 Pennsylvania Avenue NW');
        await page.locator('#city').fill('Washington');
        await page.locator('#state').selectOption('DC');
        await page.locator('#zipCode').fill('20500');
        
        console.log('3. Submitting for validation...');
        await page.locator('#validateAddressBtn').click();
        
        console.log('4. Waiting for results...');
        // Wait for results container
        await page.waitForSelector('#validationResultsContainer', { state: 'visible', timeout: 10000 });
        
        // Check that only Census column is shown
        const censusColumn = page.locator('#censusResultColumn');
        const uspsColumn = page.locator('#uspsResultColumn');
        const googleColumn = page.locator('#googleResultColumn');
        
        await expect(censusColumn).toBeVisible();
        await expect(uspsColumn).not.toBeVisible();
        await expect(googleColumn).not.toBeVisible();
        
        // Check Census results
        const censusStatus = page.locator('#censusResultStatus');
        await expect(censusStatus).toHaveText('Success');
        
        // Check for district
        const districtValue = censusColumn.locator('.district-value');
        await expect(districtValue).toBeVisible();
        const district = await districtValue.textContent();
        console.log(`Found district: ${district}`);
        expect(district).toMatch(/DC-\d+/);
        
        console.log('✅ Census-only validation test passed!');
    });
    
    test('should validate with multiple APIs and show comparison', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        console.log('1. Enabling USPS and Census...');
        // Ensure USPS is checked (if available)
        const uspsToggle = page.locator('#toggleUSPS');
        const uspsStatus = await page.locator('#uspsApiStatus').textContent();
        if (uspsStatus === 'Ready' && !await uspsToggle.isChecked()) {
            await uspsToggle.click();
        }
        
        // Ensure Census is checked
        const censusToggle = page.locator('#toggleCensus');
        if (!await censusToggle.isChecked()) {
            await censusToggle.click();
        }
        
        console.log('2. Filling form with known address...');
        await page.locator('#streetAddress').fill('2131 N Pima Drive');
        await page.locator('#city').fill('Lake Havasu City');
        await page.locator('#state').selectOption('AZ');
        await page.locator('#zipCode').fill('86403');
        
        console.log('3. Submitting for validation...');
        await page.locator('#validateAddressBtn').click();
        
        console.log('4. Waiting for results...');
        await page.waitForSelector('#validationResultsContainer', { state: 'visible', timeout: 15000 });
        
        // Check both columns are shown if USPS is configured
        const censusColumn = page.locator('#censusResultColumn');
        await expect(censusColumn).toBeVisible();
        
        if (uspsStatus === 'Ready') {
            const uspsColumn = page.locator('#uspsResultColumn');
            await expect(uspsColumn).toBeVisible();
            
            // Check for comparison summary
            const comparisonSummary = page.locator('#comparisonSummary');
            await expect(comparisonSummary).toBeVisible();
            
            // Check comparison content
            const comparisonContent = page.locator('#comparisonContent');
            const comparisonText = await comparisonContent.textContent();
            console.log('Comparison results:', comparisonText);
            
            // Should show district agreement or mismatch
            expect(comparisonText).toContain('district');
        }
        
        console.log('✅ Multi-API validation test passed!');
    });
    
    test('should handle API toggle changes dynamically', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        console.log('1. Testing with no APIs enabled...');
        // Disable all APIs
        const uspsToggle = page.locator('#toggleUSPS');
        const censusToggle = page.locator('#toggleCensus');
        const googleToggle = page.locator('#toggleGoogle');
        
        if (await uspsToggle.isChecked()) await uspsToggle.click();
        if (await censusToggle.isChecked()) await censusToggle.click();
        if (await googleToggle.isChecked()) await googleToggle.click();
        
        // Fill minimal form
        await page.locator('#streetAddress').fill('123 Main St');
        await page.locator('#city').fill('Anytown');
        await page.locator('#state').selectOption('CA');
        
        // Try to submit
        await page.locator('#validateAddressBtn').click();
        
        // Should show error notification
        await page.waitForSelector('.notification', { timeout: 5000 });
        const notification = page.locator('.notification');
        await expect(notification).toContainText('at least one validation service');
        
        console.log('✅ API toggle validation test passed!');
    });
    
    test('should use address result and display on map', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Enable only Census for faster results
        const uspsToggle = page.locator('#toggleUSPS');
        if (await uspsToggle.isChecked()) await uspsToggle.click();
        
        console.log('1. Validating address...');
        await page.locator('#streetAddress').fill('350 5th Avenue');
        await page.locator('#city').fill('New York');
        await page.locator('#state').selectOption('NY');
        await page.locator('#zipCode').fill('10118');
        
        await page.locator('#validateAddressBtn').click();
        
        console.log('2. Waiting for results...');
        await page.waitForSelector('.use-result-btn', { timeout: 10000 });
        
        console.log('3. Using validated address...');
        const useBtn = page.locator('.use-result-btn').first();
        await useBtn.click();
        
        // Modal should close
        await expect(page.locator('#addressModal')).not.toBeVisible();
        
        // Check for success notification
        await page.waitForSelector('.notification.success', { timeout: 5000 });
        const successNotification = page.locator('.notification.success');
        await expect(successNotification).toContainText('Address validated and displayed on map');
        
        // Check for marker on map
        await page.waitForSelector('.leaflet-marker-icon', { timeout: 5000 });
        const markers = page.locator('.leaflet-marker-icon');
        const markerCount = await markers.count();
        console.log(`Found ${markerCount} marker(s) on map`);
        expect(markerCount).toBeGreaterThan(0);
        
        console.log('✅ Use address test passed!');
    });
    
    test('should display standardized USPS address with ZIP+4', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal
        await page.locator('#addressFormBtn').click();
        
        // Check if USPS is available
        const uspsStatus = await page.locator('#uspsApiStatus').textContent();
        if (uspsStatus !== 'Ready') {
            console.log('USPS not configured, skipping test');
            return;
        }
        
        console.log('1. Validating with USPS...');
        await page.locator('#streetAddress').fill('2131 n pima dr');
        await page.locator('#city').fill('lake havasu city');
        await page.locator('#state').selectOption('AZ');
        
        await page.locator('#validateAddressBtn').click();
        
        console.log('2. Checking USPS results...');
        await page.waitForSelector('#uspsResultColumn', { state: 'visible', timeout: 10000 });
        
        const uspsContent = page.locator('#uspsResultContent');
        const addressText = await uspsContent.locator('.result-address').textContent();
        console.log('USPS standardized address:', addressText);
        
        // Check for proper standardization
        expect(addressText).toContain('2131');
        expect(addressText).toContain('PIMA');
        expect(addressText).toContain('DR');
        expect(addressText).toContain('AZ');
        expect(addressText).toMatch(/86403-\d{4}/); // ZIP+4 format
        
        console.log('✅ USPS standardization test passed!');
    });
    
    test('should clear results when requested', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open modal and validate
        await page.locator('#addressFormBtn').click();
        await page.locator('#streetAddress').fill('123 Main St');
        await page.locator('#city').fill('Springfield');
        await page.locator('#state').selectOption('IL');
        await page.locator('#validateAddressBtn').click();
        
        // Wait for results
        await page.waitForSelector('#validationResultsContainer', { state: 'visible' });
        
        console.log('1. Clearing results...');
        await page.locator('#clearResultsBtn').click();
        
        // Results container should be hidden
        await expect(page.locator('#validationResultsContainer')).not.toBeVisible();
        
        // Form should still be visible
        await expect(page.locator('#addressForm')).toBeVisible();
        
        console.log('✅ Clear results test passed!');
    });
});