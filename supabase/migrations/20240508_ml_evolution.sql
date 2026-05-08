-- Upgrade Call History for ML Signals
ALTER TABLE call_history 
ADD COLUMN IF NOT EXISTS ml_risk_score INTEGER,
ADD COLUMN IF NOT EXISTS ml_confidence FLOAT,
ADD COLUMN IF NOT EXISTS ml_signals JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS is_synthetic_voice BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Enhance Caller Profiles for AI Reputation
ALTER TABLE caller_profiles
ADD COLUMN IF NOT EXISTS ai_reputation_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS behavioral_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index for faster caller lookups during analysis
CREATE INDEX IF NOT EXISTS idx_call_history_caller_id ON call_history(caller_id);
