import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const FIXED_INTERNAL_IDS = [
  "SUPA_authenticated_security_definer_function_executable",
  "auth_events_no_policies",
  "system_events_insert_policy_missing",
  "paddle_customdata_trust",
  "admin_auth_event_log_exposure",
];

describe("security fix documentation", () => {
  const docs = read("docs/security-fixes.md");

  it("maps every fixed internal_id to a concrete change", () => {
    for (const id of FIXED_INTERNAL_IDS) {
      expect(docs, `missing mapping for ${id}`).toContain(id);
    }
  });

  it("names the policy/function each fix relies on", () => {
    expect(docs).toContain("effective_subscription_for");
    expect(docs).toContain("Admins read auth events");
    expect(docs).toContain("has_role(auth.uid(), 'admin')");
    expect(docs).toContain("CHECKOUT_SIGNING_SECRET");
  });
});

describe("SUPA_authenticated_security_definer_function_executable", () => {
  it("no runtime code calls the removed user-executable RPC", () => {
    for (const file of [
      "src/lib/entitlement.functions.ts",
      "src/hooks/use-subscription.ts",
      "src/lib/entitlement.ts",
    ]) {
      const src = read(file);
      expect(src).not.toMatch(/rpc\(\s*["']my_effective_subscription["']/);
    }
  });

  it("entitlement is resolved through an authenticated server function", () => {
    const src = read("src/lib/entitlement.functions.ts");
    expect(src).toContain("requireSupabaseAuth");
    expect(src).toContain("effective_subscription_for");
  });
});

describe("auth_events_no_policies / admin_auth_event_log_exposure", () => {
  const fns = read("src/lib/auth-analytics.functions.ts");

  it("the admin log requires authentication and an admin role check", () => {
    expect(fns).toContain("requireSupabaseAuth");
    expect(fns).toMatch(/rpc\(\s*["']has_role["']/);
    expect(fns).toContain("Admins only.");
  });

  it("verifies the role before any telemetry read", () => {
    const roleCheck = fns.indexOf("Admins only.");
    const firstRead = fns.indexOf('.from("auth_events")');
    expect(roleCheck).toBeGreaterThan(-1);
    expect(firstRead).toBeGreaterThan(roleCheck);
  });

  it("selects only coarse, non-PII telemetry columns", () => {
    const selects = [...fns.matchAll(/\.select\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select).not.toContain("*");
      for (const column of select.split(",").map((c) => c.trim())) {
        expect(["event", "reason", "user_agent", "ip_prefix", "created_at"]).toContain(column);
      }
    }
  });

  it("pages the log server-side instead of slicing a full window", () => {
    expect(fns).toContain(".range(from, to)");
    expect(fns).toContain("pageRange");
    expect(fns).toContain("hasMorePages");
    expect(fns).toContain("truncateReason");
  });

  it("keeps the aggregation read bounded", () => {
    expect(fns).toContain(".limit(AGGREGATE_ROW_CAP)");
  });

  it("stores only truncated network ranges at ingest", () => {
    const ingest = read("src/routes/api/public/auth-event.ts");
    expect(ingest).toContain("coarseIpRange");
    expect(ingest).toContain("/24");
    expect(ingest).toContain("isSameOrigin");
    // ingest never reads telemetry back out
    expect(ingest).not.toContain(".select(");
  });
});

describe("system_events_insert_policy_missing", () => {
  it("system events are written only from server-side code via the admin client", () => {
    const src = read("src/lib/monitoring.server.ts");
    expect(src).toContain("system_events");
    expect(src).toContain("client.server");
  });

  it("no client component inserts system events directly", () => {
    const src = read("src/components/system-health.tsx");
    expect(src).not.toMatch(/from\(\s*["']system_events["']\s*\)\s*\.insert/);
  });
});

describe("paddle_customdata_trust", () => {
  const webhook = read("src/routes/api/public/payments/webhook.ts");

  it("verifies the signature and the signed checkout token", () => {
    expect(webhook).toMatch(/verify/i);
    expect(webhook).toMatch(/checkout-token|checkoutToken|verifyCheckoutIntent/i);
  });

  it("does not trust raw custom_data for user attribution", () => {
    expect(webhook).not.toMatch(/custom_data\??\.\s*user_id/);
  });
});
