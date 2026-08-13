# Phase 0 MVP Release Approval

**Date:** 2026-08-13
**Approver:** Technical owner
**ADR Reference:** [ADR-Phase0-MVP-Release-Scope.md](ADR-Phase0-MVP-Release-Scope.md)
**Commit:** 7f50ca1 (docs: formalize two-tier gate model and MVP release scope)

## Approval Decision

**APPROVED** — DevVault CLI v0.1.0-mvp is approved for release and distribution under the scope defined in ADR-Phase0-MVP-Release-Scope.md.

### Scope Approved

- **Tier 1 (Core Correctness):** PASS
  - Setup logic, validation, security, error semantics proven by 134 tests, mutation sensor (8/8 killed), static gates (lint/typecheck/build all PASS)
  - Support: Linux, macOS, local/dev-mode Vault
  
- **Tier 2 (Infra-Verified):** PENDING (tracked, scheduled, not blocking MVP release)
  - Windows CI runner, Docker Desktop environment, remote Vault provisioning, multi-policy Vault setup tracked with named blockers and unblock conditions
  - Item #5 (proc/log coverage) scheduled as T25-series, independent of items #1–#4

- **MVP Release Form Factor:** v0.1.0-mvp (pre-1.0), CLI for developers to install and run
  - In scope: `setup`, `--check`, `--json`, `--repair`, `--non-interactive --yes` commands
  - Distribution: suitable for trusted internal developers on Linux/macOS
  - Out of scope (tracked limitations): native Windows, Docker Desktop, live remote Vault, multi-project isolation, full proc/log/dump coverage

### Limitations Acknowledged

All known limitations are explicitly documented in:
- [RELEASE-NOTES.md](../../RELEASE-NOTES.md) — user-facing platform status and risks
- [ADR-Phase0-MVP-Release-Scope.md](ADR-Phase0-MVP-Release-Scope.md) §6 — risk acceptance
- [README.md](../../README.md) — scope & limitations section
- [CHANGELOG.md](../../CHANGELOG.md) — v0.1.0-mvp release notes

Risk acceptance confirmed: platform risk, environment risk, isolation risk, and observability risk are bounded and named. No silent gaps or "false PASS" claims.

### Unblocked Activities

1. ✓ **Distribution:** CLI can now be packaged and distributed to target audience (Linux/macOS developers)
2. ✓ **Installation documentation:** Installation instructions can be published with limitations clearly stated
3. ✓ **Early adopter onboarding:** Internal developers on Linux/macOS can install and use this release
4. ✓ **Tracking next phases:**
   - T25 (proc/log coverage): code-only work, should be prioritized before next milestone
   - Tier 2 items #1–#4: assigned to backlog; tracked with owners and unblock preconditions
   - Phase 1 planning: can now proceed with Phase 0 Tier 1 as a stable foundation

### Do Not Start

- ☑ **Phase 1** until Tier 2 tracking is in place AND sign-off is recorded (✓ now complete)
- ☑ **Unbounded Phase 0 correction cycles** against Tier 2 infrastructure-dependent items — they require external approvals, not code fixes
- ☑ **Distribution to Windows/untrusted external users** without explicit risk acknowledgment and documented limitations

### Evidence Trail

**Tier 1 PASS evidence:**
- Tests: 134 passing, 2 serial runs, consistent
- Mutation sensor: [docs/phase-0-mutation-report.json](../phase-0-mutation-report.json) — 8/8 killed, 0 survived
- Static gates: lint, typecheck, build, Specification validation, Tasks validation — all PASS
- Commits: 940309d (T19), 5092a90 (T20/T23), bc5ec10 (T24), e5160cc (T24), 7f50ca1 (MVP decision)

**Tier 2 tracking:**
- [ADR-Phase0-MVP-Release-Scope.md](ADR-Phase0-MVP-Release-Scope.md) §5 — 5 items with blockers and unblock conditions
- [.specs/features/devvault-setup/tasks.md](../../.specs/features/devvault-setup/tasks.md) — T24 complete, T25 planned
- [.specs/features/devvault-setup/validation.md](../../.specs/features/devvault-setup/validation.md) — historical audit trail preserved

### Related Documentation

- [Phase 0 Readiness Report](../phase-0-readiness-report.md)
- [Release Notes](../../RELEASE-NOTES.md)
- [Architecture Documentation](../architecture.md)
- [Security Model](../security.md)

---

**This approval unblocks MVP distribution and Phase 1 planning.**

Next step: Schedule T25 (proc/log coverage) and formalize Tier 2 ownership/timeline.
