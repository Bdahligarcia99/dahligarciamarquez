-- Image Reconciliation Log Table
-- Tracks history of reconciliation runs

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS image_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  posts_processed INTEGER DEFAULT 0,
  images_found INTEGER DEFAULT 0,
  images_added INTEGER DEFAULT 0,
  images_removed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_started_at 
  ON image_reconciliation_log(started_at DESC);

-- Enable RLS
ALTER TABLE image_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role can always access)
-- No policies needed for anon/authenticated since this is admin-only via service role

-- Grant permissions
GRANT ALL ON image_reconciliation_log TO authenticated;
GRANT ALL ON image_reconciliation_log TO service_role;
