-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default telegram settings
INSERT INTO settings (key, value) VALUES (
  'telegram',
  '{"botToken":"","adminChatId":"2102262384","notifications":{"deviceOnline":true,"deviceOffline":true,"newDeviceRegistered":true,"agentUninstalled":true,"agentReinstalled":true,"newUserRegistered":true,"enabled":true}}'
) ON CONFLICT (key) DO NOTHING;
