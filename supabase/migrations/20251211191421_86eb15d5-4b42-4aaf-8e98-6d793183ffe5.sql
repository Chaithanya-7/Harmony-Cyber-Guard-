-- Create enum for risk levels
CREATE TYPE public.risk_level AS ENUM ('safe', 'warning', 'blocked');

-- Create call_history table
CREATE TABLE public.call_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  risk_level risk_level NOT NULL DEFAULT 'safe',
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  fraud_indicators TEXT[] DEFAULT '{}',
  scenario_type TEXT,
  caller_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on call_history
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_history
CREATE POLICY "Users can view their own call history"
ON public.call_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call history"
ON public.call_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call history"
ON public.call_history
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call history"
ON public.call_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create fraud_alerts table for notifications
CREATE TABLE public.fraud_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  call_id UUID REFERENCES public.call_history(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'high_risk',
  message TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fraud_alerts
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for fraud_alerts
CREATE POLICY "Users can view their own alerts"
ON public.fraud_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
ON public.fraud_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON public.fraud_alerts
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for call_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_alerts;