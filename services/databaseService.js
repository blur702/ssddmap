const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'zip4_districts.db');
        this.db = null;
    }

    async initialize() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        await fs.mkdir(dataDir, { recursive: true });

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Create tables if they don't exist
                this.db.serialize(() => {
                    // Main ZIP+4 to district mapping table
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS zip4_districts (
                            zip5 CHAR(5) NOT NULL,
                            plus4_low CHAR(4) NOT NULL,
                            plus4_high CHAR(4) NOT NULL,
                            state_code CHAR(2) NOT NULL,
                            district_number CHAR(2) NOT NULL,
                            county_fips CHAR(5),
                            updated_date DATE DEFAULT CURRENT_DATE,
                            PRIMARY KEY (zip5, plus4_low, plus4_high)
                        )
                    `);

                    // Create indexes for fast lookups
                    this.db.run(`
                        CREATE INDEX IF NOT EXISTS idx_zip4_lookup 
                        ON zip4_districts(zip5, plus4_low, plus4_high)
                    `);

                    // Lookup history table (for tracking and analysis)
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS lookup_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            address TEXT,
                            zip5 CHAR(5),
                            zip4 CHAR(4),
                            state_code CHAR(2),
                            district_number CHAR(2),
                            method TEXT,
                            success INTEGER,
                            lookup_date DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    // Batch processing results table
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS batch_results (
                            batch_id TEXT NOT NULL,
                            address TEXT,
                            zip5 CHAR(5),
                            zip4 CHAR(4),
                            state_code CHAR(2),
                            district_number CHAR(2),
                            county_fips CHAR(5),
                            census_district CHAR(2),
                            match_status TEXT,
                            confidence INTEGER,
                            processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (batch_id, address)
                        )
                    `);
                });

                resolve();
            });
        });
    }

    /**
     * Look up congressional district from ZIP+4
     */
    async lookupDistrict(zip5, zip4) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT state_code, district_number, county_fips
                FROM zip4_districts
                WHERE zip5 = ?
                AND plus4_low <= ?
                AND plus4_high >= ?
                LIMIT 1
            `;

            this.db.get(query, [zip5, zip4, zip4], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            });
        });
    }

    /**
     * Insert ZIP+4 to district mapping
     */
    async insertMapping(mapping) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO zip4_districts 
                (zip5, plus4_low, plus4_high, state_code, district_number, county_fips)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                mapping.zip5,
                mapping.plus4_low,
                mapping.plus4_high,
                mapping.state_code,
                mapping.district_number,
                mapping.county_fips
            ], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
    }

    /**
     * Bulk insert mappings (for initial data load)
     */
    async bulkInsertMappings(mappings) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO zip4_districts 
                (zip5, plus4_low, plus4_high, state_code, district_number, county_fips)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            let inserted = 0;
            for (const mapping of mappings) {
                stmt.run([
                    mapping.zip5,
                    mapping.plus4_low,
                    mapping.plus4_high,
                    mapping.state_code,
                    mapping.district_number,
                    mapping.county_fips
                ], (err) => {
                    if (err) console.error('Insert error:', err);
                    else inserted++;
                });
            }

            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve(inserted);
            });
        });
    }

    /**
     * Log lookup attempt
     */
    async logLookup(lookupData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO lookup_history 
                (address, zip5, zip4, state_code, district_number, method, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                lookupData.address,
                lookupData.zip5,
                lookupData.zip4,
                lookupData.state_code,
                lookupData.district_number,
                lookupData.method,
                lookupData.success ? 1 : 0
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Save batch processing results
     */
    async saveBatchResults(batchId, results) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO batch_results 
                (batch_id, address, zip5, zip4, state_code, district_number, 
                 county_fips, census_district, match_status, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            let saved = 0;
            for (const result of results) {
                stmt.run([
                    batchId,
                    result.address,
                    result.zip5,
                    result.zip4,
                    result.state_code,
                    result.district_number,
                    result.county_fips,
                    result.census_district,
                    result.match_status,
                    result.confidence
                ], (err) => {
                    if (err) console.error('Batch save error:', err);
                    else saved++;
                });
            }

            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve(saved);
            });
        });
    }

    /**
     * Get batch results
     */
    async getBatchResults(batchId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM batch_results 
                WHERE batch_id = ?
                ORDER BY processed_date
            `;

            this.db.all(query, [batchId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Get lookup statistics
     */
    async getStatistics() {
        return new Promise((resolve, reject) => {
            const queries = {
                totalLookups: 'SELECT COUNT(*) as count FROM lookup_history',
                successfulLookups: 'SELECT COUNT(*) as count FROM lookup_history WHERE success = 1',
                uniqueAddresses: 'SELECT COUNT(DISTINCT address) as count FROM lookup_history',
                recentLookups: `
                    SELECT * FROM lookup_history 
                    ORDER BY lookup_date DESC 
                    LIMIT 10
                `,
                districtCounts: `
                    SELECT zip5, COUNT(*) as count 
                    FROM zip4_districts 
                    GROUP BY zip5 
                    ORDER BY count DESC 
                    LIMIT 10
                `
            };

            const stats = {};
            const queryPromises = Object.entries(queries).map(([key, query]) => {
                return new Promise((res, rej) => {
                    if (key.includes('Lookups') || key.includes('Addresses')) {
                        this.db.get(query, (err, row) => {
                            if (err) rej(err);
                            else {
                                stats[key] = row.count;
                                res();
                            }
                        });
                    } else {
                        this.db.all(query, (err, rows) => {
                            if (err) rej(err);
                            else {
                                stats[key] = rows;
                                res();
                            }
                        });
                    }
                });
            });

            Promise.all(queryPromises)
                .then(() => resolve(stats))
                .catch(reject);
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseService;