// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('JavaScript Error Debugging', () => {
  test('capture and debug JavaScript errors', async ({ page }) => {
    const errors = [];
    const logs = [];
    
    // Capture all console messages
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args()
      };
      
      logs.push(logEntry);
      
      if (msg.type() === 'error') {
        errors.push(logEntry);
      }
    });
    
    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      errors.push({
        type: 'pageerror',
        message: err.message,
        stack: err.stack,
      });
    });
    
    // Navigate to the application
    await page.goto('https://kevinalthaus.com/ssddmap/');
    
    // Wait a bit to collect all errors
    await page.waitForTimeout(5000);
    
    // Log all console messages
    console.log('\n=== ALL CONSOLE LOGS ===');
    logs.forEach((log, index) => {
      console.log(`\nLog ${index + 1} [${log.type}]:`);
      console.log('Text:', log.text);
      if (log.location) {
        console.log('Location:', log.location);
      }
    });
    
    // Log all errors
    console.log('\n=== ERRORS FOUND ===');
    errors.forEach((error, index) => {
      console.log(`\nError ${index + 1}:`);
      console.log(error);
    });
    
    // Check network requests
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure(),
      });
    });
    
    // Try to get more specific error information
    const pageErrors = await page.evaluate(() => {
      return {
        hasErrors: window.errors || [],
        documentReady: document.readyState,
        mapElement: document.getElementById('map') !== null,
        scriptsLoaded: {
          leaflet: typeof L !== 'undefined',
          app: typeof window.initializeApp !== 'undefined' || typeof window.app !== 'undefined'
        }
      };
    });
    
    console.log('\n=== PAGE STATE ===');
    console.log(pageErrors);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    
    // The test doesn't fail, just reports findings
    console.log(`\nTotal errors found: ${errors.length}`);
  });
});