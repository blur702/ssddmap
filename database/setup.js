const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ssddmap',
    user: process.env.DB_USER || 'ssddmap_user',
    password: process.env.DB_PASSWORD || 'your_password_here'
};

async function createDatabase() {
    // Connect to postgres database to create new database
    const adminPool = new Pool({
        ...dbConfig,
        database: 'postgres'
    });

    try {
        // Check if database exists
        const dbCheck = await adminPool.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbConfig.database]
        );

        if (dbCheck.rows.length === 0) {
            // Create database
            await adminPool.query(`CREATE DATABASE ${dbConfig.database}`);
            console.log(`Database ${dbConfig.database} created successfully`);
        } else {
            console.log(`Database ${dbConfig.database} already exists`);
        }
    } catch (error) {
        console.error('Error creating database:', error);
        throw error;
    } finally {
        await adminPool.end();
    }
}

async function runSchema() {
    const pool = new Pool(dbConfig);

    try {
        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Split by semicolons and execute each statement
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.query(statement);
            }
        }
        
        console.log('Schema created successfully');
    } catch (error) {
        console.error('Error creating schema:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

async function setup() {
    try {
        console.log('Setting up SSDD Map database...');
        // Skip database creation if it already exists
        try {
            await createDatabase();
        } catch (error) {
            if (error.code === '42P04') {
                console.log('Database already exists, continuing...');
            } else {
                console.log('Database creation skipped, continuing with schema...');
            }
        }
        await runSchema();
        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setup();
}

module.exports = { createDatabase, runSchema };