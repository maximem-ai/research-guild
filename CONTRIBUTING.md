# Contributing to Endorse Commons

Thank you for helping keep open science open. Contributions of code, learning-center articles, topic lists and translations are all welcome.

## Ground rules

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Never commit secrets, real manuscripts, endorsement codes or anyone's personal data.
- Abuse thresholds and limits belong in `platform_config`, not in code.
- Every state change goes through a `SECURITY DEFINER` RPC in `supabase/migrations`. Every new table gets RLS.

## Developer Certificate of Origin (DCO)

We use the [DCO](https://developercertificate.org/) instead of a CLA. Sign off every commit:

```bash
git commit -s -m "Explain the change"
```

This adds `Signed-off-by: Your Name <you@example.com>`. It certifies that you wrote the change, or otherwise have the right to submit it under the project's licenses (AGPL-3.0 for code, CC BY 4.0 for `content/learn/**`).

## Development

```bash
npm install
supabase start
cp .env.example .env.local   # fill in from `supabase status`
npm run dev
```

Before opening a PR:

```bash
npm run lint && npm run typecheck && npm test
supabase test db             # if you touched SQL
npm run test:e2e             # if you changed a user flow
```

Schema changes are **new** migration files (`supabase migration new <name>`). Never edit a migration that has already shipped.

## Proposing a learning-center article

1. Open an issue with the "Learning-center article" template. Name the question it answers and the **official arXiv sources** (info.arxiv.org, blog.arxiv.org).
2. Add `content/learn/<slug>.mdx`, following an existing article's frontmatter: `title`, `description` (≤160 characters), `section`, `order`, `lastVerified`, `needsReview: true`, `cta`, `sources`, `faq` (3–5), and `related`.
3. Writing rules:
   - Draft only from linked official arXiv sources.
   - Never state a number or rule that isn't in a cited source.
   - Date policy-sensitive statements ("as of Month YYYY, per arXiv").
   - 500–900 words of plain English. Use `##` and `###` headings only (the title renders as H1). No JSX.
4. `npm test` validates the frontmatter and sources.
5. A maintainer verifies each claim against the live arXiv pages and then flips `needsReview` to `false`.

## Adding sub-topics for a category

Sub-topics drive matching. To add or extend a list:

1. Create a new migration, e.g. `supabase migration new topics_cs_dc`.
2. Insert rows:
   ```sql
   insert into topics (category_code, slug, name) values
     ('cs.DC', 'serverless', 'Serverless computing'),
     ('cs.DC', 'consensus', 'Consensus & replication')
   on conflict (category_code, slug) do nothing;
   ```
3. Keep lists short (6–10), distinct and recognizable to researchers in that field. Don't rename existing slugs, because users follow them.
4. If you add a new **category**, also add it to `src/lib/categories.ts` (a unit test checks the two stay in sync).
