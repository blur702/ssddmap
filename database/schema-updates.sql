-- Add subcommittees table
CREATE TABLE IF NOT EXISTS subcommittees (
    id SERIAL PRIMARY KEY,
    subcommittee_code VARCHAR(10) UNIQUE,
    committee_id INTEGER REFERENCES committees(id),
    subcommittee_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add member_subcommittees junction table
CREATE TABLE IF NOT EXISTS member_subcommittees (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    subcommittee_id INTEGER NOT NULL REFERENCES subcommittees(id),
    role VARCHAR(50),
    rank INTEGER,
    PRIMARY KEY (member_id, subcommittee_id)
);

-- Add additional fields to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS bioguide_id VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS housegov_display_name VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS courtesy VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS formal_name VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS elected_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS sworn_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS townname VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS office_zip VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS office_zip_suffix VARCHAR(10);

-- Add rank to member_committees
ALTER TABLE member_committees ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Create index for bioguide_id
CREATE INDEX IF NOT EXISTS idx_members_bioguide_id ON members(bioguide_id);

-- Add table for raw JSON data cache
CREATE TABLE IF NOT EXISTS house_json_cache (
    id SERIAL PRIMARY KEY,
    fetch_date DATE NOT NULL UNIQUE,
    json_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_state_district ON members(state_code, district_number);
CREATE INDEX IF NOT EXISTS idx_subcommittees_committee ON subcommittees(committee_id);