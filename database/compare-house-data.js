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

class HouseDataComparator {
    constructor() {
        this.jsonData = null;
        this.dbData = null;
        this.comparisonReport = {
            summary: {},
            missingInDb: [],
            missingInJson: [],
            dataMismatches: [],
            bioguideDuplicates: [],
            recommendations: []
        };
    }

    async fetchHouseJson() {
        console.log('Fetching current House JSON feed...');
        try {
            const response = await fetch('https://housegovfeeds.house.gov/feeds/Member/json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.members || !data.members.member) {
                throw new Error('Invalid JSON structure');
            }

            // Normalize to array
            this.jsonData = Array.isArray(data.members.member) ? 
                data.members.member : [data.members.member];
            
            console.log(`✓ Fetched ${this.jsonData.length} members from House JSON feed`);
            return this.jsonData;
        } catch (error) {
            console.error('Error fetching House JSON:', error);
            throw error;
        }
    }

    async fetchDatabaseData() {
        console.log('Querying current database member data...');
        const client = await pool.connect();
        
        try {
            // First fetch all members
            const membersQuery = `
                SELECT * FROM members 
                ORDER BY state_code, district_number
            `;
            const membersResult = await client.query(membersQuery);
            
            // Then fetch committees and subcommittees separately
            const committeesQuery = `
                SELECT 
                    m.id as member_id,
                    c.committee_code,
                    c.committee_name,
                    mc.role,
                    mc.rank
                FROM members m
                JOIN member_committees mc ON m.id = mc.member_id
                JOIN committees c ON mc.committee_id = c.id
                ORDER BY m.id, c.committee_code
            `;
            const committeesResult = await client.query(committeesQuery);

            const subcommitteesQuery = `
                SELECT 
                    m.id as member_id,
                    s.subcommittee_code,
                    s.subcommittee_name,
                    ms.role,
                    ms.rank
                FROM members m
                JOIN member_subcommittees ms ON m.id = ms.member_id
                JOIN subcommittees s ON ms.subcommittee_id = s.id
                ORDER BY m.id, s.subcommittee_code
            `;
            const subcommitteesResult = await client.query(subcommitteesQuery);

            // Build data structure
            const committeesMap = new Map();
            const subcommitteesMap = new Map();

            committeesResult.rows.forEach(row => {
                if (!committeesMap.has(row.member_id)) {
                    committeesMap.set(row.member_id, []);
                }
                committeesMap.get(row.member_id).push({
                    committee_code: row.committee_code,
                    committee_name: row.committee_name,
                    role: row.role,
                    rank: row.rank
                });
            });

            subcommitteesResult.rows.forEach(row => {
                if (!subcommitteesMap.has(row.member_id)) {
                    subcommitteesMap.set(row.member_id, []);
                }
                subcommitteesMap.get(row.member_id).push({
                    subcommittee_code: row.subcommittee_code,
                    subcommittee_name: row.subcommittee_name,
                    role: row.role,
                    rank: row.rank
                });
            });

            // Combine data
            const result = {
                rows: membersResult.rows.map(member => ({
                    ...member,
                    committees: committeesMap.get(member.id) || [],
                    subcommittees: subcommitteesMap.get(member.id) || []
                }))
            };
            this.dbData = result.rows;
            
            console.log(`✓ Fetched ${this.dbData.length} members from database`);
            return this.dbData;
        } catch (error) {
            console.error('Error fetching database data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    normalizeJsonMember(member) {
        if (!member['member-info']) return null;
        
        const info = member['member-info'];
        const stateCode = info.state?.['postal-code'];
        
        // Skip territories
        if (['AS', 'DC', 'GU', 'MP', 'PR', 'VI'].includes(stateCode)) {
            return null;
        }

        let districtNum;
        if (info.district === 'At Large') {
            districtNum = 0;
        } else {
            // Handle district names like "7th", "18th", etc.
            const districtMatch = info.district?.match(/(\d+)/);
            districtNum = districtMatch ? parseInt(districtMatch[1]) : 0;
        }

        // Parse dates
        const electedDate = info['elected-date']?.date ? 
            `${info['elected-date'].date.substring(0,4)}-${info['elected-date'].date.substring(4,6)}-${info['elected-date'].date.substring(6,8)}` : null;
        const swornDate = info['sworn-date']?.date ? 
            `${info['sworn-date'].date.substring(0,4)}-${info['sworn-date'].date.substring(4,6)}-${info['sworn-date'].date.substring(6,8)}` : null;

        // Extract committees
        const committees = [];
        if (member['committee-assignments']?.committee) {
            const comms = Array.isArray(member['committee-assignments'].committee) ?
                member['committee-assignments'].committee : [member['committee-assignments'].committee];
            
            committees.push(...comms.map(c => ({
                code: c.comcode,
                name: c.title || c.gpo_title,
                role: c.leadership || 'Member',
                rank: c.rank ? parseInt(c.rank) : null
            })).filter(c => c.code));
        }

        const subcommittees = [];
        if (member['committee-assignments']?.subcommittee) {
            const subs = Array.isArray(member['committee-assignments'].subcommittee) ?
                member['committee-assignments'].subcommittee : [member['committee-assignments'].subcommittee];
            
            subcommittees.push(...subs.map(s => ({
                code: s.subcomcode,
                name: s.subcomcode, // JSON doesn't have proper names
                role: s.leadership || 'Member',
                rank: s.rank ? parseInt(s.rank) : null
            })).filter(s => s.code));
        }

        return {
            bioguide_id: info.bioguideID,
            state_code: stateCode,
            district_number: districtNum,
            first_name: info.firstname,
            middle_name: info.middlename,
            last_name: info.lastname,
            suffix: info.suffix,
            full_name: info['official-name'] || 
                `${info.courtesy || ''} ${info.firstname || ''} ${info.middlename || ''} ${info.lastname} ${info.suffix || ''}`.trim(),
            housegov_display_name: member['housegov-display-name'],
            courtesy: info.courtesy,
            formal_name: info['formal-name'],
            party: info.party || info.caucus,
            phone: info.phone,
            office_room: info['office-room'],
            office_building: info['office-building'],
            office_zip: info['office-zip'],
            office_zip_suffix: info['office-zip-suffix'],
            elected_date: electedDate,
            sworn_date: swornDate,
            townname: info.townname,
            committees: committees,
            subcommittees: subcommittees
        };
    }

    compareData() {
        console.log('Comparing JSON feed data with database data...');
        
        // Normalize JSON data
        const normalizedJson = this.jsonData
            .map(member => this.normalizeJsonMember(member))
            .filter(member => member !== null);

        // Create maps for easier comparison
        const jsonByBioguide = new Map();
        const jsonByStateDistrict = new Map();
        const dbByBioguide = new Map();
        const dbByStateDistrict = new Map();

        // Build JSON maps
        normalizedJson.forEach(member => {
            const key = `${member.state_code}-${member.district_number}`;
            jsonByStateDistrict.set(key, member);
            
            if (member.bioguide_id) {
                if (jsonByBioguide.has(member.bioguide_id)) {
                    this.comparisonReport.bioguideDuplicates.push({
                        bioguide_id: member.bioguide_id,
                        source: 'JSON feed',
                        members: [jsonByBioguide.get(member.bioguide_id), member]
                    });
                }
                jsonByBioguide.set(member.bioguide_id, member);
            }
        });

        // Build DB maps
        this.dbData.forEach(member => {
            const key = `${member.state_code}-${member.district_number}`;
            dbByStateDistrict.set(key, member);
            
            if (member.bioguide_id) {
                if (dbByBioguide.has(member.bioguide_id)) {
                    this.comparisonReport.bioguideDuplicates.push({
                        bioguide_id: member.bioguide_id,
                        source: 'Database',
                        members: [dbByBioguide.get(member.bioguide_id), member]
                    });
                }
                dbByBioguide.set(member.bioguide_id, member);
            }
        });

        // Find members in JSON but not in DB
        normalizedJson.forEach(jsonMember => {
            const key = `${jsonMember.state_code}-${jsonMember.district_number}`;
            if (!dbByStateDistrict.has(key)) {
                this.comparisonReport.missingInDb.push({
                    state_district: key,
                    bioguide_id: jsonMember.bioguide_id,
                    full_name: jsonMember.full_name,
                    party: jsonMember.party,
                    reason: 'New member or missing from database'
                });
            }
        });

        // Find members in DB but not in JSON
        this.dbData.forEach(dbMember => {
            const key = `${dbMember.state_code}-${dbMember.district_number}`;
            if (!jsonByStateDistrict.has(key)) {
                this.comparisonReport.missingInJson.push({
                    state_district: key,
                    bioguide_id: dbMember.bioguide_id,
                    full_name: dbMember.full_name,
                    party: dbMember.party,
                    reason: 'Member may have left office or data issue'
                });
            }
        });

        // Compare existing members for data mismatches
        normalizedJson.forEach(jsonMember => {
            const key = `${jsonMember.state_code}-${jsonMember.district_number}`;
            const dbMember = dbByStateDistrict.get(key);
            
            if (dbMember) {
                const mismatches = this.findFieldMismatches(jsonMember, dbMember);
                if (mismatches.length > 0) {
                    this.comparisonReport.dataMismatches.push({
                        state_district: key,
                        bioguide_id: jsonMember.bioguide_id || dbMember.bioguide_id,
                        full_name: jsonMember.full_name || dbMember.full_name,
                        mismatches: mismatches
                    });
                }
            }
        });

        // Generate summary
        this.comparisonReport.summary = {
            json_members_count: normalizedJson.length,
            db_members_count: this.dbData.length,
            missing_in_db_count: this.comparisonReport.missingInDb.length,
            missing_in_json_count: this.comparisonReport.missingInJson.length,
            data_mismatches_count: this.comparisonReport.dataMismatches.length,
            bioguide_duplicates_count: this.comparisonReport.bioguideDuplicates.length,
            comparison_timestamp: new Date().toISOString()
        };

        this.generateRecommendations();
    }

    findFieldMismatches(jsonMember, dbMember) {
        const mismatches = [];
        const fieldsToCompare = [
            'bioguide_id', 'first_name', 'middle_name', 'last_name', 'suffix',
            'full_name', 'housegov_display_name', 'courtesy', 'formal_name',
            'party', 'phone', 'office_room', 'office_building', 'office_zip',
            'office_zip_suffix', 'townname'
        ];
        
        const dateFields = ['elected_date', 'sworn_date'];

        // Compare regular fields
        fieldsToCompare.forEach(field => {
            const jsonValue = jsonMember[field];
            const dbValue = dbMember[field];
            
            // Normalize values for comparison
            const normalizedJsonValue = jsonValue === null || jsonValue === undefined ? null : String(jsonValue).trim();
            const normalizedDbValue = dbValue === null || dbValue === undefined ? null : String(dbValue).trim();
            
            if (normalizedJsonValue !== normalizedDbValue) {
                mismatches.push({
                    field: field,
                    json_value: normalizedJsonValue,
                    db_value: normalizedDbValue
                });
            }
        });

        // Compare date fields specially
        dateFields.forEach(field => {
            const jsonValue = jsonMember[field];
            const dbValue = dbMember[field];
            
            // Convert both to comparable format (YYYY-MM-DD)
            let normalizedJsonValue = null;
            let normalizedDbValue = null;
            
            if (jsonValue) {
                normalizedJsonValue = jsonValue; // Already in YYYY-MM-DD format from JSON
            }
            
            if (dbValue) {
                try {
                    const date = new Date(dbValue);
                    normalizedDbValue = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
                } catch (e) {
                    normalizedDbValue = String(dbValue);
                }
            }
            
            if (normalizedJsonValue !== normalizedDbValue) {
                mismatches.push({
                    field: field,
                    json_value: normalizedJsonValue,
                    db_value: normalizedDbValue,
                    note: 'date_comparison'
                });
            }
        });

        // Compare committees
        const jsonCommittees = new Set(jsonMember.committees.map(c => c.code));
        const dbCommittees = new Set(dbMember.committees.map(c => c.committee_code));
        
        if (!this.setsEqual(jsonCommittees, dbCommittees)) {
            mismatches.push({
                field: 'committees',
                json_value: Array.from(jsonCommittees).sort().join(', '),
                db_value: Array.from(dbCommittees).sort().join(', ')
            });
        }

        // Compare subcommittees
        const jsonSubcommittees = new Set(jsonMember.subcommittees.map(s => s.code));
        const dbSubcommittees = new Set(dbMember.subcommittees.map(s => s.subcommittee_code));
        
        if (!this.setsEqual(jsonSubcommittees, dbSubcommittees)) {
            mismatches.push({
                field: 'subcommittees',
                json_value: Array.from(jsonSubcommittees).sort().join(', '),
                db_value: Array.from(dbSubcommittees).sort().join(', ')
            });
        }

        return mismatches;
    }

    setsEqual(set1, set2) {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.comparisonReport.missingInDb.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Add missing members to database',
                description: `${this.comparisonReport.missingInDb.length} members found in JSON feed but not in database`,
                details: this.comparisonReport.missingInDb.slice(0, 5) // Show first 5
            });
        }

        if (this.comparisonReport.missingInJson.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Review members missing from JSON feed',
                description: `${this.comparisonReport.missingInJson.length} members in database but not in JSON feed - may have left office`,
                details: this.comparisonReport.missingInJson.slice(0, 5)
            });
        }

        if (this.comparisonReport.dataMismatches.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Update mismatched member data',
                description: `${this.comparisonReport.dataMismatches.length} members have data inconsistencies`,
                details: this.comparisonReport.dataMismatches.slice(0, 3)
            });
        }

        if (this.comparisonReport.bioguideDuplicates.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Fix bioguide ID duplicates',
                description: 'Duplicate bioguide IDs found - this will cause update conflicts',
                details: this.comparisonReport.bioguideDuplicates
            });
        }

        // Check if bioguide ID is being used properly as unique identifier
        const missingBioguideIds = this.dbData.filter(m => !m.bioguide_id).length;
        if (missingBioguideIds > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Add missing bioguide IDs',
                description: `${missingBioguideIds} members in database lack bioguide IDs`,
                details: 'Bioguide ID should be the primary unique identifier for updates'
            });
        }

        this.comparisonReport.recommendations = recommendations;
    }

    generateReport() {
        const report = {
            title: 'House Members Data Comparison Report',
            generated_at: new Date().toISOString(),
            ...this.comparisonReport
        };

        console.log('\n' + '='.repeat(80));
        console.log('HOUSE MEMBERS DATA COMPARISON REPORT');
        console.log('='.repeat(80));
        console.log(`Generated at: ${report.generated_at}`);
        
        console.log('\n📊 SUMMARY:');
        console.log(`  JSON Feed Members: ${report.summary.json_members_count}`);
        console.log(`  Database Members: ${report.summary.db_members_count}`);
        console.log(`  Missing in DB: ${report.summary.missing_in_db_count}`);
        console.log(`  Missing in JSON: ${report.summary.missing_in_json_count}`);
        console.log(`  Data Mismatches: ${report.summary.data_mismatches_count}`);
        console.log(`  Bioguide Duplicates: ${report.summary.bioguide_duplicates_count}`);

        if (report.recommendations.length > 0) {
            console.log('\n🚨 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, index) => {
                console.log(`\n${index + 1}. [${rec.priority}] ${rec.action}`);
                console.log(`   ${rec.description}`);
                if (rec.details && Array.isArray(rec.details) && rec.details.length > 0) {
                    console.log('   Examples:');
                    rec.details.slice(0, 3).forEach(detail => {
                        if (typeof detail === 'object') {
                            console.log(`   - ${detail.state_district || detail.bioguide_id}: ${detail.full_name || detail.reason || JSON.stringify(detail)}`);
                        } else {
                            console.log(`   - ${detail}`);
                        }
                    });
                }
            });
        }

        if (report.missingInDb.length > 0) {
            console.log('\n❌ MISSING IN DATABASE:');
            report.missingInDb.forEach(member => {
                console.log(`  - ${member.state_district}: ${member.full_name} (${member.party}) [${member.bioguide_id}]`);
            });
        }

        if (report.missingInJson.length > 0) {
            console.log('\n⚠️  MISSING IN JSON FEED:');
            report.missingInJson.forEach(member => {
                console.log(`  - ${member.state_district}: ${member.full_name} (${member.party}) [${member.bioguide_id}]`);
            });
        }

        if (report.dataMismatches.length > 0) {
            console.log('\n🔄 DATA MISMATCHES:');
            report.dataMismatches.slice(0, 10).forEach(member => {
                console.log(`\n  ${member.state_district}: ${member.full_name} [${member.bioguide_id}]`);
                member.mismatches.forEach(mismatch => {
                    console.log(`    ${mismatch.field}: JSON="${mismatch.json_value}" | DB="${mismatch.db_value}"`);
                });
            });
            if (report.dataMismatches.length > 10) {
                console.log(`    ... and ${report.dataMismatches.length - 10} more`);
            }
        }

        if (report.bioguideDuplicates.length > 0) {
            console.log('\n⚠️  BIOGUIDE ID DUPLICATES:');
            report.bioguideDuplicates.forEach(dup => {
                console.log(`  ${dup.source}: ${dup.bioguide_id} appears multiple times`);
            });
        }

        console.log('\n' + '='.repeat(80));

        return report;
    }

    async saveReportToFile() {
        const report = this.generateReport();
        const filename = `house-data-comparison-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(__dirname, '..', 'logs', filename);
        
        try {
            const fs = require('fs').promises;
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            console.log(`\n📄 Detailed report saved to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error('Error saving report:', error);
        }
    }
}

async function runComparison() {
    const comparator = new HouseDataComparator();
    
    try {
        // Fetch data from both sources
        await comparator.fetchHouseJson();
        await comparator.fetchDatabaseData();
        
        // Compare and generate report
        comparator.compareData();
        const report = comparator.generateReport();
        
        // Save detailed report
        await comparator.saveReportToFile();
        
        return report;
        
    } catch (error) {
        console.error('Comparison failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    runComparison()
        .then(() => {
            console.log('\n✅ Comparison completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Comparison failed:', error);
            process.exit(1);
        });
}

module.exports = { HouseDataComparator, runComparison };