#!/usr/bin/env node
/**
 * Post-deploy check: every use-case URL (plus FAQ and the use-cases index)
 * must render an absolute og:image / twitter:image whose asset is reachable,
 * and must carry BreadcrumbList structured data.
 *
 * Usage: node scripts/check-og-images.mjs <base-url>
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("No base URL provided. Usage: node scripts/check-og-images.mjs https://example.com");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const useCaseSource = readFileSync(join(here, "..", "src", "lib", "use-cases.ts"), "utf8");
const slugs = [...useCaseSource.matchAll(/^\s{4}slug:\s*"([^"]+)"/gm)].map((m) => m[1]);

if (slugs.length === 0) {
  console.error("Could not parse any use-case slugs from src/lib/use-cases.ts");
  process.exit(1);
}

const paths = ["/faq", "/use-cases", ...slugs.map((s) => `/use-cases/${s}`)];

const meta = (html, attr, value) => {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']+)["']|` +
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] || m[2] : null;
};

const timeoutMs = 20000;

async function get(url, method = "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: { "user-agent": "lovable-og-check" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkPath(path) {
  const problems = [];
  const res = await get(base + path);
  if (res.status !== 200) return [`page returned status ${res.status}`];
  const html = await res.text();

  const og = meta(html, "property", "og:image");
  const tw = meta(html, "name", "twitter:image");

  if (!og) problems.push("missing og:image");
  if (!tw) problems.push("missing twitter:image");
  if (og && tw && og !== tw) problems.push(`og:image (${og}) differs from twitter:image (${tw})`);

  for (const [label, value] of [
    ["og:image", og],
    ["twitter:image", tw],
  ]) {
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) {
      problems.push(`${label} is not absolute: ${value}`);
      continue;
    }
    // Verify the asset itself is served from this deployment.
    const assetUrl = base + new URL(value).pathname;
    let assetRes;
    try {
      assetRes = await get(assetUrl, "HEAD");
      if (assetRes.status === 405 || assetRes.status === 501) assetRes = await get(assetUrl);
    } catch (err) {
      problems.push(`${label} fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (assetRes.status !== 200) {
      problems.push(`${label} asset ${assetUrl} returned ${assetRes.status}`);
      continue;
    }
    const type = assetRes.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
      problems.push(`${label} asset ${assetUrl} content-type is ${type || "unknown"}`);
    }
  }

  if (!/"@type"\s*:\s*"BreadcrumbList"/.test(html)) {
    problems.push("missing BreadcrumbList structured data");
  }

  return problems;
}

async function run(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const problems = await checkPath(path);
      if (problems.length === 0) return problems;
      if (i === 2) return problems;
    } catch (err) {
      if (i === 2) return [err instanceof Error ? err.message : String(err)];
    }
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  return ["unreachable"];
}

console.log(`Checking social preview tags on ${base}\n`);

let failed = 0;
const rows = [];

for (const path of paths) {
  const problems = await run(path);
  const ok = problems.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${path}${ok ? "" : ` — ${problems.join("; ")}`}`);
  rows.push(`| ${ok ? "✅" : "❌"} | \`${path}\` | ${ok ? "og+twitter image, breadcrumbs OK" : problems.join("; ")} |`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Social preview checks — ${base}\n\n| | Path | Result |\n| --- | --- | --- |\n${rows.join("\n")}\n\n`,
  );
}

console.log(`\n${paths.length - failed}/${paths.length} pages passed.`);
process.exit(failed > 0 ? 1 : 0);
