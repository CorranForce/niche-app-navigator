import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RLS_FUNCTION_GRANTS, SERVICE_ROLE_ONLY_FUNCTIONS } from "@/lib/rls-grant-contract";

export type GrantCheckRow = {
  name: string;
  detail: string;
  ok: boolean;
  kind: "required" | "locked";
  usedBy: string[];
};

export type GrantCheckResult = {
  checkedAt: string;
  passed: number;
  failed: number;
  rows: GrantCheckRow[];
};

type AuditRow = { fn: string; signature: string; role_name: string; can_execute: boolean };

/** Owner-only: runs the same EXECUTE-grant contract the CI script enforces. */
export const getGrantCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GrantCheckResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const functions = [...RLS_FUNCTION_GRANTS.map((e) => e.fn), ...SERVICE_ROLE_ONLY_FUNCTIONS];
    const { data, error } = await supabaseAdmin.rpc(
      "function_grant_audit" as never,
      { _functions: functions, _roles: ["anon", "authenticated", "service_role"] } as never,
    );
    if (error) throw new Error(error.message);
    const audit = (data ?? []) as unknown as AuditRow[];

    const rows: GrantCheckRow[] = [];

    for (const entry of RLS_FUNCTION_GRANTS) {
      const sigs = [...new Set(audit.filter((r) => r.fn === entry.fn).map((r) => r.signature))];
      if (sigs.length === 0) {
        rows.push({
          name: `public.${entry.fn}`,
          detail: "function is missing",
          ok: false,
          kind: "required",
          usedBy: entry.usedBy,
        });
        continue;
      }
      for (const sig of sigs) {
        for (const role of entry.roles) {
          const ok =
            audit.find((r) => r.signature === sig && r.role_name === role)?.can_execute === true;
          rows.push({
            name: `${sig} → ${role}`,
            detail: ok ? "EXECUTE granted" : "EXECUTE MISSING — RLS policies will fail",
            ok,
            kind: "required",
            usedBy: entry.usedBy,
          });
        }
      }
    }

    for (const fn of SERVICE_ROLE_ONLY_FUNCTIONS) {
      const sigs = [...new Set(audit.filter((r) => r.fn === fn).map((r) => r.signature))];
      for (const sig of sigs) {
        for (const role of ["anon", "authenticated"]) {
          const executable =
            audit.find((r) => r.signature === sig && r.role_name === role)?.can_execute === true;
          rows.push({
            name: `${sig} ⊘ ${role}`,
            detail: executable ? "OVER-GRANTED — revoke EXECUTE" : "locked down",
            ok: !executable,
            kind: "locked",
            usedBy: [],
          });
        }
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      passed: rows.filter((r) => r.ok).length,
      failed: rows.filter((r) => !r.ok).length,
      rows,
    };
  });
