REVOKE ALL ON public.auth_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.auth_events TO service_role;

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.auth_events
  ADD CONSTRAINT auth_events_provider_check CHECK (provider IN ('google')),
  ADD CONSTRAINT auth_events_reason_len CHECK (reason IS NULL OR char_length(reason) <= 300),
  ADD CONSTRAINT auth_events_user_agent_len CHECK (user_agent IS NULL OR char_length(user_agent) <= 400);

COMMENT ON TABLE public.auth_events IS 'Write-only sign-in telemetry. RLS enabled with no policies on purpose: no Data API role has privileges; rows are inserted only by trusted server code in /api/public/auth-event.';