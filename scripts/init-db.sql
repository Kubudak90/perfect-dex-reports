-- ═══════════════════════════════════════════════════════════════
-- BaseBook DEX - Database Initialization
-- ═══════════════════════════════════════════════════════════════

-- Create databases
CREATE DATABASE basebook;
CREATE DATABASE basebook_test;

-- Connect to basebook database
\c basebook;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE basebook TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

-- Connect to test database
\c basebook_test;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE basebook_test TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
