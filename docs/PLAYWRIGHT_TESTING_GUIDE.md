# Playwright Testing Guide for SSDD Congressional Districts Map

## 📍 **Centralized Playwright Installation**

**IMPORTANT**: This application uses a **centralized Playwright installation** at `pw.kevinalthaus.com` for testing. Do NOT install Playwright locally in this app.

### **Test Suite Location**
```
/var/www/pw.kevinalthaus.com/ssdd-tests/
```

### **Nginx Configuration Reference**
- **Web Access**: https://pw.kevinalthaus.com/tests/ (test results browser)
- **Local Path**: `/var/www/pw.kevinalthaus.com/ssdd-tests/`
- **Main App**: Tests target `https://kevinalthaus.com/ssddmap/`

## 🚀 **Setup for New Claude Code Instances**

### **1. Navigate to Centralized Test Directory**
```bash
cd /var/www/pw.kevinalthaus.com/ssdd-tests/
```

### **2. Verify Playwright Installation (Already Installed)**
```bash
# Check if Playwright is available
npx playwright --version

# If missing dependencies (rarely needed):
npm install
```

**Note**: Playwright browsers and dependencies are pre-installed on the pw.kevinalthaus.com server. No additional installation should be required.

## 🧪 **Running Tests**

### **All Tests**
```bash
npx playwright test --reporter=line
```

### **Specific Test Files**
```bash
# USPS + AI workflow test
npx playwright test tests/usps-ai-workflow-test.spec.js --project=chromium

# Critical functionality test
npx playwright test tests/critical-functionality-test.spec.js --project=chromium

# Debug address search
npx playwright test tests/debug-address-search.spec.js --project=chromium
```

### **Specific Browsers**
```bash
# Chrome only
npx playwright test --project=chromium

# Firefox only  
npx playwright test --project=firefox

# All browsers
npx playwright test
```

### **With Increased Timeout (for USPS + AI tests)**
```bash
npx playwright test tests/usps-ai-workflow-test.spec.js --project=chromium --timeout=60000
```

## 📊 **Test Files Overview**

### **1. usps-ai-workflow-test.spec.js**
- **Purpose**: Tests the complete USPS + Gemini AI address resolution workflow
- **What it tests**:
  - Module loading (AddressResolutionModule, BoundaryDistanceModule)
  - USPS validation attempts
  - Gemini AI correction functionality
  - Fallback to Census geocoder
  - Sidebar display with district information
- **Expected behavior**: Should show modules working, USPS attempts, AI corrections, and final results

### **2. critical-functionality-test.spec.js**
- **Purpose**: Verifies core application functionality
- **What it tests**:
  - Modular app initialization
  - Address search with sidebar display
  - District information display
  - Basic error handling
- **Expected behavior**: Should show district info automatically in sidebar

### **3. debug-address-search.spec.js**
- **Purpose**: Detailed debugging and content inspection
- **What it tests**:
  - Full sidebar content capture
  - Search result analysis
  - Boundary result verification
- **Expected behavior**: Provides detailed output for troubleshooting

## 🔍 **Test Execution Examples**

### **Successful USPS + AI Workflow Output**
```
🧪 Testing USPS + AI address resolution workflow...
🏗️ Modular app loaded: true
🤖 Address resolution module loaded: true
🔍 Search manager has resolution module: true
📍 Current search method: usps_ai
🔎 Testing address search with USPS + AI...
📋 Sidebar opened after search: true
📝 Sidebar has content: true
🤖 Shows USPS + AI Resolution: true
📮 Shows ZIP+4: true
✅ Shows USPS Standardized: true
🏛️ Shows district info: true
✅ USPS + AI workflow test completed
```

### **Fallback to Census (when USPS fails)**
```
📮 USPS error: Error: USPS API error: 500
❌ USPS failed, trying Gemini AI corrections...
🤖 Gemini correction attempt 1/3
🤖 Gemini response: {correctedAddress: "123 Main Street, Richmond, VA 23220"}
📮 Trying USPS with address: 123 Main Street, Richmond, VA 23220
❌ All resolution attempts failed
USPS + AI resolution failed, falling back to Census
🏛️ Used Census fallback: true
```

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **1. "Cannot find module" errors**
```bash
# Solution: Ensure you're in the centralized test directory
cd /var/www/pw.kevinalthaus.com/ssdd-tests/
npm install  # Only if dependencies are missing
```

#### **2. "browserType.launch: executable doesn't exist" errors**
```bash
# This should NOT happen - Playwright is pre-installed
# If it occurs, check that you're in the correct directory:
cd /var/www/pw.kevinalthaus.com/ssdd-tests/
npx playwright --version
```

#### **3. Tests timeout waiting for elements**
```bash
# Solution: Increase timeout
npx playwright test --timeout=60000
```

#### **4. X11/Display errors (headless mode)**
```bash
# These are normal in headless environments and don't affect test results
# Tests run in headless mode by default
```

### **Debugging Failed Tests**

#### **View Test Reports**
```bash
npx playwright show-report
```

#### **Run with Debug Mode**
```bash
npx playwright test --debug
```

#### **Run Single Test with Full Output**
```bash
npx playwright test tests/debug-address-search.spec.js --project=chromium --reporter=line
```

## 📈 **Expected Test Results**

### **USPS + AI Workflow Test**
- ✅ All modules should load successfully
- ✅ USPS validation should be attempted
- ✅ Gemini AI should provide corrections when USPS fails
- ✅ Census fallback should work when all else fails
- ✅ Sidebar should display district information
- ✅ Final result should always show district info

### **Critical Functionality Test**
- ✅ Modular app should initialize
- ✅ Address search should open sidebar
- ✅ District information should display automatically
- ✅ Boundary distance should show (when available)

## 🎯 **Testing Specific Features**

### **Test Address Search with Real District**
Use addresses in actual congressional districts:
```javascript
// Good test addresses:
'1234 Main St, Richmond, VA'     // VA-4
'123 Oak St, Albany, NY'         // NY district
'456 First St, Phoenix, AZ'      // AZ district
```

### **Test Address Search with DC (No District)**
Use Washington DC addresses:
```javascript
// Should show "District information not available":
'1600 Pennsylvania Ave NW, Washington DC'
```

### **Test USPS + AI Corrections**
Use intentionally problematic addresses:
```javascript
// Missing comma, should trigger AI correction:
'123 Main Street Richmond VA'
```

## 📝 **Writing New Tests**

### **Basic Test Structure**
```javascript
const { test, expect } = require('@playwright/test');

test.describe('My Test Suite', () => {
  test('should test specific functionality', async ({ page }) => {
    // Navigate to app
    await page.goto('https://kevinalthaus.com/ssddmap/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Test functionality
    await page.fill('#addressInput', 'test address');
    await page.click('#searchBtn');
    await page.waitForTimeout(3000);
    
    // Verify results
    const sidebarActive = await page.locator('#info-sidebar.active').isVisible();
    expect(sidebarActive).toBe(true);
  });
});
```

### **Checking Module Status**
```javascript
// Check if modules are loaded
const hasModules = await page.evaluate(() => {
  return {
    modularApp: !!window.modularApp,
    addressSearchModule: !!window.modularApp?.addressSearchModule,
    boundaryDistanceModule: !!window.modularApp?.boundaryDistanceModule,
    addressResolutionModule: !!window.modularApp?.addressResolutionModule
  };
});
```

## 🚨 **Critical Testing Notes**

### **For New Claude Code Instances**
1. **Navigate to centralized test directory** `/var/www/pw.kevinalthaus.com/ssdd-tests/`
2. **DO NOT install Playwright locally** - use the pre-installed centralized installation
3. **Use increased timeouts** for USPS + AI tests (they take 5-10 seconds)
4. **Check console output** - workflow provides detailed logging
5. **Test with real addresses** - Use addresses in actual congressional districts
6. **Verify fallback behavior** - System should always provide results

### **Test Environment**
- **URL**: `https://kevinalthaus.com/ssddmap/`
- **Network**: Tests run against live application
- **Data**: Uses real USPS API and Gemini AI
- **Fallback**: Census geocoder always available

---

**🎯 Running these tests verifies the complete USPS + AI address resolution system is working correctly!**