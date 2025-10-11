-- Update auth schema to use Google OAuth (not Firebase)
-- Changes firebase_uid to google_id

ALTER TABLE auth.users RENAME COLUMN firebase_uid TO google_id;

COMMENT ON COLUMN auth.users.google_id IS 'Google OAuth subject ID (unique identifier from Google)';

-- Index is automatically renamed, but let's be explicit
DROP INDEX IF EXISTS idx_users_firebase_uid;
CREATE UNIQUE INDEX idx_users_google_id ON auth.users(google_id);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'google_id';
