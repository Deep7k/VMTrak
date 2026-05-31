-- Add must_change_password flag to users
-- Migration 003

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
