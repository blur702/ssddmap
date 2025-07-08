-- Congressional Districts Database Schema

-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- States table
CREATE TABLE states (
    state_code CHAR(2) PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL,
    is_at_large BOOLEAN DEFAULT FALSE,
    representative_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Congressional districts table
CREATE TABLE districts (
    id SERIAL PRIMARY KEY,
    state_code CHAR(2) NOT NULL REFERENCES states(state_code),
    district_number INTEGER NOT NULL,
    is_at_large BOOLEAN DEFAULT FALSE,
    geometry GEOMETRY(Geometry, 4326) NOT NULL,
    area_sq_km DECIMAL(10, 2),
    perimeter_km DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state_code, district_number)
);

-- House members table
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    state_code CHAR(2) NOT NULL REFERENCES states(state_code),
    district_number INTEGER NOT NULL,
    office_id VARCHAR(10) UNIQUE,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    party CHAR(1) CHECK (party IN ('D', 'R', 'I', 'L', 'G')),
    phone VARCHAR(20),
    website VARCHAR(255),
    contact_form_url VARCHAR(255),
    photo_url VARCHAR(255),
    office_room VARCHAR(100),
    office_building VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_code, district_number) REFERENCES districts(state_code, district_number)
);

-- Social media accounts
CREATE TABLE member_social_media (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    url VARCHAR(255),
    username VARCHAR(100),
    UNIQUE(member_id, platform)
);

-- Counties table
CREATE TABLE counties (
    id SERIAL PRIMARY KEY,
    state_code CHAR(2) NOT NULL REFERENCES states(state_code),
    county_fips CHAR(5) UNIQUE NOT NULL,
    county_name VARCHAR(100) NOT NULL,
    geometry GEOMETRY(Geometry, 4326) NOT NULL,
    population INTEGER,
    area_sq_km DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- County-District relationship (many-to-many as counties can span districts)
CREATE TABLE county_district_mapping (
    county_fips CHAR(5) NOT NULL REFERENCES counties(county_fips),
    state_code CHAR(2) NOT NULL,
    district_number INTEGER NOT NULL,
    overlap_percentage DECIMAL(5, 2),
    PRIMARY KEY (county_fips, state_code, district_number),
    FOREIGN KEY (state_code, district_number) REFERENCES districts(state_code, district_number)
);

-- Committee assignments
CREATE TABLE committees (
    id SERIAL PRIMARY KEY,
    committee_code VARCHAR(10) UNIQUE,
    committee_name VARCHAR(255) NOT NULL,
    chamber VARCHAR(10) CHECK (chamber IN ('house', 'senate', 'joint'))
);

CREATE TABLE member_committees (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    committee_id INTEGER NOT NULL REFERENCES committees(id),
    role VARCHAR(50),
    PRIMARY KEY (member_id, committee_id)
);

-- Bills/Legislation (basic structure for vote tracking)
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    bill_id VARCHAR(20) UNIQUE NOT NULL,
    congress INTEGER NOT NULL,
    title TEXT NOT NULL,
    short_title VARCHAR(500),
    introduced_date DATE,
    sponsor_id INTEGER REFERENCES members(id),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data sync tracking
CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    sync_status VARCHAR(20) NOT NULL,
    records_processed INTEGER,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Create spatial indexes for fast geographic queries
CREATE INDEX idx_districts_geometry ON districts USING GIST (geometry);
CREATE INDEX idx_counties_geometry ON counties USING GIST (geometry);

-- Create regular indexes for common queries
CREATE INDEX idx_members_state_district ON members(state_code, district_number);
CREATE INDEX idx_members_party ON members(party);
CREATE INDEX idx_counties_state ON counties(state_code);
CREATE INDEX idx_county_district_mapping ON county_district_mapping(state_code, district_number);

-- Function to find district by coordinates
CREATE OR REPLACE FUNCTION find_district_by_coords(lon DECIMAL, lat DECIMAL)
RETURNS TABLE (
    state_code CHAR(2),
    district_number INTEGER,
    is_at_large BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT d.state_code, d.district_number, d.is_at_large
    FROM districts d
    WHERE ST_Contains(d.geometry, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find counties in a district
CREATE OR REPLACE FUNCTION find_counties_in_district(p_state_code CHAR(2), p_district_number INTEGER)
RETURNS TABLE (
    county_fips CHAR(5),
    county_name VARCHAR(100),
    overlap_percentage DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.county_fips, c.county_name, cdm.overlap_percentage
    FROM counties c
    JOIN county_district_mapping cdm ON c.county_fips = cdm.county_fips
    WHERE cdm.state_code = p_state_code 
    AND cdm.district_number = p_district_number
    ORDER BY cdm.overlap_percentage DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_states_updated_at BEFORE UPDATE ON states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counties_updated_at BEFORE UPDATE ON counties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();