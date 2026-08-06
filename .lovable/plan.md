# MicroSaaS Solution Finder

A tool where you enter a niche, and AI returns the niche's most common pain points, concrete app concepts that solve them, a suggested pricing tier structure, and a feature breakdown. Signed-in users keep a history of every report they generate. Scoped so the first release ships within 72 hours.

## What the user experiences

1. **Landing page (`/`)** — what the tool does, a niche input box (e.g. "dental clinics", "indie ceramics sellers"), sample outputs, and a link to pricing.
2. **Generate** — enter a niche, optionally pick audience size / budget level, hit Find Solutions. A progress state streams while the AI works.
3. **Report page** — the generated result, structured as:
   - Top 5–7 pain points, each with severity and why it hurts
   - 3 recommended app concepts (name, one-liner, who it's for, which pain points it kills, build complexity, 72h-feasibility flag)
   - For the top concept: a 3-tier pricing table (Free/Starter/Pro style) with suggested monthly prices
   - Feature breakdown mapped to tiers, split into MVP vs later
   - Copy-friendly export (copy as markdown)
4. **My Reports (`/reports`)** — saved history, open or delete past reports. Requires sign-in.
5. **Auth (`/auth`)** — email/password plus Google sign-in.
6. **Pricing (`/pricing`)** — this tool's own tiers: Free (a few reports/month), Pro (unlimited + export), Team. Display-only in v1; no checkout unless you want it added.

## Design direction

Dark, product-analyst feel — deep slate canvas, one sharp accent for signal, mono labels over serif/sans headings, dense card grids for pain points and tier tables. Not the generic purple-gradient SaaS look.

## Technical approach

- **Backend:** Lovable Cloud (database + auth). Tables: `profiles` (display name), `reports` (user_id, niche, inputs, generated JSON payload, created_at). RLS so users only read/write their own rows, plus GRANTs.
- **AI:** Lovable AI Gateway, model `openai/gpt-5.6-sol`, called from a TanStack `createServerFn` with a strict structured-output schema so the report shape is reliable. Streaming so long generations don't time out. Free-tier report quota enforced server-side by counting rows.
- **Routes:** `/` (landing + generator), `/pricing`, `/auth`, `/_authenticated/reports`, `/_authenticated/reports/$id`. Each with its own SEO head metadata.
- Errors surfaced properly: rate limit (429) and credits exhausted (402) get clear in-app messages.

## Out of scope for v1

Payment checkout, team seats, competitor/market-size research, PDF export, editing generated reports.
