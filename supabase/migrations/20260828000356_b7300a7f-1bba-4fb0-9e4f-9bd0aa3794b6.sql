CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My studio',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_owner_unique ON public.teams(owner_id);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz
);
CREATE UNIQUE INDEX team_members_team_email_unique ON public.team_members(team_id, lower(invited_email));
CREATE UNIQUE INDEX team_members_team_user_unique ON public.team_members(team_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX team_members_user_idx ON public.team_members(user_id);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reports_team_idx ON public.reports(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members m WHERE m.team_id = _team_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.claim_team_invites(_user_id uuid, _email text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated integer;
BEGIN
  UPDATE public.team_members
     SET user_id = _user_id, joined_at = COALESCE(joined_at, now())
   WHERE user_id IS NULL
     AND lower(invited_email) = lower(_email)
     AND NOT EXISTS (
       SELECT 1 FROM public.team_members existing
        WHERE existing.team_id = public.team_members.team_id
          AND existing.user_id = _user_id
     );
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their team" ON public.teams FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members can view their team" ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Owners manage members" ON public.team_members FOR ALL TO authenticated
  USING (public.is_team_owner(team_id, auth.uid())) WITH CHECK (public.is_team_owner(team_id, auth.uid()));
CREATE POLICY "Members can view teammates" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Teammates can view shared reports" ON public.reports FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()));