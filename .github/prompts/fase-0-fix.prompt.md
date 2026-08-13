---
name: Fase 0 Fix
description: This prompt is used to fix the Fase 0 issues in the project.
agent: agent
---

# PHASE 0 — VERIFICATION FAILURE CORRECTION
## Task: Restore the real production setup pipeline

A Phase 0 Verification Gate was executed and returned:

VERDICT: FAIL — NEEDS FIXES

Phase 1 is BLOCKED and MUST NOT be started.

Do NOT redesign Phase 0.
Do NOT create Phase 1 functionality.
Do NOT weaken tests.
Do NOT change the Specification or Design merely to make the current implementation pass.
Do NOT mark the Phase 0 as PASS without objective evidence.

The independent verifier identified the following primary defect:

The real production command `devvault setup` currently executes only the `dependencies` step.

The production CLI path does NOT correctly connect:

- SetupOrchestrator
- BackendSelector
- LocalDockerVaultBackend
- RemoteVaultBackend
- Vault lifecycle detection/validation
- KV validation
- ProfileSetupValidator
- real SetupStep pipeline
- real mutation pipeline
- final SetupResult calculation

As a consequence, `devvault setup` can incorrectly return READY without validating the mandatory backend, Vault lifecycle and capability requirements.

A mutation that converted blockers into `completed` survived the current tests because the existing tests do not exercise the real CLI production wiring.

The verification evidence is already recorded in:

- `validation.md`
- `phase-0-readiness-report.md`

The verification commit is:

`18dfca6` — `docs(governance): record phase zero verification`

Treat these reports as evidence. Do not delete or rewrite their historical meaning.

---

# OBJECTIVE

Correct ONLY the Phase 0 implementation necessary to make the real production command `devvault setup` execute the complete Phase 0 setup pipeline defined by the approved Specification and Design.

The final production flow must be equivalent to:

CLI
  ↓
SetupOrchestrator
  ↓
DependencyStep
  ↓
ConsentStep
  ↓
BackendSelectionStep
  ↓
BackendReadinessStep
  ↓
SetupStateStep
  ↓
ValidationStep
  ↓
SetupResult

The exact step names may differ if the existing Design uses different names, but the responsibilities MUST remain equivalent.

The CLI MUST NOT contain infrastructure-specific setup logic.

---

# FIRST: INSPECT BEFORE MODIFYING

Before changing code:

1. Read the current:
   - `spec.md`
   - `design.md`
   - `tasks.md`
   - `validation.md`
   - `phase-0-readiness-report.md`
   - relevant Architecture Authority/invariant documents.

2. Locate:
   - the real CLI registration for `devvault setup`;
   - the current setup command handler;
   - `SetupOrchestrator`;
   - all existing `SetupStep` implementations;
   - `BackendSelector`;
   - `VaultBackend`;
   - `LocalDockerVaultBackend`;
   - `RemoteVaultBackend`;
   - Vault lifecycle services/adapters;
   - `ProfileSetupValidator`;
   - setup state store;
   - result/status mapper.

3. Build a concrete dependency/wiring map showing which components are currently instantiated and which are not.

4. Identify the minimum production-wiring correction required.

Do not modify files during this inspection phase.

---

# REQUIRED IMPLEMENTATION

## 1. Connect the real CLI to SetupOrchestrator

`devvault setup` MUST invoke the real `SetupOrchestrator`.

It MUST NOT invoke only the dependency step directly.

The command must use the same application pipeline defined by the Design.

---

## 2. Register the complete setup pipeline

Ensure the production orchestrator receives all mandatory Phase 0 steps.

At minimum the pipeline must represent:

1. dependency detection
2. consent evaluation
3. backend selection
4. backend readiness/lifecycle validation
5. setup state handling
6. profile validation
7. final result aggregation

Use the existing architecture and implementations where available.

Do NOT create duplicate services if equivalent implementations already exist.

---

## 3. Backend selection MUST be real

The production path must actually invoke `BackendSelector`.

It must be capable of producing:

- local Docker backend;
- remote Vault backend;
- BLOCKED when neither is viable.

The result of backend selection must influence the final setup result.

A backend blocker MUST NOT be converted into `completed`.

---

## 4. Vault lifecycle MUST participate in readiness

The production path must actually evaluate the selected backend's Vault lifecycle.

At minimum distinguish:

- UNAVAILABLE
- NOT_INITIALIZED
- SEALED
- UNSEALED
- CONFIGURED
- READY

The exact existing lifecycle model must be reused if already implemented.

A sealed/unavailable/not-initialized Vault MUST NOT result in READY unless the approved profile explicitly considers that state optional.

Do not implement auto-unseal.

Do not introduce authentication features from later phases.

---

## 5. KV/capability validation MUST participate

The selected backend's required Phase 0 capabilities must be validated.

At minimum use the existing capability/profile model to ensure that mandatory capabilities are actually checked.

A mandatory capability failure MUST affect the final result.

---

## 6. ProfileSetupValidator MUST participate

The real production path must invoke the existing `ProfileSetupValidator` or the exact equivalent defined by the approved Design.

Do not bypass it.

Do not duplicate its rules inside the CLI.

The profile must determine which capabilities are mandatory versus optional.

---

# RESULT SAFETY

The following rules are NON-NEGOTIABLE:

READY:
- only when all mandatory requirements for the selected profile pass.

DEGRADED:
- only when all mandatory requirements pass and only optional capabilities are unavailable.

BLOCKED:
- environment restriction;
- missing externally actionable dependency;
- missing required consent;
- Vault state requiring operator action;
- unavailable required backend.

FAILED:
- corrupt state;
- lock conflict;
- atomic persistence failure;
- malformed backend response;
- unexpected internal/transport failure.

Never convert a blocker or failure into `completed`.

Never return READY merely because the dependency step succeeded.

---

# CRITICAL REGRESSION TEST

Create or update an E2E test that executes the REAL production CLI/application path.

Do NOT test only the orchestrator in isolation.

The test must prove:

`devvault setup`
→ real CLI handler
→ real application wiring
→ SetupOrchestrator
→ complete SetupStep pipeline
→ BackendSelector
→ backend readiness
→ validator
→ final SetupResult.

Use recording/fake adapters where necessary, but preserve the real production wiring.

---

# MANDATORY NEGATIVE TESTS

Add tests proving that the production command does NOT return READY when:

1. Docker is unavailable and no remote backend exists.
2. Backend selection is BLOCKED.
3. Vault is unavailable.
4. Vault is sealed.
5. Vault is not initialized.
6. A mandatory KV/capability check fails.
7. Profile validation returns a mandatory blocker.
8. Consent is denied.
9. A setup step returns `blocked`.
10. A setup step returns `failed`.

For every case, assert the final public status and exit code.

Expected mapping:

READY     = 0
DEGRADED  = 3
BLOCKED   = 4
FAILED    = 5

---

# MUTATION/SENSOR REGRESSION

The verifier previously demonstrated that a mutation converting blockers into `completed` survived.

Create a regression test specifically designed to kill that mutation.

The test MUST fail if code changes:

`blocked → completed`

or:

`failed → completed`

or:

`mandatory capability failure → READY`

This test must exercise the production command path, not only a unit test.

---

# COMMAND MODES

Verify the production wiring for:

`devvault setup`

`devvault setup --check`

`devvault setup --json`

`devvault setup --repair`

`devvault setup --non-interactive`

`devvault setup --yes`

Rules:

- `--check` MUST remain read-only.
- `--json` MUST use the same underlying result.
- `--repair` MUST use the real orchestrator/recovery pipeline.
- `--non-interactive` without required authorization MUST return BLOCKED.
- `--yes` only authorizes explicitly classified operations.
- no command may bypass the orchestrator to obtain a shortcut READY result.

---

# ARCHITECTURE CONSTRAINTS

Do NOT violate the approved boundaries.

Core/Application may depend on ports.

Core MUST NOT import:

- `node:os`
- `node:child_process`
- `process.platform`
- `keytar`
- shell commands
- Docker APIs
- Windows APIs
- WSL APIs
- platform-specific paths.

Docker, filesystem, OS, keyring and platform behavior MUST remain in adapters.

The CLI should only perform command parsing/composition and invoke application services.

Do NOT turn SetupOrchestrator into a God Object.

---

# SCOPE CONTROL

This correction is Phase 0 ONLY.

DO NOT implement:

- AppRole
- OIDC
- CI/CD
- auto-unseal
- full human login
- renewal
- revocation
- final application policies
- final identities
- dynamic secrets
- Vault Agent
- real additional CredentialStore functionality
- automatic Docker Desktop installation
- final standalone binaries.

RemoteVaultBackend remains read-only in Phase 0.

---

# TASK MANAGEMENT

Create a correction task derived from this Verification Finding.

Use the existing TLC task format.

The correction task MUST contain:

- Task ID
- What
- Why
- Where
- Depends On
- Requirement reference
- Design reference
- Tests
- Gate
- Done When
- Evidence
- Atomic Commit

Do NOT create a large collection of unrelated tasks yet.

First implement the primary production-wiring correction and its regression tests.

After implementation, update `tasks.md` with the correction task and its evidence.

---

# TESTS AND GATES

After implementation run at minimum:

corepack pnpm lint
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build

Then run the relevant Phase 0 E2E/security tests.

Specifically verify the real production command path.

Do not accept:

"unit tests pass"

as evidence that the CLI wiring is correct.

The critical evidence must demonstrate that the REAL command invokes the complete setup pipeline.

---

# VERIFICATION AFTER FIX

After tests pass:

1. Re-run the mutation/sensor test.
2. Verify the previous `blocked → completed` mutation is killed.
3. Verify mandatory capability failure cannot produce READY.
4. Verify Vault sealed cannot produce READY.
5. Verify no backend cannot produce READY.
6. Verify consent denial produces BLOCKED.
7. Verify `--check` performs no mutations.
8. Verify JSON remains sanitized.
9. Verify architecture boundaries remain intact.

Then update:

- `tasks.md`
- `validation.md`
- `phase-0-readiness-report.md`

Do NOT change the historical Verification Gate result from FAIL to PASS merely by editing the report.

The new evidence must be recorded as a subsequent verification/correction result.

---

# STOP CONDITIONS

STOP and report instead of guessing if:

- the current Design contradicts the implementation;
- a required component does not exist;
- implementing the fix would require a Phase 1+ feature;
- the production CLI architecture is fundamentally different from the approved Design;
- a requirement must be changed;
- an invariant must be redefined.

In these cases, do not silently modify Specification or Design.

---

# FINAL RESPONSE FORMAT

When finished, report:

## Correction Implemented
- files changed
- production wiring fixed
- pipeline now executed

## Tests
- commands executed
- results

## Regression
- blocker → completed mutation
- mandatory capability → READY mutation
- sealed Vault → READY mutation

## Evidence
- E2E test names
- relevant logs/output
- commit hash

## Remaining Gaps
- only objectively verified remaining gaps

## Phase 0 Status
- `FIXED — READY FOR RE-VERIFICATION`
or
- `STILL FAILING — <exact blocker>`

DO NOT declare Phase 0 PASS yourself.

An independent Verifier must perform the final Phase 0 Gate.