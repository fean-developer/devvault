---
name: decision-record
description: This prompt is used to generate a decision record for the devvault CLI MVP release scope
agent: agent
---

# DECISION RECORD — Phase 0 MVP / Release Scope
## devvault CLI — Minimum Viable Release for Developer Distribution

**Status:** DRAFT — pending stakeholder sign-off
**Date:** 2026-08-13
**Owner:** _[preencher — responsável técnico pela decisão]_
**Related evidence:** T19, T20, T23, T24 commits (`940309d`, `5092a90`, `bc5ec10`, `e5160cc`), `phase-0-readiness-report.md`, `validation.md`, `phase-0-mutation-report.json`

---

## 1. Purpose

Phase 0 verification has run five correction cycles (T19–T24). Each cycle closed real defects and produced real, reproducible evidence. The independent Verifier has nonetheless returned `FAIL` / `STILL FAILING` every time, because four of the outstanding items cannot be closed by further code changes — they require external infrastructure (a Windows runner, a Docker Desktop license/environment, a provisioned live Vault instance, and a real two-policy Vault setup for isolation testing).

Continuing to run correction cycles against these four items will not change the outcome. This document exists to:

1. Separate **what has been proven** from **what remains structurally unprovable in this environment**.
2. Define a **Minimum Viable Release (MVP)** scope: a `devvault` CLI that developers can install and use today, with known, tracked, explicitly communicated limitations — not a silent gap.
3. Give a named stakeholder something concrete to approve, so the release is unblocked by a decision, not by an infinite loop of automated re-verification.

This decision does **not** change the Specification or Design. It does not claim Phase 0 is fully PASSED. It defines a controlled, honest subset of Phase 0 sufficient to distribute the CLI for real developer use, while the remaining infra-dependent verification continues in parallel.

---

## 2. Two-Tier Gate Model

Phase 0's original all-or-nothing gate conflates two categories of verification that are fundamentally different in nature:

| Tier | Definition | Can be closed by code changes? |
|---|---|---|
| **Tier 1 — Core Correctness** | The setup pipeline's logic, validation, security, and error semantics are correct, tested, and evidenced. | Yes — and largely has been. |
| **Tier 2 — Infra-Verified** | The same logic has been exercised against real target environments (native Windows, Docker Desktop, live remote Vault, real multi-policy Vault isolation). | No — requires provisioned infrastructure, credentials, and/or licenses outside this workspace. |

Going forward, Phase 0 status is reported as **two separate verdicts**, not one blended verdict:

- `Phase 0 — Core Correctness: PASS`
- `Phase 0 — Infra-Verified: PENDING (tracked, see §5)`

This is not a weakening of the bar. Every Tier 1 item still requires the same evidence standard (real tests, real mutation-sensor kills, no narrative-only claims) that T20–T24 already established. Tier 2 items are not downgraded in importance — they are moved to an explicit, owned tracking list instead of blocking an achievable release indefinitely.

---

## 3. What Is Proven (Tier 1 — Core Correctness)

The following are backed by committed evidence, not assertion:

| Item | Evidence |
|---|---|
| Effective (not static-flag) KV v2 validation | T20, `SetupOrchestrator` → `VaultBackend.validate()` real invocation |
| Effective policy/capability validation | T20, same path, mandatory capability checked against actual backend response |
| Correct result semantics (READY/DEGRADED/BLOCKED/FAILED) | T20 — mandatory-pending cannot become DEGRADED; enforced by mutation test |
| `--check` is mutation-free (read-only) | T20 |
| Sanitization: secrets redacted, state words (`unsealed`/`sealed`) preserved | T24, regression tests on human + JSON output |
| Exceptions in `SetupStep` converted to generic `FAILED` | T23, confirmed still passing in T24 |
| `--non-interactive` never calls interactive consent without `--yes` | T23 |
| Formal, reproducible mutation sensor | T24, `phase0-mutation-sensor.mjs`, `phase-0-mutation-report.json`: 8/8 killed, 0 survived |
| Audit trail integrity | `validation.md` history preserved across T19–T24, no rewrites |
| Test suite | 33 files, 134 tests, 2 full serial runs, consistent results |
| Static gates | lint, typecheck, build, Specification validation, Tasks validation — all PASS |

**Conclusion:** the CLI's setup logic — the part a developer actually runs — is correct, tested, and defended against regression on the platform(s) exercised so far (Linux, local/Dockerized Vault dev-mode). This is a legitimate, evidenced basis for controlled distribution.

---

## 4. MVP Definition — What Ships

**Form factor:** `devvault` CLI, distributed for developers to install and run themselves (per the existing distribution approach already discussed) — not a managed service, not an auto-updating background agent. The developer explicitly installs a specific version and explicitly runs `setup`.

**In scope for MVP:**
- `devvault setup` (interactive and `--non-interactive --yes`)
- `devvault setup --check` (read-only readiness check)
- `devvault setup --json` (machine-readable output)
- `devvault setup --repair`
- Effective KV v2 and policy/capability readiness validation (Tier 1, proven)
- Sanitized human and JSON output
- Support matrix: **Linux and macOS**, with **local/Dockerized Vault dev-mode** and any backend already exercised in the T19–T24 test evidence

**Explicitly out of scope for MVP (tracked as known limitations, not silently absent):**
- Native Windows support — not validated; CLI may or may not work, no claim either way
- Docker Desktop-specific flows — not validated in this environment
- Live/remote Vault endpoints — only local/dev-mode Vault has been exercised
- Multi-project (Project A/B) least-privilege isolation — not validated against a real two-policy Vault
- Full `proc`/child-process/crash-dump/global-log coverage — partially covered (argv stability, exception-to-FAILED conversion, sanitized output); NOT fully covered for all process/log surfaces (tracked in §5)

**Versioning:** tag this release as a pre-1.0 version explicitly marked as limited scope, e.g. `v0.1.0-mvp` or `v0.9.0-linux-macos-devmode`, so the version number itself communicates the boundary — never ship this as `v1.0.0`, which would imply full Phase 0 completion.

---

## 5. Tracked Tier 2 / Open Items

Each item below is tracked with an owner and a concrete unblock condition — not a vague "requires X" restatement.

| # | Item | Blocker | Unblock precondition | Reachable without new approval? |
|---|---|---|---|---|
| 1 | Native Windows | No Windows CI runner configured | Add `windows-latest` job to CI matrix and re-run existing suite | Likely yes — CI config change, low cost |
| 2 | Docker Desktop | Corporate environment blocks install/execution | Provision an approved Docker Desktop environment or equivalent (e.g. Colima, Podman parity test) for CI/QA | Requires environment/IT approval |
| 3 | Remote Vault live | No provisioned live endpoint, network, or credentials available | Stand up a disposable Vault dev/staging instance reachable from CI with scoped network policy and least-privilege token | Requires infra provisioning approval |
| 4 | Least privilege / Project A-B isolation | Same as #3 — needs a real Vault with two distinct policies | Once #3 exists, create two policies/identities and run the existing (already-designed) isolation test suite against them | Depends on #3 |
| 5 | Full proc/child-process/dump/log coverage | Partially covered; remaining surfaces (full `/proc` inspection, crash-dump content, all log sinks) need targeted test work, not infra | Dedicated correction cycle (code-only, no external infra needed) | **Yes — this is code work, not infra-blocked; should not wait on #1–#4** |

Item 5 deserves explicit note: unlike items 1–4, it does not require external infrastructure. It should be scheduled as ordinary follow-up work (a T-series correction cycle), not bundled with the infra-approval items. Recommend not letting it block or get lost behind the infra items in future reporting.

---

## 6. Risk Acceptance

By approving this MVP scope, the approving stakeholder accepts the following residual risks for the duration this scope remains in effect:

- **Platform risk:** the CLI has not been validated on Windows. Developers on Windows should not be given this release without an explicit warning, or should be excluded from the initial rollout.
- **Environment risk:** behavior against a live/remote Vault (network latency, TLS configuration, real-world auth backends) is unverified. Early adopters should be advised to treat remote-Vault usage as experimental.
- **Isolation risk:** multi-project least-privilege boundaries are unverified against a real Vault. Do not rely on this CLI's readiness checks as a security guarantee for multi-tenant isolation until item 4 (§5) closes.
- **Observability risk:** some process/log surfaces (crash dumps, full proc inspection, non-primary log sinks) are not yet proven free of secret leakage. Recommend restricting initial distribution to trusted internal developers, not external or untrusted users, until item 5 (§5) closes.

These risks are bounded, named, and — critically — do not block the core value the CLI already delivers correctly: a validated, tested, evidence-backed local setup and readiness workflow.

---

## 7. Recommendation

Approve MVP distribution under the scope in §4, with the limitations in §4 and risks in §6 communicated explicitly in the release notes / README (not buried). Track §5 items as ordinary backlog work, with item 5 prioritized ahead of items 1–4 since it requires no external approval and is pure engineering work already partially scoped by T25-style correction cycles.

Do not continue running unbounded Phase 0 correction cycles against items 1–4 expecting a code-only fix — they require an infrastructure/approval decision, which is exactly what this document requests.

---

## 8. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Technical owner | | ☐ Approve MVP scope ☐ Reject ☐ Request changes | |
| Security reviewer | | ☐ Approve residual risk (§6) ☐ Reject ☐ Request changes | |
| _(optional) Engineering lead_ | | ☐ Approve ☐ Reject | |

**Once signed, this document supersedes the requirement that Phase 0 fully PASS before any distribution occurs.** Full Phase 0 PASS (Tier 1 + Tier 2 complete) remains the target for the CLI's `v1.0.0` release and for unlocking Phase 1.