# Security policy

Endorse Commons handles unpublished manuscripts and endorsement codes, so we take security reports seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately to **security@maximem.ai** (placeholder, to be confirmed by the maintainers), or use GitHub's "Report a vulnerability" (private security advisory) on this repository.

Please include:
- a description of the issue and its impact (for example, reading another user's manuscript, bypassing an RLS policy, or skipping a state-machine rule)
- steps to reproduce, or a proof of concept against a **local** instance (`supabase start`)
- any suggested fix

We aim to acknowledge reports within 3 working days and to ship a fix for confirmed high-severity issues within 14 days. We'll credit you in the release notes unless you prefer otherwise.

## Scope

In scope: this repository's code, SQL (RLS, RPCs, storage policies), Edge Functions and deployment configuration.

Out of scope: denial-of-service, social engineering, reports that require a compromised device, and third-party services (Supabase, Cloudflare, arXiv, OpenAlex, Hugging Face). Report those to the vendor.

Please never test against production data or other people's accounts.
