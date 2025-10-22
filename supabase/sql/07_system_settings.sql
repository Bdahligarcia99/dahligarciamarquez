-- System Settings Table
-- Stores persistent system-wide configuration settings

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS system_settings_key_idx ON system_settings(key);

-- Insert default settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('coming_soon_mode', 'false', 'Enable Coming Soon mode to block non-admin traffic')
ON CONFLICT (key) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();

COMMENT ON TABLE system_settings IS 'System-wide configuration settings that persist across server restarts';

