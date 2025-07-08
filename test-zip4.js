const AddressService = require('./services/addressService');
const config = require('./config');

async function testZip4Integration() {
    console.log('Testing ZIP+4 Integration...\n');
    
    const addressService = new AddressService(config);
    
    // Test address
    const testAddress = {
        street: '1600 Pennsylvania Avenue NW',
        city: 'Washington',
        state: 'DC',
        zip: '20500'
    };
    
    console.log('Test Address:', testAddress);
    console.log('\nTesting different lookup methods:\n');
    
    // Test 1: USPS Standardization
    console.log('1. USPS Standardization:');
    const uspsResult = await addressService.standardizeUSPS(testAddress);
    console.log(uspsResult);
    
    // Test 2: Smarty Lookup
    console.log('\n2. Smarty District Lookup:');
    const smartyResult = await addressService.lookupDistrictSmarty(testAddress);
    console.log(smartyResult);
    
    // Test 3: Local Database
    console.log('\n3. Local Database Lookup:');
    await addressService.initDatabase();
    const dbResult = await addressService.lookupDistrictFromZip4('20500', '0001');
    console.log(dbResult || { success: false, error: 'No data in local database' });
    
    // Test 4: Combined lookup
    console.log('\n4. Combined Lookup (smarty method):');
    const combinedResult = await addressService.lookupDistrict(testAddress, 'smarty');
    console.log(combinedResult);
    
    process.exit(0);
}

testZip4Integration().catch(console.error);