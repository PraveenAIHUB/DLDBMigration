-- Add is_winner field to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false;

-- Create index for winner queries
CREATE INDEX IF NOT EXISTS idx_bids_is_winner ON bids(is_winner) WHERE is_winner = true;

-- Add comment
COMMENT ON COLUMN bids.is_winner IS 'Marks the winning bid for a car. Only one bid per car should be marked as winner.';

