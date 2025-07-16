const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Boundary Distance Feature', () => {
    test('should display distance to district boundary after validation', async ({ page }) => {
        console.log('Testing boundary distance visualization...');
        
        // Navigate to the app
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open address modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Fill form with a known address
        await page.locator('#streetAddress').fill('350 5th Avenue');
        await page.locator('#city').fill('New York');
        await page.locator('#state').selectOption('NY');
        await page.locator('#zipCode').fill('10118');
        
        // Enable Census validation (always available)
        const censusToggle = page.locator('#toggleCensus');
        if (!await censusToggle.isChecked()) {
            await censusToggle.click();
        }
        
        // Validate address
        await page.locator('#validateAddressBtn').click();
        
        // Wait for results
        await page.waitForSelector('#censusResultColumn', { state: 'visible', timeout: 10000 });
        
        // Use the result
        const useButton = page.locator('#censusResultColumn button.use-result-btn');
        await expect(useButton).toBeVisible();
        await useButton.click();
        
        // Wait for modal to close and map to update
        await expect(page.locator('#addressModal')).not.toBeVisible();
        await page.waitForTimeout(2000); // Wait for map animation
        
        // Check if boundary line is created
        const boundaryLineExists = await page.evaluate(() => {
            return window.addressModal && window.addressModal.boundaryLine !== null;
        });
        
        console.log('Boundary line created:', boundaryLineExists);
        
        // Check if sidebar shows distance information
        const sidebarActive = await page.locator('#info-sidebar.active').isVisible();
        console.log('Sidebar active:', sidebarActive);
        
        if (sidebarActive) {
            const distanceSection = await page.locator('.boundary-distance-section').isVisible();
            console.log('Distance section visible:', distanceSection);
        }
        
        // Test the API endpoint directly
        const testResponse = await page.request.post(`${BASE_URL}/api/closest-boundary-point`, {
            data: {
                lat: 40.7484,
                lon: -73.9857,
                state: 'NY',
                district: '12'
            }
        });
        
        console.log('API response status:', testResponse.status());
        
        if (testResponse.ok()) {
            const data = await testResponse.json();
            console.log('Closest point data:', JSON.stringify(data, null, 2));
            
            expect(data.success).toBe(true);
            expect(data.closestPoint).toBeDefined();
            expect(data.distance).toBeDefined();
            expect(data.distance.meters).toBeGreaterThan(0);
        }
    });
    
    test('closest-boundary-point API should calculate distances correctly', async ({ page }) => {
        console.log('Testing closest-boundary-point API...');
        
        const testCases = [
            { lat: 40.7484, lon: -73.9857, state: 'NY', district: '12' }, // Empire State Building
            { lat: 38.8977, lon: -77.0365, state: 'DC', district: '0' },  // White House
            { lat: 33.5731, lon: -112.1899, state: 'AZ', district: '3' }  // Phoenix
        ];
        
        for (const testCase of testCases) {
            console.log(`\nTesting ${testCase.state}-${testCase.district}...`);
            
            const response = await page.request.post(`${BASE_URL}/api/closest-boundary-point`, {
                data: testCase
            });
            
            expect(response.ok()).toBe(true);
            const data = await response.json();
            
            expect(data.success).toBe(true);
            expect(data.closestPoint).toBeDefined();
            expect(data.closestPoint.lat).toBeDefined();
            expect(data.closestPoint.lon).toBeDefined();
            
            expect(data.distance).toBeDefined();
            expect(data.distance.meters).toBeGreaterThan(0);
            expect(data.distance.kilometers).toBe(data.distance.meters / 1000);
            expect(data.distance.miles).toBeCloseTo(data.distance.meters * 0.000621371, 5);
            expect(data.distance.feet).toBeCloseTo(data.distance.meters * 3.28084, 2);
            
            console.log(`Distance: ${data.distance.meters.toFixed(0)}m (${data.distance.miles.toFixed(2)} miles)`);
            console.log(`Closest point: ${data.closestPoint.lat.toFixed(6)}, ${data.closestPoint.lon.toFixed(6)}`);
        }
    });
});