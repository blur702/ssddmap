const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ssddmap',
    user: process.env.DB_USER || 'ssddmap_user',
    password: process.env.DB_PASSWORD || 'ssddmap123'
});

// Import committees and member assignments from JSON
async function importCommitteesFromJSON() {
    console.log('Fetching member data from House.gov JSON feed...');
    
    try {
        const response = await fetch('https://housegovfeeds.house.gov/feeds/Member/json');
        const data = await response.json();
        
        if (!data.members || !data.members.member) {
            throw new Error('Invalid JSON structure');
        }
        
        const members = Array.isArray(data.members.member) ? 
            data.members.member : [data.members.member];
        
        console.log(`Found ${members.length} members`);
        
        // Track unique committees
        const committees = new Map();
        let memberCount = 0;
        let assignmentCount = 0;
        
        for (const member of members) {
            if (!member['member-info'] || !member['member-info'].bioguideID) continue;
            
            const memberInfo = member['member-info'];
            const bioguideID = memberInfo.bioguideID;
            const stateCode = memberInfo.state['postal-code'];
            const districtStr = memberInfo.district;
            
            // Parse district number
            let districtNum;
            if (districtStr === 'At Large') {
                districtNum = 0;
            } else {
                districtNum = parseInt(districtStr) || 0;
            }
            
            // Get member ID from database
            const memberResult = await pool.query(
                'SELECT id FROM members WHERE state_code = $1 AND district_number = $2',
                [stateCode, districtNum]
            );
            
            if (memberResult.rows.length === 0) {
                console.log(`Member not found: ${stateCode}-${districtNum}`);
                continue;
            }
            
            const memberId = memberResult.rows[0].id;
            memberCount++;
            
            // Process committee assignments
            if (member['committee-assignments'] && member['committee-assignments'].committee) {
                const committeeList = Array.isArray(member['committee-assignments'].committee) ?
                    member['committee-assignments'].committee : [member['committee-assignments'].committee];
                
                for (const comm of committeeList) {
                    if (comm.comcode && comm.title) {
                        // Track committee info
                        if (!committees.has(comm.comcode)) {
                            committees.set(comm.comcode, {
                                code: comm.comcode,
                                name: comm.title,
                                gpoTitle: comm.gpo_title || comm.title
                            });
                        }
                        
                        assignmentCount++;
                    }
                }
            }
        }
        
        // Insert committees first
        console.log(`\nInserting ${committees.size} committees...`);
        for (const [code, committee] of committees) {
            await pool.query(`
                INSERT INTO committees (committee_code, committee_name, chamber)
                VALUES ($1, $2, 'house')
                ON CONFLICT (committee_code) DO UPDATE
                SET committee_name = EXCLUDED.committee_name
            `, [committee.code, committee.name]);
        }
        
        // Now insert member assignments
        console.log('\nInserting member committee assignments...');
        assignmentCount = 0;
        
        for (const member of members) {
            if (!member['member-info'] || !member['member-info'].bioguideID) continue;
            
            const memberInfo = member['member-info'];
            const stateCode = memberInfo.state['postal-code'];
            const districtStr = memberInfo.district;
            
            let districtNum;
            if (districtStr === 'At Large') {
                districtNum = 0;
            } else {
                districtNum = parseInt(districtStr) || 0;
            }
            
            // Get member ID
            const memberResult = await pool.query(
                'SELECT id FROM members WHERE state_code = $1 AND district_number = $2',
                [stateCode, districtNum]
            );
            
            if (memberResult.rows.length === 0) continue;
            
            const memberId = memberResult.rows[0].id;
            
            // Clear existing assignments
            await pool.query('DELETE FROM member_committees WHERE member_id = $1', [memberId]);
            
            // Insert new assignments
            if (member['committee-assignments'] && member['committee-assignments'].committee) {
                const committeeList = Array.isArray(member['committee-assignments'].committee) ?
                    member['committee-assignments'].committee : [member['committee-assignments'].committee];
                
                for (const comm of committeeList) {
                    if (comm.comcode) {
                        // Get committee ID
                        const commResult = await pool.query(
                            'SELECT id FROM committees WHERE committee_code = $1',
                            [comm.comcode]
                        );
                        
                        if (commResult.rows.length > 0) {
                            const committeeId = commResult.rows[0].id;
                            const role = comm.leadership || 'Member';
                            
                            await pool.query(`
                                INSERT INTO member_committees (member_id, committee_id, role)
                                VALUES ($1, $2, $3)
                                ON CONFLICT (member_id, committee_id) DO UPDATE
                                SET role = EXCLUDED.role
                            `, [memberId, committeeId, role]);
                            
                            assignmentCount++;
                        }
                    }
                }
            }
        }
        
        console.log(`\nImport completed:`);
        console.log(`- ${committees.size} committees imported`);
        console.log(`- ${assignmentCount} committee assignments created`);
        console.log(`- ${memberCount} members processed`);
        
    } catch (error) {
        console.error('Error importing committee data:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    importCommitteesFromJSON()
        .then(() => {
            console.log('\nCommittee import completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Import failed:', error);
            process.exit(1);
        });
}

module.exports = { importCommitteesFromJSON };