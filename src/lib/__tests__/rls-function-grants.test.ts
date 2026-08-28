import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RLS_FUNCTION_GRANTS, SERVICE_ROLE_ONLY_FUNCTIONS } from "@/lib/rls-grant-contract";
import { friendlyErrorMessage } from "@/lib/friendly-errors";

const docs = readFileSync("docs/security-fixes.md", "utf8");
const script = readFileSync("scripts/check-function-grants.mjs", "utf8");
const reportsFns = readFileSync("src/lib/reports.functions.ts", "utf8");

describe("RLS function grant contract", () => {
  it("keeps the three policy helper functions executable by authenticated", () => {
    for (const fn of ["has_role", "is_team_member", "is_team_owner"]) {
      const entry = RLS_FUNCTION_GRANTS.find((e) => e.fn === fn);
      expect(entry, `${fn} missing from contract`).toBeTruthy();
      expect(entry!.roles).toContain("authenticated");
      expect(entry!.roles).toContain("service_role");
    }
  });

  it("never lists a service-role-only function as authenticated-executable", () => {
    for (const fn of SERVICE_ROLE_ONLY_FUNCTIONS) {
      expect(RLS_FUNCTION_GRANTS.some((e) => e.fn === fn)).toBe(false);
    }
  });

  it("is enforced by the CI grant check for every contract entry", () => {
    for (const entry of RLS_FUNCTION_GRANTS) expect(script).toContain(`"${entry.fn}"`);
    for (const fn of SERVICE_ROLE_ONLY_FUNCTIONS) expect(script).toContain(`"${fn}"`);
  });

  it("documents every contract entry in the policy → grant map", () => {
    for (const entry of RLS_FUNCTION_GRANTS) expect(docs).toContain(`\`${entry.fn}\``);
    expect(docs).toContain("Policy → required function grants");
  });
});

describe("reports endpoint regression: permission denied for function is_team_member", () => {
  it("routes team-scoped reads through is_team_member-backed policies as the signed-in user", () => {
    // listReports must use the user-scoped client (RLS applies, policies call
    // is_team_member) — not the admin client, which would mask a missing grant.
    expect(reportsFns).toContain("context.supabase");
    expect(reportsFns).not.toContain("supabaseAdmin");
  });

  it("surfaces a permission-denied function error as an actionable message, not a raw string", () => {
    const message = friendlyErrorMessage(
      new Error("permission denied for function is_team_member"),
    );
    expect(message).not.toMatch(/^permission denied/);
    expect(message).toContain("is_team_member");
    expect(message.toLowerCase()).toContain("retry");
  });

  it("wraps supabase errors from the reports server functions", () => {
    expect(reportsFns).toContain("toFriendlyError");
  });
});

describe("friendlyErrorMessage", () => {
  it("maps table permission errors", () => {
    expect(friendlyErrorMessage("permission denied for table reports")).toContain(
      "don't have access",
    );
  });

  it("maps RLS violations", () => {
    expect(friendlyErrorMessage("new row violates row-level security policy")).toContain(
      "isn't allowed",
    );
  });

  it("maps expired sessions", () => {
    expect(friendlyErrorMessage("invalid JWT")).toContain("sign in again");
  });

  it("passes through unrelated messages unchanged", () => {
    expect(friendlyErrorMessage("Niche must be at least 2 characters")).toBe(
      "Niche must be at least 2 characters",
    );
  });
});
