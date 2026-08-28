REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_team_owner(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.claim_team_invites(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_team_invites(uuid, text) TO service_role;