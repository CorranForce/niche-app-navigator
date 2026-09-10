/**
 * Single source of truth for the EXECUTE grants that RLS policy expressions
 * depend on. Policies run as the *querying* role, so every function named in a
 * policy USING/WITH CHECK clause must remain EXECUTE-able by that role. A
 * migration that revokes one of these silently breaks every protected read with
 * `permission denied for function ...`.
 *
 * Used by scripts/check-function-grants.mjs (CI) and the regression tests.
 */
export type GrantContractEntry = {
  fn: string;
  /** Schema the policy helper lives in. Helpers live in `private` so they are
   * not reachable as RPCs through the exposed API schema. */
  schema: string;
  roles: string[];
  usedBy: string[];
};

export const RLS_FUNCTION_GRANTS: GrantContractEntry[] = [
  {
    fn: "has_role",
    schema: "private",
    roles: ["authenticated", "service_role"],
    usedBy: [
      "auth_events: Admins read auth events",
      "system_events: Admins read system events",
      "webhook_replays: Admins read replays",
    ],
  },
  {
    fn: "is_team_member",
    schema: "private",
    roles: ["authenticated", "service_role"],
    usedBy: ["reports: team read", "team_members: members read roster", "teams: members read team"],
  },
  {
    fn: "is_team_owner",
    schema: "private",
    roles: ["authenticated", "service_role"],
    usedBy: ["team_members: owners manage roster", "teams: owners update team"],
  },
];

/** Functions in the exposed `public` schema that must NOT be executable by
 * anon/authenticated (service-role only). */
export const SERVICE_ROLE_ONLY_FUNCTIONS = [
  "effective_subscription_for",
  "has_active_subscription",
  "claim_team_invites",
  "admin_mcp_clients",
  "admin_mcp_consents",
  "admin_mcp_authorization_stats",
  "function_grant_audit",
  // public copies kept only for service-role RPC calls from server functions
  "has_role",
  "is_team_member",
  "is_team_owner",
];

