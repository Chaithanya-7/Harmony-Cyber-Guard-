-- Create blocklist table for blocked numbers
CREATE TABLE public.blocked_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_count INTEGER DEFAULT 1,
  UNIQUE(user_id, phone_number)
);

-- Enable RLS
ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their blocked numbers" 
ON public.blocked_numbers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can block numbers" 
ON public.blocked_numbers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unblock numbers" 
ON public.blocked_numbers 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update blocked numbers" 
ON public.blocked_numbers 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create text_messages table for message analysis
CREATE TABLE public.text_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sender_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  is_cyberbullying BOOLEAN DEFAULT false,
  threat_level TEXT DEFAULT 'safe',
  detected_indicators TEXT[] DEFAULT '{}',
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their messages" 
ON public.text_messages 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add messages" 
ON public.text_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete messages" 
ON public.text_messages 
FOR DELETE 
USING (auth.uid() = user_id);