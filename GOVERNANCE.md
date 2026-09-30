# Governance

## Maintainers

Endorse Commons is built and maintained by the team at [Maximem](https://maximem.ai). The current maintainers are listed in the repository's GitHub team settings. Community maintainers are welcome: see "Becoming a maintainer" below.

Maintainers:
- review and merge pull requests
- triage issues and reports
- verify learning-center articles against arXiv's official pages and flip `needsReview`
- act as platform moderators (role `moderator`) and enforce the Code of Conduct
- manage releases and production deployments

## How decisions are made

1. **Lazy consensus for everyday changes.** A PR with one maintainer approval and passing CI can be merged if no maintainer objects within 2 working days (or immediately for small fixes).
2. **Design decisions** that change product rules (anything in the state machine, karma, capacity, privacy or retention) need an issue or PR describing the change and the reasoning, and approval from two maintainers. Accepted decisions are recorded in `DECISIONS.md`.
3. **The mission is the tie-breaker.** When options conflict, prefer the one that best serves free knowledge, fair access, visible generosity and protecting the commons, in that order for newcomers' benefit.
4. **Disagreements** that consensus can't resolve are decided by a majority vote of maintainers, with the Maximem project lead holding a casting vote.

## Moderation

Moderators review automated flags (mutual endorsements, ghosting patterns) and user reports in `/app/admin`. Moderation actions are logged in `audit_log`. Suspending an endorser capability or marking an endorsement as removed should come with a note to the affected user.

## Becoming a maintainer

Sustained, high-quality contributions (code, articles or moderation) over roughly three months, plus a nomination by an existing maintainer and no objections from the others.

## Changes to this document

Changes to this document follow the design-decision process above.
