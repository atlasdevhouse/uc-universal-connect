-- UC Universal Connect - Supabase Schema
-- Run this in Supabase SQL Editor

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  os TEXT,
  ip TEXT,
  public_ip TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'online',
  user_id TEXT DEFAULT 'jay',
  username TEXT,
  version TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Screenshots table (latest per device)
CREATE TABLE IF NOT EXISTS screenshots (
  device_id TEXT PRIMARY KEY REFERENCES devices(id),
  image TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command queue
CREATE TABLE IF NOT EXISTS commands (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  action TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consumed BOOLEAN DEFAULT FALSE
);

-- Auto-update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devices_update_last_seen
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();

-- Index for command polling
CREATE INDEX IF NOT EXISTS idx_commands_device_unconsumed 
  ON commands(device_id) WHERE consumed = FALSE;

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now via anon key - tighten later)
CREATE POLICY "Allow all on devices" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on screenshots" ON screenshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on commands" ON commands FOR ALL USING (true) WITH CHECK (true);
