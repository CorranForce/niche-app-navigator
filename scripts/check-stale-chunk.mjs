#!/usr/bin/env node
/**
 * Post-deploy check: stale-chunk recovery simulation.
 *
 * After a deploy, tabs running the previous build request hashed chunks that
 * no longer exist. The app must (a) not serve HTML in place of a missing JS
 * asset (that produces the "Importing a module script failed" blank screen)
 * and (b) ship the guarded auto-reload handler that recovers such tabs.
 *
 * Usage: node scripts/check-stale-chunk.mjs <base-url>
 */

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error(
    "No base URL provided. Usage: node scripts/check-stale-chunk.mjs https://example.com",
  );
  process.exit(1);
}

const timeoutMs = 20000;

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "lovable-stale-chunk-check" },
    });
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
const record = (ok, name, detail) => {
  results.push({ ok, name, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const html = await get(base + "/").then((r) => r.text());

// 1. Collect the real hashed client assets referenced by the landing page.
const assets = [
  ...new Set(
    [...html.matchAll(/(?:src|href)=["'](\/(?:assets|_build)\/[^"']+\.js)["']/g)].map((m) => m[1]),
  ),
];

if (assets.length === 0) {
  record(false, "Client chunks are referenced", "no hashed .js assets found in landing HTML");
} else {
  record(true, "Client chunks are referenced", `${assets.length} module script(s)`);
}

// 2. A live chunk must be served as JavaScript.
if (assets.length > 0) {
  const res = await get(base + assets[0]);
  const type = res.headers.get("content-type") || "";
  const ok = res.status === 200 && /javascript|ecmascript/i.test(type);
  record(ok, "Live chunk serves JavaScript", `status ${res.status}, content-type ${type || "none"}`);
}

// 3. Simulate a stale chunk: same directory, hash that no longer exists.
const stalePath = assets[0]
  ? assets[0].replace(/[^/]+\.js$/, "stale-chunk-DEADBEEF.js")
  : "/assets/stale-chunk-DEADBEEF.js";
{
  const res = await get(base + stalePath);
  const type = res.headers.get("content-type") || "";
  const servesHtml = /text\/html/i.test(type);
  const ok = res.status === 404 || (res.status >= 400 && !servesHtml);
  record(
    ok,
    "Missing chunk 404s instead of falling back to HTML",
    `${stalePath} → status ${res.status}, content-type ${type || "none"}`,
  );
}

// 4. The recovery guard must be present in the shipped bundle.
{
  let found = false;
  for (const asset of assets.slice(0, 8)) {
    const body = await get(base + asset).then((r) => r.text());
    if (body.includes("vite:preloadError") && /chunk-reload-at/.test(body)) {
      found = true;
      break;
    }
  }
  record(
    found,
    "Stale-chunk auto-reload guard is shipped",
    found ? "vite:preloadError handler found in client bundle" : "guard not found in entry chunks",
  );
}

const failed = results.filter((r) => !r.ok).length;

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Stale-chunk recovery — ${base}\n\n| | Check | Detail |\n| --- | --- | --- |\n` +
      results.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.name} | ${r.detail} |`).join("\n") +
      "\n\n",
  );
}

console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed > 0 ? 1 : 0);
