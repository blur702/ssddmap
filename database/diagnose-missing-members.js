const fetch = require('node-fetch');

async function diagnoseMissingMembers() {
    console.log('Fetching House JSON to diagnose missing members...');
    
    try {
        const response = await fetch('https://housegovfeeds.house.gov/feeds/Member/json');
        const data = await response.json();
        
        if (!data.members || !data.members.member) {
            throw new Error('Invalid JSON structure');
        }

        const members = Array.isArray(data.members.member) ? 
            data.members.member : [data.members.member];

        console.log(`\nTotal members in feed: ${members.length}`);
        
        // Look for the specific missing districts
        const missingDistricts = ['AZ-7', 'TX-18', 'VA-11'];
        
        console.log('\n=== INVESTIGATING MISSING DISTRICTS ===');
        
        missingDistricts.forEach(targetDistrict => {
            console.log(`\n--- Searching for ${targetDistrict} ---`);
            
            const [state, district] = targetDistrict.split('-');
            
            // Find members in this state
            const stateMembers = members.filter(member => {
                if (!member['member-info']) return false;
                const stateCode = member['member-info'].state?.['postal-code'];
                return stateCode === state;
            });
            
            console.log(`Found ${stateMembers.length} members from ${state}`);
            
            // Look for the specific district
            const districtMember = stateMembers.find(member => {
                if (!member['member-info']) return false;
                const memberDistrict = member['member-info'].district;
                const districtNum = memberDistrict === 'At Large' ? '0' : memberDistrict;
                return districtNum === district;
            });
            
            if (districtMember) {
                console.log(`✓ Found member for ${targetDistrict}:`);
                const info = districtMember['member-info'];
                console.log(`  Name: ${info['official-name'] || info.lastname}`);
                console.log(`  Bioguide: ${info.bioguideID || 'NOT SET'}`);
                console.log(`  Party: ${info.party || info.caucus || 'NOT SET'}`);
                console.log(`  District: ${info.district}`);
                console.log(`  State: ${info.state?.['postal-code']}`);
                
                // Check if there are data quality issues
                if (!info.bioguideID) {
                    console.log(`  ⚠️  WARNING: Missing bioguide ID`);
                }
                if (!info.lastname) {
                    console.log(`  ⚠️  WARNING: Missing last name`);
                }
            } else {
                console.log(`❌ No member found for ${targetDistrict}`);
                console.log(`Available districts in ${state}:`);
                stateMembers.forEach(member => {
                    const info = member['member-info'];
                    const dist = info.district === 'At Large' ? '0' : info.district;
                    console.log(`  ${state}-${dist}: ${info.lastname || 'NO NAME'}`);
                });
            }
        });
        
        // Also check for any members with missing required data
        console.log('\n=== CHECKING FOR DATA QUALITY ISSUES ===');
        
        let membersWithIssues = 0;
        members.forEach((member, index) => {
            if (!member['member-info']) {
                console.log(`Member ${index + 1}: Missing member-info section`);
                membersWithIssues++;
                return;
            }
            
            const info = member['member-info'];
            const issues = [];
            
            if (!info.bioguideID) issues.push('missing bioguide ID');
            if (!info.lastname) issues.push('missing last name');
            if (!info.state?.['postal-code']) issues.push('missing state code');
            if (!info.district) issues.push('missing district');
            
            if (issues.length > 0) {
                const stateCode = info.state?.['postal-code'] || 'UNKNOWN';
                const district = info.district || 'UNKNOWN';
                const name = info.lastname || 'UNKNOWN';
                console.log(`${stateCode}-${district} (${name}): ${issues.join(', ')}`);
                membersWithIssues++;
            }
        });
        
        console.log(`\nTotal members with data issues: ${membersWithIssues}`);
        
        // Count by state to see if we have the expected number
        console.log('\n=== MEMBER COUNT BY STATE ===');
        const stateCounts = {};
        members.forEach(member => {
            if (member['member-info']?.state?.['postal-code']) {
                const state = member['member-info'].state['postal-code'];
                stateCounts[state] = (stateCounts[state] || 0) + 1;
            }
        });
        
        Object.keys(stateCounts).sort().forEach(state => {
            console.log(`${state}: ${stateCounts[state]} members`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the diagnosis
diagnoseMissingMembers();