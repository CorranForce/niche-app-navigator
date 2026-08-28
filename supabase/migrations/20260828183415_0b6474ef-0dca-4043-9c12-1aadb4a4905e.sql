-- 1. auth_events: admin-only read access
GRANT SELECT ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;

CREATE POLICY "Admins read auth events"
  ON public.auth_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. system_events: writes are intentionally service-role only (trusted server code).
GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
COMMENT ON TABLE public.system_events IS
  'Server-side monitoring sink. Inserts/updates are intentionally restricted to service_role (trusted server code only); admins may read via the "Admins read system events" policy.';

-- 3. Replace the user-callable SECURITY DEFINER entitlement function with a
--    service-role-only variant invoked from verified server functions.
DROP FUNCTION IF EXISTS public.my_effective_subscription(text);

CREATE OR REPLACE FUNCTION public.effective_subscription_for(_user_id uuid, _env text)
RETURNS TABLE(status text, product_id text, current_period_end timestamp with time zone, source text, owner_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with me as (
    select s.status, s.product_id, s.current_period_end, 'own'::text as source, s.user_id as owner_id, s.created_at
    from public.subscriptions s
    where s.user_id = _user_id and s.environment = _env
    order by s.created_at desc
    limit 1
  ),
  inherited as (
    select s.status, s.product_id, s.current_period_end, 'team'::text as source, s.user_id as owner_id, s.created_at
    from public.team_members m
    join public.teams t on t.id = m.team_id
    join public.subscriptions s on s.user_id = t.owner_id and s.environment = _env
    where m.user_id = _user_id
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

REVOKE ALL ON FUNCTION public.effective_subscription_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_subscription_for(uuid, text) TO service_role;