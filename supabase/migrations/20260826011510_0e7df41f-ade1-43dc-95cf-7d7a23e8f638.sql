DROP FUNCTION IF EXISTS public.admin_mcp_clients();
DROP FUNCTION IF EXISTS public.admin_mcp_consents(integer);
DROP FUNCTION IF EXISTS public.admin_mcp_authorization_stats(integer);

CREATE OR REPLACE FUNCTION public.admin_mcp_clients(_actor uuid)
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
  IF NOT public.has_role(_actor, 'admin') THEN
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

CREATE OR REPLACE FUNCTION public.admin_mcp_consents(_actor uuid, _limit integer DEFAULT 50)
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
  IF NOT public.has_role(_actor, 'admin') THEN
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

CREATE OR REPLACE FUNCTION public.admin_mcp_authorization_stats(_actor uuid, _days integer DEFAULT 30)
RETURNS TABLE (status text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN
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

REVOKE ALL ON FUNCTION public.admin_mcp_clients(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mcp_consents(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mcp_authorization_stats(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_mcp_clients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mcp_consents(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mcp_authorization_stats(uuid, integer) TO service_role;