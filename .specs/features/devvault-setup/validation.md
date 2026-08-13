# DevVault Setup Validation

**Date**: 2026-08-13
**Spec**: `.specs/features/devvault-setup/spec.md`
**Design**: `.specs/features/devvault-setup/design.md`
**Tasks**: `.specs/features/devvault-setup/tasks.md`
**Diff range**: `d21ad30..62aa1c8`
**Verifier**: independent verifier sub-agent (author != verifier)

## Verdict

**FAIL**

The Phase 0 implementation has substantial contracts, adapters and tests, but the production `devvault setup` path is not wired to the backend selector, Vault lifecycle validation, KV validation or `ProfileSetupValidator`. The default command can therefore report `READY` after only the dependency step. Phase 1 must not start.

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1-T13 | Done | Core contracts, adapters, validator, orchestrator and state store implemented and tested in isolation/injected scenarios. |
| T14 | Partial | Command is registered, but production setup defaults to one dependency step. |
| T15 | Partial | Security suite passes, but does not cover the real CLI wiring or all invariant surfaces. |
| T16 | Partial | Readiness scenarios use injected steps, not the production default pipeline. |
| T17 | Done | Distribution evaluation documented; implementation deferred. |
| T18 | Done | Documentation and prior readiness report updated. |

## Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Specification validation | PASS | `validate_spec.py`: 0 errors, 0 warnings |
| Tasks validation | PASS WITH WARNINGS | `validate_tasks.py`: 0 errors, 5 warnings |
| Full tests | PASS | `corepack pnpm test`: 33 files, 107 tests |
| Lint | PASS | `corepack pnpm lint` |
| Typecheck | PASS | `corepack pnpm typecheck` |
| Build | PASS | `corepack pnpm build` |
| Security acceptance | PASS WITH GAPS | `tests/security/devvault-setup.test.ts`: 4 tests; real CLI wiring not covered |
| E2E/readiness | PASS WITH GAPS | `tests/e2e/devvault-setup.test.ts`: 4 injected-scenario tests |
| Architecture scan | PASS WITH GAPS | Core forbidden-import scan found no matches; production composition wiring is incomplete |
| TLC state validation | FAIL | `validate_state.py`: `validation.md` was absent before this report; FAIL verdict is not eligible for completion |

## Spec-Anchored Acceptance Coverage

| Criterion | Evidence | Result |
| --- | --- | --- |
| Setup validates dependencies before mutation | `apps/cli/src/commands/setup.ts:70-88` | PASS for dependency step only |
| Setup selects backend and validates lifecycle/KV/capabilities before READY | `apps/cli/src/commands/setup.ts:115-123`; no production call to selector/validator | GAP: default command can return READY without these checks |
| Consent precedes required mutation | `packages/core/src/setup-orchestrator.ts:46-58`; `packages/core/src/setup-orchestrator.test.ts` | PARTIAL: injected mutating steps covered; default pipeline has no mutating steps |
| `--check` is read-only | `packages/core/src/setup-orchestrator.ts:42-45`; orchestrator tests | PASS for injected steps; no production E2E assertion |
| JSON output is sanitized and shares result/exit code | `apps/cli/src/commands/setup.ts:42-46,91-94`; CLI unit tests | PARTIAL: no packaged CLI exit-code/JSON E2E |
| Repeated setup is idempotent | `tests/e2e/devvault-setup.test.ts:25-35` | PARTIAL: injected steps only |
| Repair resumes without destructive reset | `tests/e2e/devvault-setup.test.ts:38-79` | PARTIAL: injected steps only |
| Remote-check remains read-only | `tests/e2e/devvault-setup.test.ts:101-133`; remote backend tests | PARTIAL: remote adapter fixture, not production command wiring |
| Security boundaries reject credential leakage | `tests/security/devvault-setup.test.ts:30-111` | PARTIAL: global argv/log/exception coverage absent |
| `init-project` remains separate from setup | `apps/cli/src/commands/project.ts`; setup registration | PASS structurally, production interaction test absent |

## Invariant Audit

| ID | Status | Evidence / Reason |
| --- | --- | --- |
| INV-001 | PARTIAL | Config generation is tested, but all project-file paths are not globally audited. |
| INV-002 | PASS LIMITED | Security suite checks absence of `.env` and known secret files in its scenario. |
| INV-003 | PARTIAL | State store is protected; no global project-file secret scan through every command path. |
| INV-004 | GAP | No comprehensive capture of all CLI logs and adapter errors. |
| INV-005 | GAP | No assertion that secrets never appear in process argv. |
| INV-006 | PASS | Composition root owns adapter construction; Core has no infrastructure imports. |
| INV-007 | PASS | Application/Core contracts depend on ports. |
| INV-008 | PASS | Platform APIs remain outside Core. |
| INV-009 | PASS | Developer auth and application auth are separate abstractions. |
| INV-010 | PARTIAL | Bootstrap requires explicit admin token, but normal-workflow non-storage is not tested end to end. |
| INV-011 | PASS | CredentialStore is abstracted. |
| INV-012 | PARTIAL | Policies exist, but setup production path does not validate them. |
| INV-013 | PARTIAL | No Project A/Project B isolation acceptance test in this feature. |
| INV-014 | PASS LIMITED | Lifecycle mapping exists in adapters, but production setup does not consume it. |
| INV-015 | PASS | Runtime resolves mapped secrets at process launch. |
| INV-016 | PASS | Authentication providers are replaceable via interfaces. |
| INV-017 | PASS | Core is platform-independent. |
| INV-018 | FAIL | No individual automated evidence for every invariant; grouped documentation is insufficient. |
| INV-SETUP-001 | FAIL | Default setup does not validate selected backend, lifecycle, KV and mandatory capabilities before READY. |
| INV-SETUP-002 | PASS LIMITED | Strict SetupState allowlist rejects named credential categories. |
| INV-SETUP-003 | PARTIAL | Orchestrator supports consent; default production pipeline has no real mutation steps. |
| INV-SETUP-004 | PARTIAL | Idempotency is tested only with injected steps. |
| INV-SETUP-005 | PARTIAL | Repair is tested only with injected steps, not the real pipeline. |
| INV-SETUP-006 | PARTIAL | Docker policy blocking is tested, but non-interactive authorization is not fully enforced. |
| INV-SETUP-007 | PASS | No automatic Docker Desktop installation path exists. |
| INV-SETUP-008 | PASS | Core contracts do not depend on platform APIs, shell, Docker or OS paths. |
| INV-SETUP-009 | PARTIAL | Sanitization covers selected fields; deep and global leakage coverage is absent. |
| INV-SETUP-010 | PASS LIMITED | Root token is not persisted by SetupState; complete normal workflow is not tested. |
| INV-SETUP-011 | PASS | Local/remote backends share the capability contract; remote has no Docker methods. |
| INV-SETUP-012 | PASS LIMITED | Commands are separate; production interaction test is absent. |

## Architecture Findings

1. `createSetupDependencies()` injects only state store, dependency checker and consent; backend selector and validator are not connected to the command.
2. `createSetupSteps()` returns only the `dependencies` step, so the production default pipeline does not perform backend selection, Vault lifecycle validation, KV validation or mutating setup.
3. The discrimination sensor changed the default dependency step to incorrectly complete on blockers and the full suite still passed. This is a surviving mutant in the highest-risk production path.
4. `StepSetupOrchestrator` loads state before acquiring the writer lock, allowing concurrent writers to start from stale state.
5. Lock acquisition failures escape as exceptions instead of deterministically mapping to `FAILED`.

## Security Findings

- Hidden input does not echo typed passwords/secrets in the tested input path.
- Credential-bearing remote URLs are rejected without exposing the credential.
- The sanitizer does not provide deep, uniform protection for every result field/value.
- No complete assertions cover argv, all logs, adapter exceptions, `/proc` or process inspection.

## Discrimination Sensor

| Mutation | Result | Evidence |
| --- | --- | --- |
| Change default dependency step so blockers return `completed` | **SURVIVED** | Full 33-file/107-test suite remained green in isolated scratch; real worktree unchanged |

**Sensor result:** FAIL. The production default setup path is not discriminated by current tests.

## Ranked Gaps

1. **CRITICAL**: `devvault setup` can report `READY` without backend, Vault lifecycle, KV or mandatory capability validation.
2. **HIGH**: Backend selector, local/remote backend and profile validator are not wired into the production setup command.
3. **HIGH**: E2E/security tests exercise injected objects rather than the real CLI composition path.
4. **HIGH**: The discriminator mutant survives in the default setup path.
5. **HIGH**: `--non-interactive` does not fully implement explicit authorization semantics.
6. **MEDIUM**: Lock-before-load ordering and lock error mapping are unsafe/incomplete.
7. **MEDIUM**: Sanitization is not deep or globally tested.
8. **MEDIUM**: Native Windows and Docker Desktop remain NOT TESTED/BLOCKED BY ENVIRONMENT.

## Recommendation

**NEEDS FIXES. Do not approve Phase 0 completion and do not start Phase 1.**

The next action, if authorized, should be a separate fix task focused on wiring and production-path verification. This report itself does not implement those fixes.

## Subsequent Correction Record: T19 and T20

The historical verdict above remains unchanged. T19 (`940309d`) wired the production pipeline. T20 adds effective read-only KV v2 mount inspection through `HttpVaultClient.validateKvV2()` and effective policy capability checks through `checkCapabilities()` in both Vault backend adapters.

T20 evidence:

- 35 focused T19/T20 tests passed before the final full gate.
- 120 tests passed serially in the preceding T19 gate; T20 adds adapter, repair and production checks.
- Static capability flags with effective KV/policy failure return `BLOCKED`.
- `--check` invokes backend validation and does not invoke local Vault start.
- Repair revalidates steps marked `revalidateOnRepair`.
- Mandatory pending setup work returns `BLOCKED`, not `DEGRADED`.

Independent re-verification is still required after the T20 commit. Remaining known gaps from the previous review remain open: global argv/proc/log/exception coverage, live least-privilege and Project A/B isolation, native Windows, and Docker Desktop.

## Subsequent Correction Record: T21

T21 strengthens the remaining security boundary evidence without changing the approved architecture: public setup results are recursively sanitized, validator exception details map to a generic `FAILED`, process arguments remain unchanged during setup, and generated Project A/B policies are explicitly isolated. Live Vault least-privilege/isolation validation, native Windows and Docker Desktop remain unverified.

## Subsequent Correction Record: T22 and T23

T22 stabilized the serial verification gate, added explicit non-interactive consent enforcement evidence and verified authenticated read-only capability requests. T23 closes the remaining controllable verifier findings by sanitizing human-readable output, suppressing unexpected step exception details and enforcing non-interactive consent at the command boundary.

Two consecutive serial full gates passed with 133 tests each. Remaining gaps are environmental or live-system validation: Windows native, Docker Desktop, live remote Vault, live least privilege/Project A/B isolation, `/proc`, child-process inspection and formal reproducible mutation-run artifacts.

## T24 Verification Cycle

**Status: PENDING VERIFICATION**

This entry responds to the historical FAIL records from the T19/T20/T23 cycles without rewriting them. T24 classifies and addresses the remaining findings as follows:

| Gap | Classification | Evidence/status |
| --- | --- | --- |
| `unsealed` redaction precision | FIXABLE-NOW | Sanitization regression in `apps/cli/src/commands/setup.test.ts` |
| Historical `validation.md` FAIL | PROCESS-GAP | This non-destructive T24 entry is appended with pending verdict |
| `/proc`, child processes, dumps and global logs | PROCESS-GAP / ENVIRONMENT-BLOCKED | No global logger or child-process secret transport exists in Phase 0; live process inspection requires an authorized runner |
| Formal mutation sensor | PROCESS-GAP | `pnpm mutation:test` creates isolated worktrees and writes `docs/phase-0-mutation-report.json` |
| Native Windows | ENVIRONMENT-BLOCKED | Requires Windows CI/runner with Credential Manager and native CLI execution |
| Docker Desktop | ENVIRONMENT-BLOCKED | Current corporate environment blocks Docker Desktop installation/execution |
| Live Remote Vault | ENVIRONMENT-BLOCKED | Requires provisioned endpoint, network access and authorized credentials |
| Live least privilege / Project A/B | ENVIRONMENT-BLOCKED | Requires provisioned Vault, two policies/users and authorized test credentials |

Formal T24 sensor execution: `corepack pnpm mutation:test` produced `docs/phase-0-mutation-report.json` with 8 generated mutations, 8 killed and 0 survived. The T24 verdict remains `PENDING VERIFICATION` until the independent Verifier reviews this cycle.
