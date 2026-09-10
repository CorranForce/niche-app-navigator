CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = _team_id AND m.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_team_owner(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.owner_id = _user_id)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_team_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_owner(uuid, uuid) TO authenticated, service_role;

-- Repoint policies at the private helpers
DROP POLICY IF EXISTS "Admins read auth events" ON public.auth_events;
CREATE POLICY "Admins read auth events" ON public.auth_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read system events" ON public.system_events;
CREATE POLICY "Admins read system events" ON public.system_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins read webhook replays" ON public.webhook_replays;
CREATE POLICY "Admins read webhook replays" ON public.webhook_replays FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Teammates can view shared reports" ON public.reports;
CREATE POLICY "Teammates can view shared reports" ON public.reports FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND private.is_team_member(team_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view teammates" ON public.team_members;
CREATE POLICY "Members can view teammates" ON public.team_members FOR SELECT TO authenticated
  USING (private.is_team_member(team_id, auth.uid()));

DROP POLICY IF EXISTS "Owners manage members" ON public.team_members;
CREATE POLICY "Owners manage members" ON public.team_members FOR ALL TO authenticated
  USING (private.is_team_owner(team_id, auth.uid()))
  WITH CHECK (private.is_team_owner(team_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their team" ON public.teams;
CREATE POLICY "Members can view their team" ON public.teams FOR SELECT TO authenticated
  USING (private.is_team_member(id, auth.uid()));

-- Public helpers stay for service-role RPC use only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid, uuid) TO service_role;

-- Pricing catalog: no direct client reads; the app serves it server-side
DROP POLICY IF EXISTS "Catalog is publicly readable" ON public.billing_catalog;
REVOKE SELECT ON public.billing_catalog FROM anon, authenticated;
GRANT ALL ON public.billing_catalog TO service_role;