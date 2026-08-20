CREATE TABLE public.auth_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('start','success','error','timeout','redirected')),
  reason TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX auth_events_created_at_idx ON public.auth_events (created_at DESC);
CREATE INDEX auth_events_event_idx ON public.auth_events (event);