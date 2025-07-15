/**
 * Playwright E2E tests for Congressional Districts Map
 */
const { test, expect } = require('@playwright/test');

test.describe('Congressional Districts Map', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://kevinalthaus.com/ssddmap/');
        
        // Wait for the map to load
        await page.waitForSelector('#map', { timeout: 10000 });
        await page.waitForTimeout(2000); // Give map time to render
    });
    
    test('should load the page with all required elements', async ({ page }) => {
        // Check toolbar
        await expect(page.locator('#toolbar')).toBeVisible();
        await expect(page.locator('.app-title')).toHaveText('Congressional Districts');
        
        // Check search box
        await expect(page.locator('#addressInput')).toBeVisible();
        await expect(page.locator('#searchBtn')).toBeVisible();
        
        // Check selectors
        await expect(page.locator('#stateSelect')).toBeVisible();
        await expect(page.locator('#mapStyle')).toBeVisible();
        
        // Check toggle switches
        await expect(page.locator('#autosuggestToggle')).toBeVisible();
        await expect(page.locator('#toggleRepView')).toBeVisible();
        
        // Check buttons
        await expect(page.locator('#viewUSA')).toBeVisible();
        await expect(page.locator('#dataManageBtn')).toBeVisible();
        await expect(page.locator('#configBtn')).toBeVisible();
        
        // Check map container
        await expect(page.locator('#map')).toBeVisible();
        
        // Check legend
        await expect(page.locator('.party-legend')).toBeVisible();
    });
    
    test('should display map tiles', async ({ page }) => {
        // Check if Leaflet map is initialized
        const mapHasTiles = await page.evaluate(() => {
            const mapElement = document.querySelector('#map');
            return mapElement && mapElement.querySelector('.leaflet-tile-container img') !== null;
        });
        
        expect(mapHasTiles).toBeTruthy();
    });
    
    test('should change map style', async ({ page }) => {
        // Select dark style
        await page.selectOption('#mapStyle', 'dark');
        await page.waitForTimeout(1000);
        
        // Check if tiles changed
        const hasDarkTiles = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile-container img');
            return Array.from(tiles).some(img => img.src.includes('dark'));
        });
        
        expect(hasDarkTiles).toBeTruthy();
    });
    
    test('should perform address search', async ({ page }) => {
        // Type an address
        await page.fill('#addressInput', '1600 Pennsylvania Avenue Washington DC');
        
        // Wait for autosuggest results
        await page.waitForSelector('.search-results', { state: 'visible', timeout: 5000 });
        
        // Check if results appear
        const resultsCount = await page.locator('.search-result').count();
        expect(resultsCount).toBeGreaterThan(0);
        
        // Click first result
        await page.locator('.search-result').first().click();
        
        // Check if map moved (by checking for a marker)
        await page.waitForTimeout(2000);
        const hasMarker = await page.evaluate(() => {
            return document.querySelector('.leaflet-marker-icon') !== null;
        });
        
        expect(hasMarker).toBeTruthy();
    });
    
    test('should toggle autosuggest', async ({ page }) => {
        // Turn off autosuggest
        await page.click('#autosuggestToggle');
        
        // Type in search box
        await page.fill('#addressInput', 'New York');
        await page.waitForTimeout(1000);
        
        // Results should not appear
        const resultsVisible = await page.locator('.search-results').isVisible();
        expect(resultsVisible).toBeFalsy();
        
        // Turn autosuggest back on
        await page.click('#autosuggestToggle');
        
        // Clear and type again
        await page.fill('#addressInput', '');
        await page.fill('#addressInput', 'New York');
        await page.waitForSelector('.search-results', { state: 'visible' });
        
        const resultsVisibleAfter = await page.locator('.search-results').isVisible();
        expect(resultsVisibleAfter).toBeTruthy();
    });
    
    test('should open data management modal', async ({ page }) => {
        await page.click('#dataManageBtn');
        
        // Check modal is visible
        await expect(page.locator('#dataModal')).toBeVisible();
        await expect(page.locator('#dataModal h3')).toHaveText('Data Management');
        
        // Check cache status is shown
        await expect(page.locator('#cacheStatus')).toBeVisible();
        
        // Close modal
        await page.click('#dataModal .close');
        await expect(page.locator('#dataModal')).not.toBeVisible();
    });
    
    test('should open configuration modal', async ({ page }) => {
        await page.click('#configBtn');
        
        // Check modal is visible
        await expect(page.locator('#configModal')).toBeVisible();
        await expect(page.locator('#configModal h3')).toHaveText('API Configuration');
        
        // Check configuration options
        await expect(page.locator('input[value="census"]')).toBeVisible();
        await expect(page.locator('#uspsClientId')).toBeVisible();
        await expect(page.locator('#smartyAuthId')).toBeVisible();
        
        // Close modal
        await page.click('#configModal .close').first();
        await expect(page.locator('#configModal')).not.toBeVisible();
    });
    
    test('should select state and load districts', async ({ page }) => {
        // Select California
        await page.selectOption('#stateSelect', 'CA');
        await page.waitForTimeout(3000);
        
        // Check if districts are loaded
        const hasDistricts = await page.evaluate(() => {
            const paths = document.querySelectorAll('.leaflet-interactive');
            return paths.length > 0;
        });
        
        expect(hasDistricts).toBeTruthy();
    });
    
    test('should click district and show sidebar', async ({ page }) => {
        // First load a state
        await page.selectOption('#stateSelect', 'CA');
        await page.waitForTimeout(3000);
        
        // Click on a district
        const district = await page.locator('.leaflet-interactive').first();
        if (await district.isVisible()) {
            await district.click();
            
            // Check if sidebar opens
            await page.waitForTimeout(1000);
            const sidebarActive = await page.evaluate(() => {
                const sidebar = document.querySelector('#info-sidebar');
                return sidebar && sidebar.classList.contains('active');
            });
            
            expect(sidebarActive).toBeTruthy();
            
            // Close sidebar
            await page.click('#closeSidebar');
            await page.waitForTimeout(500);
            
            const sidebarClosed = await page.evaluate(() => {
                const sidebar = document.querySelector('#info-sidebar');
                return sidebar && !sidebar.classList.contains('active');
            });
            
            expect(sidebarClosed).toBeTruthy();
        }
    });
    
    test('should toggle representative view', async ({ page }) => {
        // Load all districts first
        await page.waitForTimeout(3000);
        
        // Toggle rep view
        await page.click('#toggleRepView');
        await page.waitForTimeout(2000);
        
        // Check if districts have party colors
        const hasPartyColors = await page.evaluate(() => {
            const paths = document.querySelectorAll('.leaflet-interactive');
            return Array.from(paths).some(path => {
                const fill = path.getAttribute('fill');
                return fill && (fill.includes('#3b82f6') || fill.includes('#ef4444'));
            });
        });
        
        expect(hasPartyColors).toBeTruthy();
    });
    
    test('should view full USA', async ({ page }) => {
        // First select a state to zoom in
        await page.selectOption('#stateSelect', 'CA');
        await page.waitForTimeout(2000);
        
        // Click View USA button
        await page.click('#viewUSA');
        await page.waitForTimeout(1000);
        
        // Check if state selector is reset
        const stateValue = await page.locator('#stateSelect').inputValue();
        expect(stateValue).toBe('');
        
        // Check if map zoomed out (by checking zoom level)
        const zoomLevel = await page.evaluate(() => {
            return window.congressApp?.map?.getMap()?.getZoom() || 0;
        });
        
        expect(zoomLevel).toBeLessThanOrEqual(5);
    });
    
    test('should handle keyboard navigation in search', async ({ page }) => {
        // Type to trigger suggestions
        await page.fill('#addressInput', 'Los Angeles');
        await page.waitForSelector('.search-results', { state: 'visible' });
        
        // Press arrow down
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);
        
        // Check if first result is selected
        const firstSelected = await page.evaluate(() => {
            const firstResult = document.querySelector('.search-result');
            return firstResult && firstResult.classList.contains('selected');
        });
        
        expect(firstSelected).toBeTruthy();
        
        // Press Enter to select
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Results should be hidden
        const resultsHidden = await page.locator('.search-results').isHidden();
        expect(resultsHidden).toBeTruthy();
    });
    
    test('should not have console errors', async ({ page }) => {
        const consoleErrors = [];
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        
        // Reload page to catch all errors
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Filter out expected warnings
        const criticalErrors = consoleErrors.filter(error => 
            !error.includes('Deprecation') && 
            !error.includes('favicon.ico')
        );
        
        expect(criticalErrors).toHaveLength(0);
    });
});