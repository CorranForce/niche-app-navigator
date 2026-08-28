CREATE TABLE public.webhook_replays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  environment text NOT NULL,
  event_type text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'pending',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, environment)
);

GRANT SELECT ON public.webhook_replays TO authenticated;
GRANT ALL ON public.webhook_replays TO service_role;

ALTER TABLE public.webhook_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook replays"
ON public.webhook_replays
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_webhook_replays_updated_at
BEFORE UPDATE ON public.webhook_replays
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();