-- Failed payments must not count as active access.
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','trialing') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$function$;

-- Effective entitlement for the calling user: their own latest subscription,
-- otherwise the latest subscription of a team owner whose workspace they joined.
CREATE OR REPLACE FUNCTION public.my_effective_subscription(_env text)
 RETURNS TABLE(status text, product_id text, current_period_end timestamptz, source text, owner_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select s.status, s.product_id, s.current_period_end, 'own'::text as source, s.user_id as owner_id, s.created_at
    from public.subscriptions s
    where s.user_id = auth.uid() and s.environment = _env
    order by s.created_at desc
    limit 1
  ),
  inherited as (
    select s.status, s.product_id, s.current_period_end, 'team'::text as source, s.user_id as owner_id, s.created_at
    from public.team_members m
    join public.teams t on t.id = m.team_id
    join public.subscriptions s on s.user_id = t.owner_id and s.environment = _env
    where m.user_id = auth.uid()
      and s.product_id = 'studio_plan'
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

GRANT EXECUTE ON FUNCTION public.my_effective_subscription(text) TO authenticated;