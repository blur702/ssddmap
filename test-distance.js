#!/usr/bin/env node

// Test script for the distance calculation feature
const fetch = require('node-fetch');

const testLocations = [
    { name: "White House", lat: 38.8977, lon: -77.0365 },
    { name: "Capitol Building", lat: 38.8899, lon: -77.0091 },
    { name: "Golden Gate Bridge", lat: 37.8199, lon: -122.4783 },
    { name: "Times Square NYC", lat: 40.7580, lon: -73.9855 },
    { name: "Miami Beach", lat: 25.7907, lon: -80.1300 }
];

async function testLocation(location) {
    console.log(`\n=== Testing ${location.name} ===`);
    console.log(`Coordinates: ${location.lat}, ${location.lon}`);
    
    try {
        const response = await fetch(`http://localhost:3001/ssddmap/api/find-location?lat=${location.lat}&lon=${location.lon}`);
        const data = await response.json();
        
        if (data.district && data.district.found) {
            console.log(`✓ Found in district: ${data.district.state}-${data.district.district}`);
            if (data.district.distanceToBoundary) {
                console.log(`  Distance to boundary: ${data.district.distanceToBoundary.meters}m (${data.district.distanceToBoundary.miles} mi)`);
            }
            if (data.district.member) {
                console.log(`  Representative: ${data.district.member.name} (${data.district.member.party})`);
            }
        } else if (data.nearestDistrict) {
            console.log(`✗ Not in any district`);
            console.log(`  Nearest district: ${data.nearestDistrict.state}-${data.nearestDistrict.district}`);
            console.log(`  Distance: ${data.nearestDistrict.distance.meters}m (${data.nearestDistrict.distance.miles} mi)`);
        } else {
            console.log(`✗ No district information found`);
        }
        
        if (data.county && data.county.found) {
            console.log(`  County: ${data.county.name}, ${data.county.state}`);
        }
    } catch (error) {
        console.error(`  Error: ${error.message}`);
    }
}

async function runTests() {
    console.log("Testing Distance Calculation Feature");
    console.log("===================================");
    
    for (const location of testLocations) {
        await testLocation(location);
    }
    
    console.log("\n✓ Tests completed");
}

runTests().catch(console.error);