const { Pool } = require('pg');
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

async function analyzeBioguideUsage() {
    const client = await pool.connect();
    
    try {
        console.log('=== BIOGUIDE ID ANALYSIS ===\n');
        
        // Check bioguide ID coverage
        const coverageQuery = `
            SELECT 
                COUNT(*) as total_members,
                COUNT(bioguide_id) as members_with_bioguide,
                COUNT(*) - COUNT(bioguide_id) as members_missing_bioguide,
                ROUND(100.0 * COUNT(bioguide_id) / COUNT(*), 2) as coverage_percentage
            FROM members
        `;
        
        const coverageResult = await client.query(coverageQuery);
        const coverage = coverageResult.rows[0];
        
        console.log('📊 BIOGUIDE ID COVERAGE:');
        console.log(`  Total members in database: ${coverage.total_members}`);
        console.log(`  Members with bioguide ID: ${coverage.members_with_bioguide}`);
        console.log(`  Members missing bioguide ID: ${coverage.members_missing_bioguide}`);
        console.log(`  Coverage percentage: ${coverage.coverage_percentage}%`);
        
        // Check for duplicate bioguide IDs
        const duplicatesQuery = `
            SELECT 
                bioguide_id,
                COUNT(*) as duplicate_count,
                array_agg(state_code || '-' || district_number) as districts
            FROM members 
            WHERE bioguide_id IS NOT NULL
            GROUP BY bioguide_id
            HAVING COUNT(*) > 1
            ORDER BY duplicate_count DESC
        `;
        
        const duplicatesResult = await client.query(duplicatesQuery);
        
        console.log('\n🔍 BIOGUIDE ID DUPLICATES:');
        if (duplicatesResult.rows.length === 0) {
            console.log('  ✅ No duplicate bioguide IDs found');
        } else {
            console.log(`  ❌ Found ${duplicatesResult.rows.length} duplicate bioguide IDs:`);
            duplicatesResult.rows.forEach(row => {
                console.log(`    ${row.bioguide_id}: appears ${row.duplicate_count} times in districts ${row.districts.join(', ')}`);
            });
        }
        
        // Check for missing bioguide IDs
        const missingQuery = `
            SELECT 
                state_code,
                district_number,
                full_name,
                party,
                created_at
            FROM members 
            WHERE bioguide_id IS NULL
            ORDER BY state_code, district_number
        `;
        
        const missingResult = await client.query(missingQuery);
        
        console.log('\n❌ MEMBERS MISSING BIOGUIDE ID:');
        if (missingResult.rows.length === 0) {
            console.log('  ✅ All members have bioguide IDs');
        } else {
            missingResult.rows.forEach(row => {
                console.log(`  ${row.state_code}-${row.district_number}: ${row.full_name} (${row.party}) - added ${row.created_at.toDateString()}`);
            });
        }
        
        // Check update strategy effectiveness
        const updateStrategyQuery = `
            SELECT 
                COUNT(CASE WHEN bioguide_id IS NOT NULL THEN 1 END) as can_update_by_bioguide,
                COUNT(CASE WHEN bioguide_id IS NULL THEN 1 END) as must_update_by_state_district,
                ROUND(100.0 * COUNT(CASE WHEN bioguide_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as bioguide_update_percentage
            FROM members
        `;
        
        const updateStrategyResult = await client.query(updateStrategyQuery);
        const updateStrategy = updateStrategyResult.rows[0];
        
        console.log('\n🔄 UPDATE STRATEGY ANALYSIS:');
        console.log(`  Can update by bioguide ID: ${updateStrategy.can_update_by_bioguide} members (${updateStrategy.bioguide_update_percentage}%)`);
        console.log(`  Must update by state-district: ${updateStrategy.must_update_by_state_district} members`);
        
        if (updateStrategy.bioguide_update_percentage >= 95) {
            console.log('  ✅ Bioguide ID is suitable as primary update identifier');
        } else if (updateStrategy.bioguide_update_percentage >= 85) {
            console.log('  ⚠️  Bioguide ID coverage is good but could be improved');
        } else {
            console.log('  ❌ Bioguide ID coverage is insufficient for reliable updates');
        }
        
        // Analyze recent sync activity
        const syncQuery = `
            SELECT 
                data_type,
                sync_status,
                started_at,
                completed_at,
                records_processed,
                error_message
            FROM sync_log 
            WHERE data_type = 'house_json_import'
            ORDER BY started_at DESC
            LIMIT 5
        `;
        
        const syncResult = await client.query(syncQuery);
        
        console.log('\n📅 RECENT SYNC ACTIVITY:');
        if (syncResult.rows.length === 0) {
            console.log('  No sync activity found');
        } else {
            syncResult.rows.forEach(row => {
                const status = row.sync_status === 'completed' ? '✅' : '❌';
                const duration = row.completed_at ? 
                    `(${Math.round((row.completed_at - row.started_at) / 1000)}s)` : 
                    '(incomplete)';
                console.log(`  ${status} ${row.started_at.toDateString()}: ${row.records_processed || 0} records ${duration}`);
                if (row.error_message) {
                    console.log(`      Error: ${row.error_message}`);
                }
            });
        }
        
        // Check committee assignment integrity
        const committeeIntegrityQuery = `
            SELECT 
                COUNT(DISTINCT m.id) as members_with_committees,
                COUNT(mc.member_id) as total_committee_assignments,
                AVG(committee_count.assignments_per_member) as avg_assignments_per_member
            FROM members m
            LEFT JOIN member_committees mc ON m.id = mc.member_id
            LEFT JOIN (
                SELECT member_id, COUNT(*) as assignments_per_member
                FROM member_committees
                GROUP BY member_id
            ) committee_count ON m.id = committee_count.member_id
        `;
        
        const committeeIntegrityResult = await client.query(committeeIntegrityQuery);
        const committeeIntegrity = committeeIntegrityResult.rows[0];
        
        console.log('\n🏛️  COMMITTEE ASSIGNMENT INTEGRITY:');
        console.log(`  Members with committee assignments: ${committeeIntegrity.members_with_committees}`);
        console.log(`  Total committee assignments: ${committeeIntegrity.total_committee_assignments}`);
        console.log(`  Average assignments per member: ${Math.round(committeeIntegrity.avg_assignments_per_member * 100) / 100}`);
        
        // Generate recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (coverage.members_missing_bioguide > 0) {
            console.log(`1. [HIGH] Add bioguide IDs for ${coverage.members_missing_bioguide} members missing this identifier`);
        }
        
        if (duplicatesResult.rows.length > 0) {
            console.log(`2. [CRITICAL] Fix ${duplicatesResult.rows.length} duplicate bioguide ID conflicts`);
        }
        
        if (updateStrategy.bioguide_update_percentage < 95) {
            console.log('3. [MEDIUM] Improve bioguide ID coverage before relying on it as primary update key');
        }
        
        if (coverage.coverage_percentage >= 95 && duplicatesResult.rows.length === 0) {
            console.log('✅ [GOOD] Bioguide ID is properly configured as unique identifier');
            console.log('   - Use bioguide_id as primary key for updates');
            console.log('   - Fall back to state_code + district_number for edge cases');
        }
        
        console.log('\n🔧 SUGGESTED UPDATE STRATEGY:');
        console.log('1. Check if member exists by bioguide_id (if provided)');
        console.log('2. Fall back to state_code + district_number matching');
        console.log('3. Always update bioguide_id when available from JSON feed');
        console.log('4. Log cases where bioguide_id is missing or conflicts occur');
        
    } catch (error) {
        console.error('Analysis failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    analyzeBioguideUsage()
        .then(() => {
            console.log('\n✅ Bioguide analysis completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = { analyzeBioguideUsage };