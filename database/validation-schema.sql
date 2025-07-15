-- Additional schema for address validation features

-- ZIP+4 to district mapping table
CREATE TABLE IF NOT EXISTS zip4_districts (
    id SERIAL PRIMARY KEY,
    zip5 CHAR(5) NOT NULL,
    zip4 CHAR(4) NOT NULL,
    state_code CHAR(2) NOT NULL REFERENCES states(state_code),
    district_number INTEGER NOT NULL,
    county_fips CHAR(5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zip5, zip4)
);

-- Address validation log table
CREATE TABLE IF NOT EXISTS address_validation_log (
    id SERIAL PRIMARY KEY,
    input_address TEXT NOT NULL,
    validation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usps_success BOOLEAN,
    usps_district VARCHAR(10),
    census_success BOOLEAN,
    census_district VARCHAR(10),
    google_success BOOLEAN,
    google_district VARCHAR(10),
    consistency_status VARCHAR(20),
    distance_to_boundary_meters DECIMAL(10, 2),
    user_ip INET,
    session_id VARCHAR(100)
);

-- Geocoding cache table for performance
CREATE TABLE IF NOT EXISTS geocode_cache (
    id SERIAL PRIMARY KEY,
    address_hash CHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of normalized address
    original_address TEXT NOT NULL,
    geocoder_source VARCHAR(20) NOT NULL, -- 'census', 'google', etc.
    latitude DECIMAL(10, 7),
    longitude DECIMAL(11, 7),
    standardized_address TEXT,
    confidence_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip4_districts_zip ON zip4_districts(zip5, zip4);
CREATE INDEX IF NOT EXISTS idx_zip4_districts_state_district ON zip4_districts(state_code, district_number);
CREATE INDEX IF NOT EXISTS idx_validation_log_timestamp ON address_validation_log(validation_timestamp);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_hash ON geocode_cache(address_hash);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_expires ON geocode_cache(expires_at);

-- Function to clean expired geocode cache entries
CREATE OR REPLACE FUNCTION clean_expired_geocode_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM geocode_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log address validation attempts
CREATE OR REPLACE FUNCTION log_address_validation(
    p_input_address TEXT,
    p_usps_success BOOLEAN DEFAULT NULL,
    p_usps_district VARCHAR(10) DEFAULT NULL,
    p_census_success BOOLEAN DEFAULT NULL,
    p_census_district VARCHAR(10) DEFAULT NULL,
    p_google_success BOOLEAN DEFAULT NULL,
    p_google_district VARCHAR(10) DEFAULT NULL,
    p_consistency_status VARCHAR(20) DEFAULT NULL,
    p_distance_to_boundary DECIMAL(10, 2) DEFAULT NULL,
    p_user_ip INET DEFAULT NULL,
    p_session_id VARCHAR(100) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO address_validation_log (
        input_address,
        usps_success,
        usps_district,
        census_success,
        census_district,
        google_success,
        google_district,
        consistency_status,
        distance_to_boundary_meters,
        user_ip,
        session_id
    ) VALUES (
        p_input_address,
        p_usps_success,
        p_usps_district,
        p_census_success,
        p_census_district,
        p_google_success,
        p_google_district,
        p_consistency_status,
        p_distance_to_boundary,
        p_user_ip,
        p_session_id
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create geocode cache entry
CREATE OR REPLACE FUNCTION get_geocode_cache(
    p_address_hash CHAR(64),
    p_geocoder_source VARCHAR(20)
)
RETURNS TABLE (
    latitude DECIMAL(10, 7),
    longitude DECIMAL(11, 7),
    standardized_address TEXT,
    confidence_score DECIMAL(3, 2),
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gc.latitude,
        gc.longitude,
        gc.standardized_address,
        gc.confidence_score,
        gc.created_at
    FROM geocode_cache gc
    WHERE gc.address_hash = p_address_hash 
    AND gc.geocoder_source = p_geocoder_source
    AND gc.expires_at > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to store geocode cache entry
CREATE OR REPLACE FUNCTION store_geocode_cache(
    p_address_hash CHAR(64),
    p_original_address TEXT,
    p_geocoder_source VARCHAR(20),
    p_latitude DECIMAL(10, 7),
    p_longitude DECIMAL(11, 7),
    p_standardized_address TEXT DEFAULT NULL,
    p_confidence_score DECIMAL(3, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO geocode_cache (
        address_hash,
        original_address,
        geocoder_source,
        latitude,
        longitude,
        standardized_address,
        confidence_score
    ) VALUES (
        p_address_hash,
        p_original_address,
        p_geocoder_source,
        p_latitude,
        p_longitude,
        p_standardized_address,
        p_confidence_score
    ) ON CONFLICT (address_hash) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        standardized_address = EXCLUDED.standardized_address,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamps for validation tables
CREATE TRIGGER update_zip4_districts_updated_at 
    BEFORE UPDATE ON zip4_districts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geocode_cache_updated_at 
    BEFORE UPDATE ON geocode_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();