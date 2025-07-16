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

// Map of subcommittee codes to their parent committee codes
const SUBCOMMITTEE_PARENT_MAP = {
    // This will be populated dynamically based on the data
};

async function importHouseData() {
    const client = await pool.connect();
    
    try {
        console.log('Starting House.gov data import...');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Fetch data from House.gov
        console.log('Fetching data from House.gov JSON feed...');
        const response = await fetch('https://housegovfeeds.house.gov/feeds/Member/json');
        const data = await response.json();
        
        if (!data.members || !data.members.member) {
            throw new Error('Invalid JSON structure');
        }
        
        // Cache the raw JSON
        const today = new Date().toISOString().split('T')[0];
        await client.query(`
            INSERT INTO house_json_cache (fetch_date, json_data)
            VALUES ($1, $2)
            ON CONFLICT (fetch_date) DO UPDATE
            SET json_data = EXCLUDED.json_data
        `, [today, JSON.stringify(data)]);
        
        const members = Array.isArray(data.members.member) ? 
            data.members.member : [data.members.member];
        
        console.log(`Found ${members.length} members in feed`);
        
        // Track statistics
        const stats = {
            membersProcessed: 0,
            membersUpdated: 0,
            membersCreated: 0,
            committeesProcessed: new Set(),
            subcommitteesProcessed: new Set(),
            assignmentsCreated: 0,
            subAssignmentsCreated: 0
        };
        
        // First pass: collect all committees and build parent-child relationships
        console.log('\nAnalyzing committee structure...');
        const committeeMap = new Map();
        const subcommitteeParentGuess = new Map();
        
        for (const member of members) {
            if (member['committee-assignments']) {
                // Process committees
                if (member['committee-assignments'].committee) {
                    const committees = Array.isArray(member['committee-assignments'].committee) ?
                        member['committee-assignments'].committee : [member['committee-assignments'].committee];
                    
                    for (const comm of committees) {
                        if (comm.comcode) {
                            committeeMap.set(comm.comcode, {
                                code: comm.comcode,
                                name: comm.title || comm.gpo_title,
                                gpoTitle: comm.gpo_title
                            });
                        }
                    }
                }
                
                // Process subcommittees to guess parent relationships
                if (member['committee-assignments'].subcommittee) {
                    const subcommittees = Array.isArray(member['committee-assignments'].subcommittee) ?
                        member['committee-assignments'].subcommittee : [member['committee-assignments'].subcommittee];
                    
                    const memberCommittees = member['committee-assignments'].committee ?
                        (Array.isArray(member['committee-assignments'].committee) ?
                            member['committee-assignments'].committee : [member['committee-assignments'].committee])
                        : [];
                    
                    for (const sub of subcommittees) {
                        if (sub.subcomcode && memberCommittees.length > 0) {
                            // Try to match by prefix
                            const prefix = sub.subcomcode.substring(0, 2);
                            const parent = memberCommittees.find(c => c.comcode && c.comcode.startsWith(prefix));
                            if (parent) {
                                subcommitteeParentGuess.set(sub.subcomcode, parent.comcode);
                            }
                        }
                    }
                }
            }
        }
        
        // Insert/update committees
        console.log(`\nProcessing ${committeeMap.size} committees...`);
        for (const [code, committee] of committeeMap) {
            await client.query(`
                INSERT INTO committees (committee_code, committee_name, chamber)
                VALUES ($1, $2, 'house')
                ON CONFLICT (committee_code) DO UPDATE
                SET committee_name = EXCLUDED.committee_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [committee.code, committee.name]);
            stats.committeesProcessed.add(committee.code);
        }
        
        // Process members
        console.log('\nProcessing members...');
        for (const member of members) {
            if (!member['member-info']) continue;
            
            const info = member['member-info'];
            const stateCode = info.state?.['postal-code'];
            if (!stateCode) continue;
            
            // Skip territories for now (they don't have geometry data)
            if (['AS', 'DC', 'GU', 'MP', 'PR', 'VI'].includes(stateCode)) {
                console.log(`Skipping territory: ${stateCode}`);
                continue;
            }
            
            // Parse district
            let districtNum;
            if (info.district === 'At Large') {
                districtNum = 0;
            } else {
                districtNum = parseInt(info.district) || 0;
            }
            
            // Parse dates
            const electedDate = info['elected-date']?.date ? 
                `${info['elected-date'].date.substring(0,4)}-${info['elected-date'].date.substring(4,6)}-${info['elected-date'].date.substring(6,8)}` : null;
            const swornDate = info['sworn-date']?.date ? 
                `${info['sworn-date'].date.substring(0,4)}-${info['sworn-date'].date.substring(4,6)}-${info['sworn-date'].date.substring(6,8)}` : null;
            
            // Validate required fields
            if (!info.lastname) {
                console.log(`Skipping member with missing last name: ${stateCode}-${districtNum}`);
                continue;
            }
            
            // Build full name
            const fullName = info['official-name'] || 
                `${info.courtesy || ''} ${info.firstname || ''} ${info.middlename || ''} ${info.lastname} ${info.suffix || ''}`.trim();
            
            // Check if member exists by bioguide ID first (primary), then by state-district (fallback)
            let existingMember;
            if (info.bioguideID) {
                existingMember = await client.query(
                    'SELECT id FROM members WHERE bioguide_id = $1',
                    [info.bioguideID]
                );
            }
            
            // Fallback to state-district if no bioguide ID match found
            if (!existingMember || existingMember.rows.length === 0) {
                existingMember = await client.query(
                    'SELECT id FROM members WHERE state_code = $1 AND district_number = $2',
                    [stateCode, districtNum]
                );
            }
            
            let memberId;
            if (existingMember.rows.length > 0) {
                // Update existing member
                memberId = existingMember.rows[0].id;
                await client.query(`
                    UPDATE members SET
                        bioguide_id = $1,
                        first_name = $2,
                        middle_name = $3,
                        last_name = $4,
                        suffix = $5,
                        full_name = $6,
                        housegov_display_name = $7,
                        courtesy = $8,
                        formal_name = $9,
                        party = $10,
                        phone = $11,
                        office_room = $12,
                        office_building = $13,
                        office_zip = $14,
                        office_zip_suffix = $15,
                        elected_date = $16,
                        sworn_date = $17,
                        townname = $18,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $19
                `, [
                    info.bioguideID,
                    info.firstname,
                    info.middlename,
                    info.lastname,
                    info.suffix,
                    fullName,
                    member['housegov-display-name'],
                    info.courtesy,
                    info['formal-name'],
                    info.party || info.caucus,
                    info.phone,
                    info['office-room'],
                    info['office-building'],
                    info['office-zip'],
                    info['office-zip-suffix'],
                    electedDate,
                    swornDate,
                    info.townname,
                    memberId
                ]);
                stats.membersUpdated++;
            } else {
                // Insert new member
                const result = await client.query(`
                    INSERT INTO members (
                        state_code, district_number, bioguide_id, first_name, middle_name,
                        last_name, suffix, full_name, housegov_display_name, courtesy,
                        formal_name, party, phone, office_room, office_building,
                        office_zip, office_zip_suffix, elected_date, sworn_date, townname
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                    RETURNING id
                `, [
                    stateCode, districtNum, info.bioguideID, info.firstname, info.middlename,
                    info.lastname, info.suffix, fullName, member['housegov-display-name'], info.courtesy,
                    info['formal-name'], info.party || info.caucus, info.phone, info['office-room'], info['office-building'],
                    info['office-zip'], info['office-zip-suffix'], electedDate, swornDate, info.townname
                ]);
                memberId = result.rows[0].id;
                stats.membersCreated++;
            }
            
            stats.membersProcessed++;
            
            // Clear existing committee assignments
            await client.query('DELETE FROM member_committees WHERE member_id = $1', [memberId]);
            await client.query('DELETE FROM member_subcommittees WHERE member_id = $1', [memberId]);
            
            // Process committee assignments
            if (member['committee-assignments']) {
                // Committees
                if (member['committee-assignments'].committee) {
                    const committees = Array.isArray(member['committee-assignments'].committee) ?
                        member['committee-assignments'].committee : [member['committee-assignments'].committee];
                    
                    for (const comm of committees) {
                        if (comm.comcode) {
                            const commResult = await client.query(
                                'SELECT id FROM committees WHERE committee_code = $1',
                                [comm.comcode]
                            );
                            
                            if (commResult.rows.length > 0) {
                                await client.query(`
                                    INSERT INTO member_committees (member_id, committee_id, role, rank)
                                    VALUES ($1, $2, $3, $4)
                                `, [
                                    memberId,
                                    commResult.rows[0].id,
                                    comm.leadership || 'Member',
                                    comm.rank ? parseInt(comm.rank) : null
                                ]);
                                stats.assignmentsCreated++;
                            }
                        }
                    }
                }
                
                // Subcommittees
                if (member['committee-assignments'].subcommittee) {
                    const subcommittees = Array.isArray(member['committee-assignments'].subcommittee) ?
                        member['committee-assignments'].subcommittee : [member['committee-assignments'].subcommittee];
                    
                    for (const sub of subcommittees) {
                        if (sub.subcomcode) {
                            // First check if subcommittee exists
                            let subResult = await client.query(
                                'SELECT id FROM subcommittees WHERE subcommittee_code = $1',
                                [sub.subcomcode]
                            );
                            
                            if (subResult.rows.length === 0) {
                                // Create subcommittee
                                const parentCode = subcommitteeParentGuess.get(sub.subcomcode);
                                let parentId = null;
                                
                                if (parentCode) {
                                    const parentResult = await client.query(
                                        'SELECT id FROM committees WHERE committee_code = $1',
                                        [parentCode]
                                    );
                                    if (parentResult.rows.length > 0) {
                                        parentId = parentResult.rows[0].id;
                                    }
                                }
                                
                                const insertResult = await client.query(`
                                    INSERT INTO subcommittees (subcommittee_code, committee_id, subcommittee_name)
                                    VALUES ($1, $2, $3)
                                    RETURNING id
                                `, [sub.subcomcode, parentId, sub.subcomcode]); // Using code as name for now
                                
                                subResult = { rows: [{ id: insertResult.rows[0].id }] };
                                stats.subcommitteesProcessed.add(sub.subcomcode);
                            }
                            
                            // Create assignment
                            await client.query(`
                                INSERT INTO member_subcommittees (member_id, subcommittee_id, role, rank)
                                VALUES ($1, $2, $3, $4)
                            `, [
                                memberId,
                                subResult.rows[0].id,
                                sub.leadership || 'Member',
                                sub.rank ? parseInt(sub.rank) : null
                            ]);
                            stats.subAssignmentsCreated++;
                        }
                    }
                }
            }
        }
        
        // Update sync log
        await client.query(`
            INSERT INTO sync_log (data_type, sync_status, started_at, completed_at, records_processed)
            VALUES ('house_json_import', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $1)
        `, [stats.membersProcessed]);
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Print statistics
        console.log('\n=== Import Complete ===');
        console.log(`Members processed: ${stats.membersProcessed}`);
        console.log(`  - Created: ${stats.membersCreated}`);
        console.log(`  - Updated: ${stats.membersUpdated}`);
        console.log(`Committees: ${stats.committeesProcessed.size}`);
        console.log(`Subcommittees: ${stats.subcommitteesProcessed.size}`);
        console.log(`Committee assignments: ${stats.assignmentsCreated}`);
        console.log(`Subcommittee assignments: ${stats.subAssignmentsCreated}`);
        console.log(`\nData cached for date: ${today}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import failed:', error);
        
        // Log failure
        await client.query(`
            INSERT INTO sync_log (data_type, sync_status, started_at, completed_at, error_message)
            VALUES ('house_json_import', 'failed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $1)
        `, [error.message]);
        
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    importHouseData()
        .then(() => {
            console.log('\nImport completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Import failed:', error);
            process.exit(1);
        });
}

module.exports = { importHouseData };