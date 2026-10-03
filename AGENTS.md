# AGENTS.md

## What this repo is
ResearchGuild (https://researchguild.org) helps first-time researchers get feedback on their first paper and find an arXiv endorser. It is a Next.js 15 app on Cloudflare Workers (OpenNext) with Supabase for Postgres, Auth, Storage, Realtime, pg_cron and Edge Functions. Every rule of the endorsement workflow lives in SQL: state changes are `SECURITY DEFINER` RPCs, every table has RLS, and clients cannot write tables directly.

## Build, test, lint
```bash
npm install
npm run lint && npm run typecheck && npm test   # ESLint, tsc, Vitest
npm run test:db                                  # migrations + pgTAP on a throwaway Postgres 16 (no Docker)
supabase start && supabase test db               # the same SQL tests against a full local Supabase
npm run test:e2e                                 # Playwright (needs `supabase start` and .env.local)
npm run build                                    # also compiles content/learn into src/generated and public/llms.txt
```

## Layout
- `supabase/migrations/`: schema, RLS, RPCs, cron jobs. Add new files only; never edit a shipped migration.
- `supabase/tests/`: pgTAP tests, one file per area.
- `supabase/functions/`: Edge Functions `embed`, `retention`, `verify-arxiv`, `scholar`, with shared code in `_shared/`.
- `src/app/(public)/`: home, learning center, karma, availability pages, legal pages.
- `src/app/app/`: the signed-in app; `actions.ts` holds the server actions.
- `content/learn/`: learning-center articles (Markdown + frontmatter, CC BY 4.0) and `glossary.json`.
- `scripts/`: content build, brand image rendering, local Postgres test runner.
- `DECISIONS.md`: why things are the way they are. Read it before changing behaviour.

## Rules for changes
- Run the test commands above before proposing a change; add a pgTAP test for every new RPC or rule.
- Put state changes in a new migration as an RPC with a clear `fail()` message; never grant table writes to `anon` or `authenticated`.
- The Next.js layer stays thin: validate input shape, call the RPC as the signed-in user, render.
- No email, no payments, no new hosted services. Limits and thresholds go in `platform_config`.
- Learning-center text must cite official arXiv pages, and new articles start with `needsReview: true`.
- Sign off commits (`git commit -s`) and fill in the AI-use section of the PR template.
