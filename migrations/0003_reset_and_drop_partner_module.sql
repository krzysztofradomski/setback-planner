-- 2026-11-28: the owner asked to wipe all saved test data and drop the removed partner module.
-- Users and sessions go too, so a new first owner can be created with BOOTSTRAP_SECRET.
DELETE FROM rate_limits;
DELETE FROM funnel;
DROP TABLE IF EXISTS audit;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS ai_cache;
DROP TABLE IF EXISTS tenants;
-- users pointed at tenants; rebuild it for the single owner role (tenant_id kept, always NULL, for the existing queries).
DROP TABLE sessions;
DROP TABLE users;
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role = 'owner'), tenant_id TEXT CHECK(tenant_id IS NULL), active INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX one_owner ON users(role) WHERE role='owner';
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE INDEX session_expiry ON sessions(expires);
