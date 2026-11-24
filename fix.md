CorranForce/niche-app-navigator fix list

Default branch: main. Write access: yes. Visibility: public.

Critical

- Committed environment files in a public repository
  - Files: .env lines 1-6, .env.development line 1, .env.production line 1
  - .env is tracked and contains live-looking Supabase project id, URL, and publishable key values (types only, values not repeated here).
  - .env.development and .env.production each contain VITE_PAYMENTS_CLIENT_TOKEN.
  - .gitignore does not list those env files, so new secrets will keep being committed.
  - Fix: ignore .env and every .env variant except .env.example. Remove the three env files from git in a new commit. Rotate the Supabase publishable key and the payments client tokens, and review the Supabase project as public. Leave published history unchanged.

- TanStack Start reflected XSS and other npm audit findings
  - File: package-lock.json (for example @tanstack/react-start 1.168.38 and @tanstack/start-server-core 1.169.21)
  - npm audit --package-lock-only reports 6 critical and 9 high issues, including unauthenticated reflected XSS in TanStack Start server-function responses, plus a critical shell-quote command injection and high issues in nanoid, seroval, js-yaml, zod, vite, and undici.
  - Fix: upgrade @tanstack/react-start and related packages past the patched versions, upgrade the other flagged packages, and rerun npm audit.

Medium

- No LICENSE file and no branch protection
  - File: missing LICENSE. Ruleset read for main returned no required reviews or status checks.
  - CI workflows exist under .github/workflows (ci.yml, codeql.yml, deploy-preview.yml, deploy-vercel.yml, rollback.yml).
  - Fix: add a LICENSE and require those checks plus a review on main.

Low

- README.md, .env.example, and CI are present. Keep .env.example as the only committed env file, with empty or clearly fake values.
- File: .env.example line 8. SUPABASE_SERVICE_ROLE_KEY is an empty quoted value. Leave it empty.
