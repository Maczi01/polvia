-- Create a sequence for the services table id column
CREATE SEQUENCE IF NOT EXISTS services_id_seq;

-- Set the sequence to start from the next available ID
-- Current max is 465, so we'll start from 466
SELECT setval('services_id_seq', (SELECT COALESCE(MAX(id), 0) FROM services), true);

-- Set the id column to use the sequence as default
ALTER TABLE services ALTER COLUMN id SET DEFAULT nextval('services_id_seq');

-- Make the sequence owned by the column (so it gets deleted if column is dropped)
ALTER SEQUENCE services_id_seq OWNED BY services.id;
