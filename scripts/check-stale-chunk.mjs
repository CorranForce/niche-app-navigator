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

// 1. Collect the client entry scripts referenced by the landing page.
const scripts = [
  ...new Set(
    [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]),
  ),
].filter((s) => s.startsWith("/"));

const hashed = scripts.filter((s) => /\.js(\?|$)/.test(s));
const isProdBuild = hashed.length > 0;

record(
  scripts.length > 0,
  "Client entry scripts are referenced",
  `${scripts.length} module script(s)${isProdBuild ? "" : " (dev server: unhashed)"}`,
);

// 2. A live chunk must be served as JavaScript.
if (scripts.length > 0) {
  const res = await get(base + scripts[0]);
  const type = res.headers.get("content-type") || "";
  const ok = res.status === 200 && /javascript|ecmascript/i.test(type);
  record(ok, "Live chunk serves JavaScript", `status ${res.status}, content-type ${type || "none"}`);
}

// 3. Simulate a stale chunk: same directory, hash that no longer exists.
const stalePath = hashed[0]
  ? hashed[0].replace(/[^/]+\.js$/, "stale-chunk-DEADBEEF.js")
  : "/assets/stale-chunk-DEADBEEF.js";
{
  const res = await get(base + stalePath);
  const type = res.headers.get("content-type") || "";
  const body = await res.text();
  const looksLikeApp = /text\/html/i.test(type) && /<html/i.test(body);
  const ok = res.status >= 400 && !(res.status === 200 && looksLikeApp);
  record(
    ok,
    "Missing chunk 404s instead of falling back to app HTML",
    `${stalePath} → status ${res.status}, content-type ${type || "none"}`,
  );
}

// 4. The recovery guard must be present in the shipped client code.
{
  const seen = new Set();
  const queue = [...scripts];
  let found = false;

  while (queue.length > 0 && seen.size < 60 && !found) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    let body = "";
    try {
      const res = await get(base + url);
      if (res.status !== 200) continue;
      body = await res.text();
    } catch {
      continue;
    }
    if (body.includes("vite:preloadError") && body.includes("chunk-reload-at")) {
      found = true;
      break;
    }
    // Follow one level of static imports so dev-mode entries resolve too.
    for (const m of body.matchAll(/from\s*["'](\/[^"']+)["']/g)) {
      if (!seen.has(m[1])) queue.push(m[1]);
    }
    for (const m of body.matchAll(/import\s*\(\s*["'](\/[^"']+)["']\s*\)/g)) {
      if (!seen.has(m[1])) queue.push(m[1]);
    }
  }

  record(
    found,
    "Stale-chunk auto-reload guard is shipped",
    found
      ? "vite:preloadError handler found in client code"
      : `guard not found after scanning ${seen.size} module(s)`,
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
