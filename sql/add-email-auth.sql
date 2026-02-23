-- Run in Supabase SQL Editor
-- Add email/password columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make telegram_chat_id optional (no longer required for signup)
ALTER TABLE users ALTER COLUMN telegram_chat_id DROP NOT NULL;
