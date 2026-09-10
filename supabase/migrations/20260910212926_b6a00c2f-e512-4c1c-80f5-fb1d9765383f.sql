CREATE OR REPLACE FUNCTION public.function_grant_audit(_functions text[], _roles text[])
RETURNS TABLE(fn text, signature text, role_name text, can_execute boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  select (n.nspname || '.' || p.proname)::text as fn,
         p.oid::regprocedure::text as signature,
         r.role_name,
         has_function_privilege(r.role_name, p.oid, 'EXECUTE') as can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(_roles) as r(role_name)
  where n.nspname in ('public','private')
    and (n.nspname || '.' || p.proname) = any(_functions)
$$;
REVOKE EXECUTE ON FUNCTION public.function_grant_audit(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.function_grant_audit(text[], text[]) TO service_role;