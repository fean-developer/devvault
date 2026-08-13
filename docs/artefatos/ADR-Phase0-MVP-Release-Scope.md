# ADR: Phase 0 MVP Release Scope — Two-Tier Gate Model

**Status:** DRAFT — Pending stakeholder sign-off
**Date:** 2026-08-13
**Deciders:** Technical owner, Security reviewer, (optional) Engineering lead
**Related:** T19–T24 evidence commits, `phase-0-readiness-report.md`, `validation.md`, `phase-0-mutation-report.json`

## Problem

Phase 0 verification has run five correction cycles (T19–T24), each closing real defects with reproducible evidence. The independent Verifier nonetheless returns `FAIL` / `STILL FAILING` because four categories of verification cannot be closed by code changes alone:

1. Native Windows — requires a Windows CI runner.
2. Docker Desktop — requires a corporate-approved environment.
3. Live remote Vault — requires provisioned infrastructure and credentials.
4. Multi-project least-privilege isolation — requires a real two-policy Vault instance.

An infinite loop of code corrections cannot resolve infrastructure-dependency issues. Continuing without a decision means no release is achievable from this environment within the current approvals.

## Decision

Adopt a **Two-Tier Gate Model** for Phase 0 status:

- **Tier 1 — Core Correctness:** Logic, validation, security and error semantics proven by test evidence in exercised environments (Linux, macOS, local/dev-mode Vault).
- **Tier 2 — Infra-Verified:** Same logic exercised against real target environments (native Windows, Docker Desktop, live remote Vault, real multi-policy setup).

Phase 0 status henceforth reported as:
- `Phase 0 — Core Correctness: PASS` (Tier 1)
- `Phase 0 — Infra-Verified: PENDING` (Tier 2, tracked separately)

Define **MVP release scope** permitting controlled CLI distribution while Tier 2 verification continues in parallel.

## Rationale

1. **Evidence-based:** Tier 1 closure is already backed by committed code, tests, and mutation-sensor artifacts (T19–T24). Tier 2 cannot be closed by code changes alone without external infrastructure.
2. **Honest risk communication:** Tier 2 items are not unknown; they are explicitly named with owner and unblock preconditions (§5), not hidden as silent gaps.
3. **Unblocks value delivery:** The CLI's core setup logic is correct and useful for developers targeting Linux/macOS with local Vault. That value should not be held hostage by infrastructure-approval delays.
4. **Doesn't weaken standards:** Tier 1 still requires the same evidence (real tests, mutation kills, no prose-only claims) that T20–T24 established. Tier 2 items remain critical; they move to explicit tracking and scheduled work.

## Tier 1 — Core Correctness (PASS)

Backed by committed evidence:

| Item | Evidence |
|---|---|
| Effective KV v2 validation | T20: real `VaultBackend.validate()` invocation, test kill of skip-kv-validation mutant |
| Effective policy/capability validation | T20: mandatory capability checked against backend, kill of skip-policy-validation mutant |
| Result semantics (READY/DEGRADED/BLOCKED/FAILED) | T20: mandatory-pending→DEGRADED enforced by mutation test |
| `--check` read-only | T20: confirmed by test and command semantics |
| Sanitization (secrets redacted, state words preserved) | T24: `unsealed`/`sealed` unredacted, tokens/authorization redacted in human + JSON |
| Exception safety | T23: `SetupStep` exceptions convert to generic `FAILED` |
| `--non-interactive` semantics | T23: no interactive consent without `--yes` |
| Mutation resistance | T24: 8 mutations generated, 8 killed, 0 survived (`phase-0-mutation-report.json`) |
| Audit trail integrity | `validation.md`: historical FAIL entries preserved across T19–T24, no rewrites |
| Test suite | 33 files, 134 tests, 2 full serial runs, consistent PASS |
| Static gates | lint, typecheck, build, spec/tasks validation: all PASS |

**Verdict:** Tier 1 — **PASS**. The setup logic is correct, tested, and defended against regression in exercised environments.

## MVP Definition — What Ships

**Form factor:** `devvault` CLI v0.1.0-mvp (pre-1.0 versioning), distributed for developers to install and run explicitly, not a managed service.

**In scope:**
- `devvault setup`, `--non-interactive --yes`, `--check`, `--json`, `--repair`
- Effective KV v2 and policy/capability readiness validation
- Sanitized output
- **Support:** Linux, macOS; local/Dockerized Vault dev-mode; any backend in T19–T24 test evidence

**Explicitly out of scope (known limitations, not silent gaps):**
- Native Windows — unvalidated; no claim of support or non-support
- Docker Desktop-specific — unvalidated in this environment
- Live/remote Vault endpoints — only dev-mode tested
- Multi-project least-privilege isolation — no two-policy Vault validation
- Full proc/child-process/dump/log coverage — partial only (argv, exception-to-FAILED, sanitized output)

**Versioning:** v0.1.0-mvp or v0.9.0-linux-macos-devmode. Never v1.0.0 until Phase 0 Tier 1 + Tier 2 complete.

## Tier 2 — Infra-Verified (PENDING)

| # | Item | Blocker | Unblock precondition | Reachable? |
|---|---|---|---|---|
| 1 | Native Windows | No Windows CI runner | Add windows-latest job to CI matrix | Yes (CI config) |
| 2 | Docker Desktop | Corporate env blocks install | Provision approved Docker Desktop or Colima for QA | Requires IT approval |
| 3 | Remote Vault live | No provisioned endpoint | Stand up dev/staging Vault reachable from CI | Requires infra approval |
| 4 | Least privilege / Project A-B | Same as #3 | Once #3 exists, create two policies and run isolation tests | Depends on #3 |
| 5 | Full proc/child-process/dump/log | Partially covered | Dedicated correction cycle (code-only, no external infra) | **Yes — code work; should not wait on #1–#4** |

Item 5 is pure engineering work (no infrastructure required). Recommend scheduling as T25-series correction cycle independent of items 1–4.

**Verdict:** Tier 2 — **PENDING** (tracked, owned, reachable via concrete actions).

## Risk Acceptance

Approving MVP scope means accepting:

- **Platform:** CLI unvalidated on Windows; developers on Windows should receive explicit warning or be excluded from initial rollout.
- **Environment:** Remote Vault behavior (latency, TLS, auth backends) unverified; early adopters should treat remote usage as experimental.
- **Isolation:** Multi-project least-privilege boundaries unverified against real Vault; do not rely on readiness checks as security guarantee until item 4 closes.
- **Observability:** Some process/log surfaces (crash dumps, full proc inspection, non-primary log sinks) unverified for secret leakage; restrict initial distribution to trusted internal developers until item 5 closes.

These risks are bounded, named, and do not block core value the CLI already delivers correctly: a validated, tested, evidence-backed local setup and readiness workflow.

## Consequences

- Phase 0 — Core Correctness: **PASS** (Tier 1 only)
- Phase 0 — Infra-Verified: **PENDING** (tracked, scheduled, not blocking MVP release)
- MVP release permissible under §4 scope with §5 and §6 risks communicated in release notes.
- Phase 0 full completion (Tier 1 + Tier 2) remains target for v1.0.0 and Phase 1 unlock.
- No further unbounded code-correction cycles against items 1–4; they require infrastructure/approval decisions external to this workspace.
- Item 5 scheduled as independent engineering work (T25-series).

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Technical owner | | ☐ Approve ☐ Reject ☐ Request changes | |
| Security reviewer | | ☐ Approve risk (§6) ☐ Reject ☐ Request changes | |
| _(optional) Engineering lead_ | | ☐ Approve ☐ Reject | |

Once signed, this document supersedes the requirement that Phase 0 fully PASS before distribution. Full Phase 0 PASS (Tier 1 + Tier 2 complete) remains target for v1.0.0.
