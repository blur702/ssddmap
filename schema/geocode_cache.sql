-- Geocoding cache table
CREATE TABLE IF NOT EXISTS geocode_cache (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    geocoder VARCHAR(50) NOT NULL, -- 'census', 'nominatim', etc.
    results JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_geocode_cache_address_geocoder ON geocode_cache(address, geocoder);

-- Index for cache cleanup (removing old entries)
CREATE INDEX IF NOT EXISTS idx_geocode_cache_accessed ON geocode_cache(accessed_at);

-- Function to update accessed_at on cache hit
CREATE OR REPLACE FUNCTION update_geocode_cache_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;