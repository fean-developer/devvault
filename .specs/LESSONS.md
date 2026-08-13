# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Production command-entry tests must execute the real CLI entrypoint so removing public registration is detected.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `cli-wiring` · harmful: 0
- features: devvault-local-lifecycle
- evidence: apps/cli/src/index.ts:26 | Mutation 1 (cli-wiring)
- last seen: 2026-08-13T20:05:23Z

### L-002 - Every lifecycle mutation path must carry an explicit consent port and test zero adapter calls after denial.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `lifecycle-security` · harmful: 0
- features: devvault-local-lifecycle
- evidence: LIFECYCLE-012 | packages/core/src/developer-lifecycle.ts:23-35 (lifecycle-security)
- last seen: 2026-08-13T20:05:32Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
