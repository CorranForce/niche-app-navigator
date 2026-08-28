#!/usr/bin/env node
/**
 * Post-migration guard: verifies that the EXECUTE grants RLS policies depend on
 * still exist, and that service-role-only functions stay locked down.
 *
 * Usage: SUPABASE_DB_URL=postgres://... node scripts/check-function-grants.mjs
 * Skips (exit 0) when SUPABASE_DB_URL is not configured.
 */
import pg from "pg";

const REQUIRED = [
  { fn: "has_role", roles: ["authenticated", "service_role"] },
  { fn: "is_team_member", roles: ["authenticated", "service_role"] },
  { fn: "is_team_owner", roles: ["authenticated", "service_role"] },
];

const SERVICE_ROLE_ONLY = [
  "effective_subscription_for",
  "has_active_subscription",
  "claim_team_invites",
  "admin_mcp_clients",
  "admin_mcp_consents",
  "admin_mcp_authorization_stats",
];

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log("SKIP  function-grant check — SUPABASE_DB_URL not set");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let failed = 0;

function record(ok, name, detail) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function signatures(fn) {
  const { rows } = await client.query(
    `select p.oid::regprocedure::text as sig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [fn],
  );
  return rows.map((r) => r.sig);
}

async function canExecute(role, sig) {
  const { rows } = await client.query("select has_function_privilege($1, $2, 'EXECUTE') as ok", [
    role,
    sig,
  ]);
  return rows[0]?.ok === true;
}

try {
  await client.connect();

  for (const { fn, roles } of REQUIRED) {
    const sigs = await signatures(fn);
    if (sigs.length === 0) {
      record(false, `public.${fn}`, "function is missing");
      continue;
    }
    for (const sig of sigs) {
      for (const role of roles) {
        const ok = await canExecute(role, sig);
        record(ok, `${sig} EXECUTE → ${role}`, ok ? "granted" : "MISSING — RLS policies will fail");
      }
    }
  }

  for (const fn of SERVICE_ROLE_ONLY) {
    const sigs = await signatures(fn);
    for (const sig of sigs) {
      for (const role of ["anon", "authenticated"]) {
        const ok = await canExecute(role, sig);
        record(!ok, `${sig} NOT executable by ${role}`, ok ? "OVER-GRANTED" : "locked down");
      }
    }
  }
} catch (error) {
  console.error("FAIL  function-grant check — ", error.message);
  failed++;
} finally {
  await client.end().catch(() => {});
}

console.log(failed === 0 ? "\nAll function grants OK" : `\n${failed} grant problem(s) found`);
process.exit(failed === 0 ? 1 && 1 : 1);
