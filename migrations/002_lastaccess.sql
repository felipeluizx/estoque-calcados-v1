-- 002_lastaccess.sql
-- Add lastAccess to inventory and an index to speed popularity queries.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

ALTER TABLE inventory ADD COLUMN lastAccess TEXT DEFAULT NULL;

-- Backfill current rows with now() so we have a baseline
UPDATE inventory SET lastAccess = COALESCE(lastAccess, datetime('now'));

CREATE INDEX IF NOT EXISTS idx_inventory_lastaccess ON inventory(lastAccess);

COMMIT;
