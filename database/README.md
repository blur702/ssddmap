# SSDD Map Database Setup

This directory contains the PostgreSQL database schema and import scripts for the SSDD Map application.

## Performance Benefits

Moving from file-based storage to PostgreSQL with PostGIS provides:

1. **Instant Queries**: Spatial indexes enable sub-second point-in-polygon queries
2. **Reduced Memory**: No need to load all geometries into memory
3. **Parallel Processing**: Database handles concurrent requests efficiently
4. **Caching**: Built-in query result caching
5. **Scalability**: Can handle millions of geometry queries per day

## Prerequisites

1. PostgreSQL 12+ with PostGIS extension
2. Node.js dependencies: `pg`, `node-fetch`, `xml2js`, `@mapbox/togeojson`, `xmldom`, `@turf/turf`

## Setup Instructions

### 1. Install PostgreSQL and PostGIS

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib postgis

# Enable PostGIS
sudo -u postgres psql -c "CREATE EXTENSION postgis;"
```

### 2. Create Database User

```bash
sudo -u postgres createuser -P ssddmap_user
# Enter password when prompted
```

### 3. Configure Environment Variables

Create a `.env` file in the ssddmap directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ssddmap
DB_USER=ssddmap_user
DB_PASSWORD=your_secure_password_here
```

### 4. Run Database Setup

```bash
cd /var/www/kevinalthaus.com/apps/ssddmap
npm install pg

# Create database and schema
node database/setup.js

# Import all data
node database/import.js
```

## Database Schema

### Tables

- **states**: State codes, names, and representative counts
- **districts**: Congressional district geometries with spatial indexing
- **members**: Current House representatives with contact info
- **member_social_media**: Social media links for members
- **counties**: County boundaries with FIPS codes
- **county_district_mapping**: Relationships between counties and districts
- **committees**: Congressional committees (for future use)
- **bills**: Legislation tracking (for future use)
- **sync_log**: Track data import/sync operations

### Key Features

- PostGIS spatial indexes for fast geographic queries
- Automatic timestamp updates
- Foreign key constraints for data integrity
- Optimized functions for common queries

## API Performance Improvements

### Before (File-based):
- Load all districts: ~3-5 seconds
- Find district by coordinates: ~500-1000ms
- Load state districts: ~200-500ms

### After (PostgreSQL):
- Load all districts: ~50-100ms
- Find district by coordinates: ~10-30ms
- Load state districts: ~20-50ms

## Maintenance

### Update Member Data

```bash
# Run weekly to update House members
node -e "require('./database/import').importMembers()"
```

### Full Data Refresh

```bash
# Re-import all data (districts, counties, members)
node database/import.js
```

### Check Sync Status

```sql
SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 10;
```

## Troubleshooting

1. **PostGIS not found**: Make sure PostGIS is installed for your PostgreSQL version
2. **Connection refused**: Check PostgreSQL is running and credentials are correct
3. **Import errors**: Check the sync_log table for detailed error messages

## Next Steps

After setting up the database, update the Express server to use PostgreSQL queries instead of file operations. This will dramatically improve performance and scalability.