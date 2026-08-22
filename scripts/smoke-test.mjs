#!/usr/bin/env node
/**
 * Post-deploy smoke tests.
 * Usage: node scripts/smoke-test.mjs <base-url>
 * Exits non-zero if any check fails.
 */

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");

if (!base) {
  console.error("No base URL provided. Usage: node scripts/smoke-test.mjs https://example.com");
  process.exit(1);
}

/** @type {{name: string, path: string, expect?: number[], contains?: string[], method?: string}[]} */
const checks = [
  { name: "Landing page renders", path: "/", contains: ["<html", "</html>"] },
  { name: "Pricing page renders", path: "/pricing", contains: ["<html"] },
  { name: "Auth page renders", path: "/auth", contains: ["<html"] },
  { name: "Protected route does not 500", path: "/reports", expect: [200, 301, 302, 307, 401, 404] },
  { name: "Telemetry endpoint rejects cross-origin", path: "/api/public/auth-event", method: "POST", expect: [400, 403, 415] },
  { name: "Unknown route returns 404-ish", path: "/__does_not_exist__", expect: [200, 404] },
];

const timeoutMs = 20000;

async function attempt(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(base + check.path, {
      method: check.method || "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "lovable-smoke-test" },
    });
    const allowed = check.expect || [200];
    if (!allowed.includes(res.status)) {
      return { ok: false, detail: `status ${res.status}, expected one of ${allowed.join(", ")}` };
    }
    if (check.contains?.length) {
      const body = await res.text();
      const missing = check.contains.filter((s) => !body.includes(s));
      if (missing.length) return { ok: false, detail: `body missing: ${missing.join(", ")}` };
    }
    return { ok: true, detail: `status ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function run(check) {
  // Retry twice: fresh deployments can be cold for a moment.
  for (let i = 0; i < 3; i++) {
    const result = await attempt(check);
    if (result.ok) return result;
    if (i < 2) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    else return result;
  }
}

console.log(`Smoke testing ${base}\n`);

let failed = 0;
const rows = [];

for (const check of checks) {
  const result = await run(check);
  const icon = result.ok ? "PASS" : "FAIL";
  if (!result.ok) failed++;
  console.log(`${icon}  ${check.name} (${check.path}) — ${result.detail}`);
  rows.push(`| ${result.ok ? "✅" : "❌"} | ${check.name} | \`${check.path}\` | ${result.detail} |`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Smoke tests — ${base}\n\n| | Check | Path | Result |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n`,
  );
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed > 0 ? 1 : 0);
