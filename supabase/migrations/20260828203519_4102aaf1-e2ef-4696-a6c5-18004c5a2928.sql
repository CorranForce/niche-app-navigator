create or replace function public.function_grant_audit(_functions text[], _roles text[])
returns table(fn text, signature text, role_name text, can_execute boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.proname::text as fn,
         p.oid::regprocedure::text as signature,
         r.role_name,
         has_function_privilege(r.role_name, p.oid, 'EXECUTE') as can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(_roles) as r(role_name)
  where n.nspname = 'public'
    and p.proname = any(_functions)
$$;

revoke all on function public.function_grant_audit(text[], text[]) from public, anon, authenticated;
grant execute on function public.function_grant_audit(text[], text[]) to service_role;