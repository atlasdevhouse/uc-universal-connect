-- UC Universal Connect - Supabase Schema v2
-- Full SaaS with users, subscriptions, install tokens

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  subscription TEXT DEFAULT 'free' CHECK (subscription IN ('free', 'basic', 'pro')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  install_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Seed admin (Jay)
INSERT INTO users (telegram_chat_id, telegram_username, display_name, role, subscription, status)
VALUES ('2102262384', 'corporallupin', 'Jay', 'admin', 'pro', 'active')
ON CONFLICT (telegram_chat_id) DO NOTHING;

-- Add user_id to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS install_token TEXT;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Allow all on devices" ON devices;
DROP POLICY IF EXISTS "Allow all on screenshots" ON screenshots;
DROP POLICY IF EXISTS "Allow all on commands" ON commands;

-- Recreate open policies (tighten later)
CREATE POLICY "devices_all" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "screenshots_all" ON screenshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "commands_all" ON commands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
