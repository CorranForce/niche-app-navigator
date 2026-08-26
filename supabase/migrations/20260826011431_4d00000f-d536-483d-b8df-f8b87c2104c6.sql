CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('webhook','oauth','consent','mcp','email','other')),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  event text NOT NULL,
  message text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read system events" ON public.system_events;
CREATE POLICY "Admins read system events"
  ON public.system_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS system_events_created_idx ON public.system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_source_idx ON public.system_events (source, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_mcp_clients()
RETURNS TABLE (
  id uuid,
  client_name text,
  client_uri text,
  registration_type text,
  created_at timestamptz,
  consents bigint,
  active_consents bigint,
  last_granted_at timestamptz,
  authorizations bigint,
  approved_authorizations bigint,
  last_authorized_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT c.id,
         c.client_name,
         c.client_uri,
         c.registration_type::text,
         c.created_at,
         count(DISTINCT co.id),
         count(DISTINCT co.id) FILTER (WHERE co.revoked_at IS NULL),
         max(co.granted_at),
         count(DISTINCT a.id),
         count(DISTINCT a.id) FILTER (WHERE a.approved_at IS NOT NULL),
         max(a.created_at)
  FROM auth.oauth_clients c
  LEFT JOIN auth.oauth_consents co ON co.client_id = c.id
  LEFT JOIN auth.oauth_authorizations a ON a.client_id = c.id
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.client_name, c.client_uri, c.registration_type, c.created_at
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mcp_consents(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  client_name text,
  user_email text,
  scopes text,
  granted_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT co.id,
         c.client_name,
         u.email::text,
         co.scopes,
         co.granted_at,
         co.revoked_at
  FROM auth.oauth_consents co
  JOIN auth.oauth_clients c ON c.id = co.client_id
  LEFT JOIN auth.users u ON u.id = co.user_id
  ORDER BY COALESCE(co.revoked_at, co.granted_at) DESC
  LIMIT LEAST(GREATEST(_limit, 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mcp_authorization_stats(_days integer DEFAULT 30)
RETURNS TABLE (status text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT a.status::text, count(*)
  FROM auth.oauth_authorizations a
  WHERE a.created_at > now() - make_interval(days => LEAST(GREATEST(_days, 1), 365))
  GROUP BY a.status
  ORDER BY 2 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mcp_clients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mcp_consents(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mcp_authorization_stats(integer) TO authenticated;