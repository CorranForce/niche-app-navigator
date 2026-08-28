# Security findings → remediation map

Each row maps a scanner `internal_id` to the exact database policy, grant, function
change, or application change that resolved it.

| internal_id | Area | Change that fixed it |
| --- | --- | --- |
| `SUPA_authenticated_security_definer_function_executable` | Database functions | Dropped `public.my_effective_subscription()` and replaced it with `public.effective_subscription_for(_user_id uuid, _env text)` (SECURITY DEFINER, `SET search_path = public`). Migration revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` on it and on `has_active_subscription`, `claim_team_invites`, and the `admin_mcp_*` functions, granting `EXECUTE` to `service_role` only. Callers now go through `src/lib/entitlement.functions.ts`, a `requireSupabaseAuth`-gated server function that invokes the RPC with the service-role client. **Exception:** `has_role`, `is_team_member`, and `is_team_owner` keep `EXECUTE` for `authenticated` because RLS policy expressions on `teams`, `team_members`, `reports`, `auth_events`, `system_events`, and `webhook_replays` call them as the querying role; revoking those grants makes every policy-protected read fail with `permission denied for function ...`. They are safe: each takes the caller's own ids/role as arguments and returns only a boolean. |
| `auth_events_no_policies` | `public.auth_events` | RLS was enabled with no policies (table unreadable and silently deny-all). Added `CREATE POLICY "Admins read auth events" ON public.auth_events FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'))` plus `GRANT SELECT ... TO authenticated` and `GRANT ALL ... TO service_role`. No `INSERT/UPDATE/DELETE` policy exists, so writes are service-role only (`/api/public/auth-event`). |
| `system_events_insert_policy_missing` | `public.system_events` | Confirmed intentional: inserts are service-role only for trusted server-side logging. Migration adds `GRANT SELECT ON public.system_events TO authenticated`, `GRANT ALL ... TO service_role`, the admin-only SELECT policy `has_role(auth.uid(), 'admin')`, and a table `COMMENT` documenting the write model. No `INSERT` policy is granted to `anon`/`authenticated` by design. |
| `paddle_customdata_trust` | Payments webhook | Paddle `custom_data` is no longer trusted for user attribution. `src/lib/checkout-token.server.ts` issues an HMAC-SHA256 signed checkout intent (user id + environment + expiry) using `CHECKOUT_SIGNING_SECRET`; `src/routes/api/public/payments/webhook.ts` verifies the Paddle signature, then verifies and TTL-checks the token before mapping entitlements. Replays are guarded by `public.webhook_replays` (unique on `event_id, environment`) and out-of-order events by `occurred_at` comparison. |
| `admin_auth_event_log_exposure` | Admin telemetry endpoint | `getAuthAnalytics` (`src/lib/auth-analytics.functions.ts`) now uses a `.strict()` Zod schema (unknown keys rejected), enforces `page ≤ 19` and `pageSize ≤ 50`, paginates the event log server-side with `.range()` instead of returning a full window, caps the aggregation read at 5000 rows, truncates `reason` to 200 chars, and selects only non-PII columns (`event, reason, user_agent, ip_prefix, created_at`). IP addresses are stored pre-truncated (`/24` IPv4, `/32` IPv6). |

## Standing invariants

- Every `public` table has explicit `GRANT`s matching its policies; RLS alone is never relied on.
- Role checks always run through the `has_role` security-definer function, never against a
  profile column and never client-side.
- The service-role client is imported inside handlers only, after the caller is verified.
