-- Migration 005: add per-user expiry notification toggle
ALTER TABLE users ADD COLUMN notify_expiry INTEGER NOT NULL DEFAULT 0;
