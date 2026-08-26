# Niche App Navigator — MicroSaaS Solution Finder

Enter a business niche and get back its most common operational pain points, three narrow
micro-SaaS app concepts that solve them, a three-tier pricing structure, and a feature
breakdown scoped so the first release fits inside 72 hours.

Built with [Lovable](https://lovable.dev). Live editor: [open the project](https://lovable.dev/projects/f7a94163-e713-4855-ac0a-8d31febe4e63).

## Features

- **Report generator** — niche + audience size + budget level in, structured AI report out
  (pain points with severity, app concepts with 72h feasibility flags, pricing tiers,
  MVP-vs-later feature breakdown, markdown export).
- **Saved history** — signed-in users keep every report; reopen or delete at no extra
  cost against their monthly limit.
- **Auth** — email/password and Google sign-in, with a dedicated `/auth/callback` route,
  account linking, onboarding, and OAuth failure/timeout telemetry.
- **Billing** — Paddle as merchant of record. Free (5 reports/mo), Pro $19/mo (50/mo),
  Studio $49/mo (unlimited). Upgrades prorate; plan changes apply at next renewal;
  cancellations keep access until period end; past-due drops to Free limits.
- **Transactional email** — payment-failed, invoice/renewal receipts and auth emails via
  `notify.freedomopsai.dev`, with delivery-outcome webhooks and an admin delivery log.
- **Owner dashboard** (`/admin`, owner-only) — revenue and MRR, plan mix, signup and
  report volume, billing anomalies, customer search, OAuth health, and email logs, all on
  one page with anchor navigation.
- **SEO / LLM surface** — FAQ and use-case pages with FAQPage, BreadcrumbList, Review and
  Organization JSON-LD, per-page OG images, `sitemap.xml`, `robots.txt` and `llms.txt`.
- **Agent integrations (MCP)** — OAuth-secured MCP server at `/mcp`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page + report generator |
| `/pricing` | Plan comparison |
| `/faq` | Billing and product FAQ (FAQPage schema) |
| `/use-cases`, `/use-cases/$slug` | Pain-point catalogue and detail pages |
| `/auth`, `/auth/callback` | Sign in / OAuth return |
| `/account` | Profile, linked identities and billing (`#billing`) |
| `/onboarding` | First-run profile completion |
| `/reports`, `/reports/$id` | Saved report history |
| `/admin` | Owner dashboard (all admin sections) |
| `/api/public/payments/webhook` | Paddle webhooks |
| `/api/public/auth-event` | OAuth analytics beacon |
| `/mcp` | MCP server endpoint |

`/billing`, `/admin/users` and `/admin/emails` redirect into their merged locations.

## Agent integrations (MCP)

The app exposes an MCP server at `/mcp`, authenticated with OAuth against the project's
auth issuer, so each client acts as a real signed-in user and row-level security applies.

| Tool | Auth | Description |
| --- | --- | --- |
| `list_use_cases` | public | Pain-point catalogue, app shapes, target niches |
| `list_reports` | user | Saved reports, newest first, optional niche filter |
| `get_report` | user | One report in full, including plan and pricing tiers |
| `get_account_status` | user | Plan, monthly allowance, usage and subscription status |

Tool definitions live in `src/lib/mcp/tools/`; the server manifest is generated at
`.lovable/mcp/manifest.json`. MCP clients can connect once the app is published.

## Tech stack

- **Framework:** TanStack Start v1 (React 19, file-based routing, server functions) on Vite 7
- **Styling:** Tailwind CSS v4 via `src/styles.css` design tokens, shadcn/ui components
- **Backend:** Lovable Cloud (Postgres, auth, storage) with RLS on every table
- **AI:** Lovable AI Gateway with a strict structured-output report schema
- **Payments:** Paddle Billing
- **Email:** react-email templates through the Lovable email integration

## Project layout

```
src/
  routes/          file-based routes (see src/routes/README.md)
  components/      UI + dashboard sections
  lib/             server functions (*.functions.ts), server-only helpers (*.server.ts),
                   report schema/prompt, plan limits, MCP tools
  integrations/    generated Supabase + Lovable clients (do not edit)
scripts/           smoke tests and OG image checks used by CI
.github/workflows/ CI, CodeQL, Vercel deploy, preview deploy, rollback
```

## Development

Requires Node.js and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Useful scripts:

```sh
npm run lint          # ESLint
npm run test          # Vitest
node scripts/smoke-test.mjs <url>       # post-deploy smoke test
node scripts/check-og-images.mjs <url>  # verify og:image / twitter:image
```

## CI/CD

- `ci.yml` — lint, typecheck, tests and coverage on every push and PR
- `codeql.yml` — scheduled security scanning
- `dependabot.yml` — dependency updates
- `deploy-vercel.yml` — production deploy, smoke test, OG-image check, notifications
- `deploy-preview.yml` — per-PR preview deploys
- `rollback.yml` — manual rollback to a previous deployment

Every change made in Lovable is committed straight to this repository, and pushes to
`main` sync back into the Lovable editor.
