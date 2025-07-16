// Test script to verify eventBus is working
// Run this in the browser console after the app loads

function testEventBus() {
    console.log('🔍 Testing eventBus functionality...');
    
    // Check if app exists
    if (!window.modularApp) {
        console.error('❌ modularApp not found');
        return;
    }
    
    // Check if districtInfoModule exists
    if (!window.modularApp.districtInfoModule) {
        console.error('❌ districtInfoModule not found');
        return;
    }
    
    const module = window.modularApp.districtInfoModule;
    
    // Check if eventBus is available
    if (!module.eventBus) {
        console.error('❌ eventBus not found in districtInfoModule');
        return;
    }
    
    console.log('✅ eventBus found in districtInfoModule');
    
    // Check if currentDistrictKey is set
    if (!module.currentDistrictKey) {
        console.warn('⚠️ currentDistrictKey not set - click on a district first');
        return;
    }
    
    console.log('✅ currentDistrictKey:', module.currentDistrictKey);
    
    // Test the focusOnMap method
    console.log('🧪 Testing focusOnMap method...');
    
    // Listen for the event
    let eventReceived = false;
    module.eventBus.on('centerOnDistrict', (data) => {
        console.log('✅ centerOnDistrict event received:', data);
        eventReceived = true;
    });
    
    // Call focusOnMap
    module.focusOnMap();
    
    // Check if event was received
    setTimeout(() => {
        if (eventReceived) {
            console.log('✅ Event test passed!');
        } else {
            console.error('❌ Event test failed - no event received');
        }
    }, 100);
}

// Make it available globally
window.testEventBus = testEventBus;

console.log('Test script loaded. Run testEventBus() to test the View on Map functionality.');