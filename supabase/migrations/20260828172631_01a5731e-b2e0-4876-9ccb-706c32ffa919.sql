REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

-- Self-scoped entitlement lookup: hard-fail when there is no signed-in user.
CREATE OR REPLACE FUNCTION public.my_effective_subscription(_env text)
 RETURNS TABLE(status text, product_id text, current_period_end timestamp with time zone, source text, owner_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with caller as (
    select auth.uid() as uid where auth.uid() is not null
  ),
  me as (
    select s.status, s.product_id, s.current_period_end, 'own'::text as source, s.user_id as owner_id, s.created_at
    from public.subscriptions s
    join caller c on c.uid = s.user_id
    where s.environment = _env
    order by s.created_at desc
    limit 1
  ),
  inherited as (
    select s.status, s.product_id, s.current_period_end, 'team'::text as source, s.user_id as owner_id, s.created_at
    from public.team_members m
    join caller c on c.uid = m.user_id
    join public.teams t on t.id = m.team_id
    join public.subscriptions s on s.user_id = t.owner_id and s.environment = _env
    where s.product_id = 'studio_plan'
      and (
        (s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
    order by s.created_at desc
    limit 1
  )
  select status, product_id, current_period_end, source, owner_id from me
  union all
  select status, product_id, current_period_end, source, owner_id from inherited
  where not exists (
    select 1 from me
    where (me.status in ('active','trialing') and (me.current_period_end is null or me.current_period_end > now()))
       or (me.status = 'canceled' and me.current_period_end > now())
  )
  limit 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_effective_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_effective_subscription(text) TO authenticated, service_role;