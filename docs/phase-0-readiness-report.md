# Phase 0 Readiness Report

**Date:** 2026-08-13
**Scope:** DevVault setup orchestration and readiness foundation
**Status:** Verification Gate FAILED - NEEDS FIXES

This report records implementation evidence for Phase 0. It is not a claim of production readiness, native Windows compatibility or completion of later authentication and policy phases.

## Implementation

Implemented in the Phase 0 task sequence:

- Typed setup results and profile-scoped readiness rules.
- Vault lifecycle and local/remote backend contracts.
- Dependency, consent, installation and orchestration ports.
- Strict allowlisted `SetupState` validation.
- Platform dependency and local Docker Vault adapters.
- Read-only remote Vault backend.
- Capability-based backend selection and readiness validation.
- Ordered setup orchestration with check, repair, lock and state persistence.
- User-level atomic state store with exclusive lock.
- `devvault setup` command surface with human/JSON output and result exit codes.
- Security acceptance and readiness scenario suites.
- Standalone distribution evaluation without packaging implementation.

## Evidence

| Area | Evidence | Result |
| --- | --- | --- |
| Core contracts and profiles | `packages/core/src/**/*.test.ts` | PASS |
| Platform and backend adapters | `packages/platform/src/**/*.test.ts` | PASS |
| Setup command | `apps/cli/src/commands/setup.test.ts` and packaged `setup --check --json` | FAIL for production wiring: default pipeline only runs dependency step |
| Security acceptance | `tests/security/devvault-setup.test.ts` | PASS, 4 tests |
| Readiness scenarios | `tests/e2e/devvault-setup.test.ts` | PASS, 4 tests |
| Repository validation | `corepack pnpm test` | PASS, 33 files / 107 tests |
| Build validation | `corepack pnpm lint`, `typecheck`, `build` | PASS |
| Distribution decision | `docs/distribution.md` | REVIEWED, implementation deferred |

## Platform Status

| Platform | Implementation | Tested | Status |
| --- | --- | --- | --- |
| Linux | Implemented | Yes, WSL2 Linux runtime | PASS |
| WSL2 | Implemented | Yes | PASS WITH LIMITATIONS; Docker Desktop-specific behavior is not proven |
| Windows native | Expected by adapters | No | NOT TESTED; Credential Manager, native paths and native process behavior remain unverified |
| PowerShell bridge | Adapter signals implemented | Yes through WSL bridge | PASS WITH LIMITATIONS; runtime remained Linux/WSL |
| Docker Desktop | Detection/policy boundary implemented | No | BLOCKED BY ENVIRONMENT; installation/modification is prohibited by current policy |
| Remote Vault | Read-only adapter implemented | Injected contract tests | TESTED WITH FIXTURES; live remote service not validated |

## Architecture Review Inputs

The implementation preserves the intended dependency direction:

```text
CLI -> Application/Orchestrator -> Core ports -> Platform/Vault adapters
```

Core does not import Docker, filesystem, keyring or platform APIs. Remote Vault uses the common read-only `VaultBackend` boundary and does not receive Docker operations. Setup state is handled by the platform adapter and validated by Core.

## Invariants

| Invariant group | Status | Evidence |
| --- | --- | --- |
| `INV-001..INV-005` secret/file/log/argv boundaries | PARTIAL | State/security tests pass, but global logs, exceptions and argv are not comprehensively covered |
| `INV-006..INV-008` Core dependency boundaries | PASS | Core typecheck and package import structure |
| `INV-009..INV-011` provider/store abstraction | PASS | Core ports and adapter tests |
| `INV-012..INV-014` backend capability/lifecycle separation | PARTIAL | Adapters pass in isolation; production setup does not consume selector/lifecycle validation |
| `INV-015..INV-018` runtime and extensibility boundaries | PARTIAL | Runtime/provider boundaries pass; INV-018 lacks individual evidence for every invariant |
| `INV-SETUP-001..INV-SETUP-005` result/profile/state/idempotency/recovery | PASS | model, state store, orchestrator and E2E readiness tests |
| `INV-SETUP-006..INV-SETUP-008` consent, restricted environment and platform boundary | PASS | consent, dependency and readiness tests |
| `INV-SETUP-009..INV-SETUP-012` no-secret state, backend and command boundaries | PASS | security acceptance and remote backend tests |

## Risks and Limitations

- Native Windows has not been executed in this environment.
- Secret Service/keyring availability is environment-dependent and is not replaced by a plaintext fallback.
- Docker Desktop installation and modification are intentionally blocked by policy.
- Environment variables can be inspected by local tools and child processes.
- A compromised workstation, Docker daemon or Vault deployment can expose secrets.
- The independent verifier found that the production setup path does not wire backend selection, lifecycle/KV validation or `ProfileSetupValidator`.
- The discrimination sensor found a surviving mutant in the default setup dependency step.
- T20 correction adds effective KV v2 mount inspection and effective Vault capability checks; final independent re-verification remains pending.
- T21 strengthens recursive result sanitization, validator exception handling, argv stability and Project A/B policy isolation evidence; live Vault isolation remains pending.
- T22 stabilizes the serial gate and verifies non-interactive consent plus authenticated read-only capability requests; Windows, Docker Desktop and live remote Vault remain environmental limitations.
- T23 closes controllable verifier findings for human output sanitization, generic step exceptions and non-interactive consent; live-system and platform limitations remain explicitly open.
- T24 classifies remaining gaps honestly, preserves historical FAIL records, adds lifecycle-word sanitization precision and a reproducible isolated mutation-sensor command; T24 remains pending independent verification.
- T24 mutation evidence: `corepack pnpm mutation:test` generated 8 mutations, killed 8 and left 0 survived in `docs/phase-0-mutation-report.json`.
- The current setup command surface is the Phase 0 orchestration boundary; full human authentication, CredentialStore expansion, AppRole, OIDC, final policies, dynamic secrets and Vault Agent remain future phases.
- Standalone packaging is a documented future decision; no binary, installer or auto-update path is implemented.

## Recommendation

**NEEDS FIXES - SEE [INDEPENDENT VALIDATION](../.specs/features/devvault-setup/validation.md).**

The historical verification found the production-wiring gap. T19 and T20 address production wiring and effective KV/policy validation, but the Phase 0 status remains `NEEDS FIXES` until the independent verifier re-runs after T20. Native Windows remains `NOT TESTED` and Docker Desktop remains `BLOCKED BY ENVIRONMENT`. Do not mark Phase 0 `COMPLETED` or begin Phase 1.
