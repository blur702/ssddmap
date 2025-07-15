const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kevinalthaus.com/ssddmap';

test.describe('Modular Validation System', () => {
    test('USPS module should work independently', async ({ page }) => {
        console.log('Testing USPS module independence...');
        
        // Test USPS API status
        const statusResponse = await page.request.get(`${BASE_URL}/api/validation-status`);
        const status = await statusResponse.json();
        console.log('USPS Status:', status.usps);
        
        // Test USPS connection
        const testResponse = await page.request.get(`${BASE_URL}/api/test-usps`);
        const testResult = await testResponse.json();
        console.log('USPS Test Result:', testResult);
        
        if (status.usps.configured) {
            // Test USPS validation directly
            const validationResponse = await page.request.post(`${BASE_URL}/api/validate-address`, {
                data: {
                    address: '2131 N Pima Drive, Lake Havasu City, AZ',
                    methods: ['usps']
                }
            });
            
            const result = await validationResponse.json();
            console.log('USPS Validation Result:', JSON.stringify(result.methods.usps, null, 2));
            
            expect(result.methods.usps).toBeDefined();
            expect(result.methods.usps.success).toBe(true);
            expect(result.methods.usps.standardized).toBeDefined();
            expect(result.methods.usps.standardized.zipPlus4).toBeTruthy();
            console.log('✅ USPS module working independently');
        } else {
            console.log('⚠️ USPS not configured, skipping validation test');
        }
    });
    
    test('Census module should work independently', async ({ page }) => {
        console.log('Testing Census module independence...');
        
        // Test Census validation directly
        const validationResponse = await page.request.post(`${BASE_URL}/api/validate-address`, {
            data: {
                address: '350 5th Avenue, New York, NY 10118',
                methods: ['census']
            }
        });
        
        const result = await validationResponse.json();
        console.log('Census Validation Result:', JSON.stringify(result.methods.census, null, 2));
        
        expect(result.methods.census).toBeDefined();
        expect(result.methods.census.success).toBe(true);
        expect(result.methods.census.coordinates).toBeDefined();
        expect(result.methods.census.coordinates.lat).toBeTruthy();
        expect(result.methods.census.coordinates.lon).toBeTruthy();
        console.log('✅ Census module working independently');
    });
    
    test('Multiple modules should work simultaneously', async ({ page }) => {
        console.log('Testing multiple modules together...');
        
        const validationResponse = await page.request.post(`${BASE_URL}/api/validate-address`, {
            data: {
                address: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
                methods: ['census', 'usps']
            }
        });
        
        const result = await validationResponse.json();
        
        // Check Census results
        expect(result.methods.census).toBeDefined();
        console.log('Census success:', result.methods.census.success);
        
        // Check USPS results if configured
        if (result.methods.usps) {
            console.log('USPS success:', result.methods.usps.success);
        }
        
        // Check analysis if multiple methods returned results
        if (result.analysis) {
            console.log('Analysis:', result.analysis);
            expect(result.analysis.consistency).toBeDefined();
        }
        
        console.log('✅ Multiple modules working together');
    });
    
    test('USPS configuration should be preserved', async ({ page }) => {
        console.log('Testing USPS configuration preservation...');
        
        // Navigate to the app
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open configuration modal
        const configBtn = page.locator('#configBtn');
        await configBtn.click();
        
        // Wait for modal
        await page.waitForSelector('#configModal', { state: 'visible' });
        
        // Check USPS fields
        const clientIdField = page.locator('#uspsClientId');
        const clientSecretField = page.locator('#uspsClientSecret');
        
        await expect(clientIdField).toBeVisible();
        await expect(clientSecretField).toBeVisible();
        
        // Check test button
        const testBtn = page.locator('#testUspsBtn');
        await expect(testBtn).toBeVisible();
        
        console.log('✅ USPS configuration UI preserved');
    });
    
    test('Validation modal should use modular system', async ({ page }) => {
        console.log('Testing modal with modular system...');
        
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open address modal
        await page.locator('#addressFormBtn').click();
        await expect(page.locator('#addressModal')).toBeVisible();
        
        // Check API status indicators
        const uspsStatus = await page.locator('#uspsApiStatus').textContent();
        const censusStatus = await page.locator('#censusApiStatus').textContent();
        const googleStatus = await page.locator('#googleApiStatus').textContent();
        
        console.log('API Status in Modal:');
        console.log('- USPS:', uspsStatus);
        console.log('- Census:', censusStatus);
        console.log('- Google:', googleStatus);
        
        // Census should always be ready
        expect(censusStatus).toBe('Ready');
        
        // Fill form and validate with Census only
        const censusToggle = page.locator('#toggleCensus');
        if (!await censusToggle.isChecked()) {
            await censusToggle.click();
        }
        
        // Disable others if enabled
        const uspsToggle = page.locator('#toggleUSPS');
        if (await uspsToggle.isChecked()) {
            await uspsToggle.click();
        }
        
        await page.locator('#streetAddress').fill('123 Main Street');
        await page.locator('#city').fill('Springfield');
        await page.locator('#state').selectOption('IL');
        
        await page.locator('#validateAddressBtn').click();
        
        // Wait for results
        await page.waitForSelector('#censusResultColumn', { state: 'visible', timeout: 10000 });
        
        const censusColumn = page.locator('#censusResultColumn');
        await expect(censusColumn).toBeVisible();
        
        console.log('✅ Modal using modular validation system');
    });
});