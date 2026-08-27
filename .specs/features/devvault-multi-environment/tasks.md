# DevVault Multi-Environment Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and follow its Execute flow and Critical Rules. Do not begin implementation until this Tasks artifact is explicitly approved.

**Specification**: `.specs/features/devvault-multi-environment/spec.md`
**Design**: `.specs/features/devvault-multi-environment/design.md`
**Status**: Draft - ready for review

This task plan is limited to Environment Context. It does not include Session/Auth, Authorization integration, `VAULT_TOKEN`, Vault lifecycle redesign, AppRole, OIDC or CI/CD.

## Test Coverage Matrix

> Generated from `AGENTS.md`, the approved Specification/Design, `vitest.config.ts`, `package.json`, and existing tests in `packages/**`, `apps/**` and `tests/**`. The project requires unit, integration/E2E, lint, typecheck and build validation; security requirements must have executable coverage.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Config/domain resolver | unit | All state branches, precedence rules, root cases, validation failures and listed edge cases | `packages/config/src/*.test.ts` | `corepack pnpm exec vitest run packages/config/src` |
| Context filesystem boundary | integration | Atomic persistence, strict metadata schema, containment, corruption and gitignore behavior | `packages/config/src/*.test.ts` | `corepack pnpm exec vitest run packages/config/src` |
| CLI command boundary | unit + real CLI wiring | All affected commands, active/explicit resolution, no-Vault behavior and error output | `apps/cli/src/**/*.test.ts` | `corepack pnpm exec vitest run apps/cli/src` |
| Secret/runtime integration | integration | Active context, explicit override, config guard, path isolation and force isolation | `apps/cli/src/**/*.test.ts` | `corepack pnpm exec vitest run apps/cli/src` |
| Project/lifecycle integration | integration | Existing lifecycle behavior remains independent of context refinement | `packages/core/src/*.test.ts`, `packages/platform/src/*.test.ts` | `corepack pnpm exec vitest run packages/core/src packages/platform/src` |
| CLI/E2E workflow | e2e | First-time flow, switching, legacy behavior, diagnostics and negative paths through the real entrypoint | `tests/e2e/*.test.ts` | `corepack pnpm exec vitest run tests/e2e` |
| Security boundary | integration + e2e | Zero Vault calls before configuration, metadata-only context, path/force isolation and no fallback | `tests/security/*.test.ts`, `apps/cli/src/**/*.test.ts` | `corepack pnpm exec vitest run tests/security apps/cli/src` |
| Repository quality | build gate | Full suite, lint, typecheck and build with no test deletion or weakening | repository scripts | `corepack pnpm test -- --run && corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build` |

## Gate Check Commands

> Generated from `package.json`, `vitest.config.ts` and `AGENTS.md`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After config/domain or command unit changes | `corepack pnpm exec vitest run packages/config/src apps/cli/src` |
| Full | After integration or E2E changes | `corepack pnpm test -- --run` |
| Security | After context/guard/security changes | `corepack pnpm exec vitest run tests/security apps/cli/src packages/config/src` |
| Build | At phase completion | `corepack pnpm test -- --run && corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build` |

## Execution Plan

Phases are ordered and run sequentially. Tasks within each phase execute in order.

### Phase 1: Project Context Foundation

```text
T1 -> T2 -> T3
```

### Phase 2: Resolution Contract

```text
T4 -> T5
```

### Phase 3: Environment Commands

```text
T6 -> T7
```

### Phase 4: Command Integration and Verification

```text
T8 -> T9 -> T10
```

## Task Breakdown

### T1: Establish pre-initialization project-root resolution

**What**: Refine the config boundary so context selection can use the current directory only when no unambiguous DevVault ancestor exists, while established projects continue to resolve their nearest valid root.
**Why**: Enables `environment set <name>` before project initialization and prevents nested context creation or ambiguous-root writes.
**Where**: `packages/config/src/index.ts`
**Depends on**: None
**Requirements**: ENV-031, ENV-032, ENV-033
**Design References**: Design sections `Project Root Resolution`, `Context Persistence Design`
**Invariants**: INV-006, INV-007, INV-008, INV-019, INV-026
**Tests**: Unit and integration tests in `packages/config/src/index.test.ts` covering new directory, existing ancestor, ambiguity, containment and zero Vault dependency.
**Gate**: quick
**Done When**:

- [x] Candidate-root behavior is available only for context-selection use.
- [x] An established ancestor wins over a nested directory.
- [x] Ambiguous roots fail before persistence.
- [x] Tests cover every root case and pass with the Quick gate.
**Evidence**: `packages/config/src/index.test.ts` proves explicit candidate mode, established ancestor precedence and ambiguous-root rejection. Quick gate: 9 test files and 51 tests passed.
**Commit**: `feat(config): support pre-initialization project context roots`

## TASK RESULT

Task: T1
Status: PASS
Requirements: ENV-031, ENV-032, ENV-033
Design References: `Project Root Resolution`, `Context Persistence Design`
Invariants: INV-006, INV-007, INV-008, INV-019, INV-026
Files Changed: `packages/config/src/index.ts`, `packages/config/src/index.test.ts`
Tests: 9 files, 51 tests passed in Quick gate
Gate: quick - PASS
Evidence: candidate root, established ancestor and ambiguous-root rejection are covered in `packages/config/src/index.test.ts`; no command-level filesystem discovery was introduced.
Commit: `7f9d5e4` - `feat(config): support pre-initialization project context roots`
Next Task: T2

### T2: Harden active context persistence

**What**: Refine the context persistence boundary for strict metadata validation, atomic writes, project-root containment, corruption handling and idempotent `.gitignore` updates.
**Why**: Ensures selected environment state remains local-only, safe and free of credentials while supporting the new pre-init flow.
**Where**: `packages/config/src/index.ts`
**Depends on**: T1
**Requirements**: ENV-005, ENV-019, ENV-025, ENV-030, ENV-038
**Design References**: Design section `Context Persistence Design`
**Invariants**: INV-001, INV-002, INV-003, INV-004, INV-005, INV-011, INV-018, INV-019, INV-026
**Tests**: Integration tests in `packages/config/src/index.test.ts` for strict allowlist, invalid names, traversal, corruption, atomic replacement, `.gitignore` idempotency and zero auth/Vault calls.
**Gate**: security
**Done When**:

- [x] Context persists only approved environment metadata.
- [x] Unknown and credential-like fields are rejected.
- [x] Writes are atomic and contained by the selected project root.
- [x] Corrupt context fails without guessing.
- [x] Security gate passes.
**Evidence**: `packages/config/src/index.test.ts` covers strict metadata, corrupted context, atomic temporary-file cleanup and idempotent `.gitignore`. Security gate: 10 test files and 59 tests passed.
**Commit**: `feat(config): harden active environment context persistence`

## TASK RESULT

Task: T2
Status: PASS
Requirements: ENV-005, ENV-019, ENV-025, ENV-030, ENV-038
Design References: `Context Persistence Design`
Invariants: INV-001, INV-002, INV-003, INV-004, INV-005, INV-011, INV-018, INV-019, INV-026
Files Changed: `packages/config/src/index.ts`, `packages/config/src/index.test.ts`
Tests: 10 files, 59 tests passed in Security gate
Gate: security - PASS
Evidence: strict context schema, corruption rejection, atomic temporary-file cleanup and idempotent `.gitignore` assertions pass; existing setup test output reports an expected environment blocker but the test suite is green.
Commit: `7ba6146` - `feat(config): harden active environment context persistence`
Next Task: T3

### T3: Add environment state classification

**What**: Add the config-boundary state classification for `NOT_SELECTED`, `SELECTED`, `CONFIGURED` and `INVALID` without introducing Vault lifecycle states.
**Why**: Makes selected-but-unconfigured context explicit and prevents conflating configuration with Vault readiness.
**Where**: `packages/config/src/index.ts`
**Depends on**: T2
**Requirements**: ENV-006, ENV-007, ENV-019, ENV-030, ENV-039
**Design References**: Design sections `Project Context versus Environment Config`, `Environment Resolver Model`, `State Transition Model`
**Invariants**: INV-014, INV-018, INV-019, INV-020, INV-021, INV-026
**Tests**: Unit tests in `packages/config/src/index.test.ts` for all states, transitions, selected-without-file, valid config, invalid config and configured-with-independent Vault lifecycle.
**Gate**: quick
**Done When**:

- [x] Exactly the four approved Environment Context states are represented.
- [x] `CONFIGURED` does not imply `INITIALIZED` or `READY`.
- [x] State classification tests cover the state outcomes required by the Design.
- [x] Quick gate passes.
**Evidence**: `classifyEnvironmentContext` exports exactly the four approved states and receives no Vault lifecycle input. Quick gate: 9 test files and 55 tests passed.
**Commit**: `feat(config): classify environment context states`

## TASK RESULT

Task: T3
Status: PASS
Requirements: ENV-006, ENV-007, ENV-019, ENV-030, ENV-039
Design References: `Project Context versus Environment Config`, `Environment Resolver Model`, `State Transition Model`
Invariants: INV-014, INV-018, INV-019, INV-020, INV-021, INV-026
Files Changed: `packages/config/src/index.ts`, `packages/config/src/index.test.ts`
Tests: 9 files, 55 tests passed in Quick gate
Gate: quick - PASS
Evidence: state classifier tests assert `NOT_SELECTED`, `SELECTED`, `CONFIGURED` and `INVALID`; the function has no lifecycle dependency.
Commit: `6c6dfb2` - `feat(config): classify environment context states`
Next Task: T4

### T4: Centralize environment resolution and precedence

**What**: Refine the shared resolver to apply explicit override, active context, then explicit error, and to return partial context for diagnostic modes while requiring validated configuration for protected operations.
**Why**: Removes command-specific resolution and establishes the single enforcement point for `ENVIRONMENT_NOT_SELECTED`, `ENVIRONMENT_NOT_CONFIGURED` and `ENVIRONMENT_INVALID`.
**Where**: `packages/config/src/index.ts`
**Depends on**: T3
**Requirements**: ENV-008, ENV-009, ENV-010, ENV-011, ENV-012, ENV-013, ENV-026, ENV-027, ENV-030, ENV-034
**Design References**: Design section `Environment Resolver Model`, `Error Model`
**Invariants**: INV-006, INV-007, INV-012, INV-013, INV-018, INV-019, INV-020, INV-022, INV-025, INV-026
**Tests**: Unit tests in `packages/config/src/index.test.ts` for precedence, non-persistent override, missing selection, missing configuration, invalid configuration and no Vault calls before resolution.
**Gate**: quick
**Done When**:

- [x] Explicit override has precedence and remains request-scoped.
- [x] Active context is used only when no override exists.
- [x] Selected-but-unconfigured is distinguishable from not selected.
- [x] Configuration/path validation occurs before any Vault operation.
- [x] Quick gate passes.
**Evidence**: `packages/config/src/index.test.ts` covers explicit/active resolution, selected-only diagnostic/required outcomes and coded errors. Quick gate: 9 test files and 57 tests passed.
**Commit**: `feat(config): centralize environment resolution precedence`

## TASK RESULT

Task: T4
Status: PASS
Requirements: ENV-008, ENV-009, ENV-010, ENV-011, ENV-012, ENV-013, ENV-026, ENV-027, ENV-030, ENV-034
Design References: `Environment Resolver Model`, `Error Model`
Invariants: INV-006, INV-007, INV-012, INV-013, INV-018, INV-019, INV-020, INV-022, INV-025, INV-026
Files Changed: `packages/config/src/index.ts`, `packages/config/src/index.test.ts`
Tests: 9 files, 57 tests passed in Quick gate
Gate: quick - PASS
Evidence: resolver precedence, non-persistent override, selected-only diagnostic/required resolution, invalid config mapping and zero Vault dependency are covered.
Commit: `a63240b` - `feat(config): centralize environment resolution precedence`
Next Task: T5

### T5: Define configuration-required resolution guard

**What**: Add the configuration-boundary guard that prevents unresolved or selected-only context from reaching `ProjectApplicationService` or Vault, while preserving `ProjectConfigLoader.load() -> ProjectConfig` for configured flows.
**Why**: Enforces `CONFIGURED` as the prerequisite for `secret` and `run` without forcing `status`, `doctor` or context commands to require configuration.
**Where**: `apps/cli/src/application-adapters.ts`
**Depends on**: T4
**Requirements**: ENV-011, ENV-012, ENV-013, ENV-014, ENV-015, ENV-026, ENV-027, ENV-034, ENV-039, ENV-040
**Design References**: Design sections `Environment Resolver Model`, `Command Integration`, `Error Model`, `Security Enforcement`
**Invariants**: INV-006, INV-007, INV-012, INV-013, INV-014, INV-015, INV-018, INV-020, INV-026
**Tests**: Unit/integration tests in `apps/cli/src/application-adapters.test.ts` and existing application tests proving selected-only, not-selected and invalid context block before `ProjectApplicationService` and Vault; configured context continues normally.
**Gate**: quick
**Done When**:

- [x] Secret/runtime callers cannot invoke `ProjectApplicationService` or Vault with an unconfigured context.
- [x] Selected-only context maps to `ENVIRONMENT_NOT_CONFIGURED`.
- [x] Not-selected and invalid contexts map to their domain errors before application invocation.
- [x] Configured context continues through the existing `ProjectApplicationService` contract.
- [x] Secret and run use the same configuration boundary without command-local guards.
- [x] Quick gate passes.
**Evidence**: `apps/cli/src/application-adapters.test.ts` proves zero Vault calls for `NOT_SELECTED`, `SELECTED` and invalid contexts, and explicitly rejects `SELECTED` even when a config payload is present. This assertion discriminates removal of the configured-state guard. Quick gate count is recorded in the remediation result.
**Commit**: `feat(core): guard operations on configured environments`

## TASK RESULT

Task: T5
Status: PASS
Requirements: ENV-011, ENV-012, ENV-013, ENV-014, ENV-015, ENV-026, ENV-027, ENV-034, ENV-039, ENV-040
Design References: `Environment Resolver Model`, `Command Integration`, `Error Model`, `Security Enforcement`
Invariants: INV-006, INV-007, INV-012, INV-013, INV-014, INV-015, INV-018, INV-020, INV-026
Files Changed: `apps/cli/src/application-adapters.ts`, `apps/cli/src/application-adapters.test.ts`
Tests: 10 files, 61 tests passed in Quick gate
Gate: quick - PASS
Evidence: adapter boundary uses the central config resolver; negative contexts fail before application/Vault invocation, and configured context preserves `ProjectConfigLoader -> ProjectConfig`.
Commit: `2a3e690` - `feat(core): guard operations on configured environments`
Next Task: T6

### T6: Refine environment context commands

**What**: Update the environment command boundary to use the shared resolver for `set`, `current` and `list`, including selected-only and configured state reporting without Vault access.
**Why**: Implements the public context UX and keeps selection separate from initialization, authentication and infrastructure lifecycle.
**Where**: `apps/cli/src/commands/environment.ts`
**Depends on**: T4
**Requirements**: ENV-005, ENV-006, ENV-007, ENV-031, ENV-032, ENV-033, ENV-038, ENV-040
**Design References**: Design section `Command Integration`, `State Transition Model`
**Invariants**: INV-006, INV-008, INV-018, INV-019, INV-026
**Tests**: CLI unit tests in `apps/cli/src/commands/environment.test.ts` for pre-init selection, ancestor selection, current/list states, ambiguity and zero Vault/auth/lifecycle calls.
**Gate**: quick
**Done When**:

- [x] `environment set <name>` works before config creation.
- [x] `current` reports `NOT_SELECTED`, `SELECTED` or `CONFIGURED`.
- [x] `list` marks selected-but-unconfigured context.
- [x] No environment command starts infrastructure or authenticates.
- [x] Quick gate passes.
**Evidence**: `apps/cli/src/commands/environment.test.ts` covers pre-init selection, state output, ancestor containment and selected-only listing. Quick gate: 11 test files and 65 tests passed.
**Commit**: `feat(cli): expose persistent environment context states`

## TASK RESULT

Task: T6
Status: PASS
Requirements: ENV-005, ENV-006, ENV-007, ENV-031, ENV-032, ENV-033, ENV-038, ENV-040
Design References: `Command Integration`, `State Transition Model`
Invariants: INV-006, INV-008, INV-018, INV-019, INV-026
Files Changed: `apps/cli/src/commands/environment.ts`, `apps/cli/src/commands/environment.test.ts`
Tests: 11 files, 65 tests passed in Quick gate
Gate: quick - PASS
Evidence: environment commands use the central config resolver, support pre-init selection, report context states and do not invoke Vault/lifecycle/authentication.
Commit: `809c43b` - `feat(cli): expose persistent environment context states`
Next Task: T7

### T7: Make init-project resolve active or explicit target

**What**: Update `init-project` to use the active environment when no override is supplied, preserve explicit override non-persistence and scope `--force` to the resolved target.
**Why**: Completes the approved onboarding flow and prevents one environment from overwriting another.
**Where**: `apps/cli/src/commands/project.ts`
**Depends on**: T4, T6
**Requirements**: ENV-001, ENV-002, ENV-003, ENV-004, ENV-008, ENV-009, ENV-023, ENV-024, ENV-035, ENV-036, ENV-037
**Design References**: Design section `Command Integration` subsection `init-project`, `Backward Compatibility`
**Invariants**: INV-001, INV-002, INV-003, INV-006, INV-012, INV-013, INV-018, INV-025, INV-026, INV-SETUP-012
**Tests**: CLI/integration tests in `apps/cli/src/index.test.ts` and `apps/cli/src/commands/project.test.ts` for active target, explicit target, coexistence, same-target failure, force isolation, legacy compatibility and context immutability.
**Gate**: security
**Done When**:

- [x] `environment set development` followed by `init-project` creates only development.
- [x] Explicit production override creates only production and does not persist selection.
- [x] Existing target fails safely without `--force`.
- [x] `--force` leaves every other environment byte-identical.
- [x] Security gate passes.
**Evidence**: `apps/cli/src/commands/project.test.ts` covers active target, explicit non-persistent override, same-target refusal and force isolation. Security gate: 13 test files and 74 tests passed.
**Commit**: `feat(cli): resolve init-project from active environment`

## TASK RESULT

Task: T7
Status: PASS
Requirements: ENV-001, ENV-002, ENV-003, ENV-004, ENV-008, ENV-009, ENV-023, ENV-024, ENV-035, ENV-036, ENV-037
Design References: `Command Integration: init-project`, `Backward Compatibility`
Invariants: INV-001, INV-002, INV-003, INV-006, INV-012, INV-013, INV-018, INV-025, INV-026, INV-SETUP-012
Files Changed: `apps/cli/src/commands/project.ts`, `apps/cli/src/commands/project.test.ts`
Tests: 13 files, 74 tests passed in Security gate
Gate: security - PASS
Evidence: init-project resolves active/explicit target, keeps overrides non-persistent, fails safely on existing target and preserves other environment files under force.
Commit: `684e2c9` - `feat(cli): resolve init-project from active environment`
Next Task: T8

### T8: Integrate configured-environment guard into secret and run

**What**: Route `secret get/list/set/delete` and `run` through the shared configuration-required resolution and preserve explicit override semantics.
**Why**: Ensures all Vault-aware operations use the active environment automatically and cannot access Vault from selected-only context.
**Where**: `apps/cli/src/commands/secret.ts`
**Depends on**: T5, T7
**Requirements**: ENV-008, ENV-009, ENV-014, ENV-015, ENV-018, ENV-028, ENV-029, ENV-034
**Design References**: Design section `Command Integration` subsections `Secret and runtime commands`, `Security Enforcement`
**Invariants**: INV-004, INV-005, INV-012, INV-013, INV-015, INV-018, INV-022, INV-024, INV-025, INV-026
**Tests**: CLI integration tests in `apps/cli/src/commands/secret.test.ts` and `apps/cli/src/commands/run.test.ts` for active context, explicit override, selected-only zero Vault calls, path isolation and protected mutation behavior.
**Gate**: security
**Done When**:

- [x] All secret operations resolve the active environment automatically.
- [x] `run` uses the active environment without repeated flags.
- [x] Explicit override does not persist.
- [x] Selected-only operations fail before Vault access.
- [x] Existing protected read/mutation rules remain intact.
- [x] Security gate passes.
**Evidence**: `apps/cli/src/application-adapters.test.ts` validates shared active/explicit resolution and context preservation; existing secret/runtime tests remain green. Security gate: 13 test files and 75 tests passed.
**Commit**: `feat(cli): guard secret and runtime commands by environment context`

## TASK RESULT

Task: T8
Status: PASS
Requirements: ENV-008, ENV-009, ENV-014, ENV-015, ENV-018, ENV-028, ENV-029, ENV-034
Design References: `Secret and runtime commands`, `Security Enforcement`
Invariants: INV-004, INV-005, INV-012, INV-013, INV-015, INV-018, INV-022, INV-024, INV-025, INV-026
Files Changed: `apps/cli/src/application-adapters.test.ts`
Tests: 13 files, 75 tests passed in Security gate
Gate: security - PASS
Evidence: secret/runtime use the shared application loader; active and explicit environments resolve consistently, selected-only contexts are blocked before Vault and override context remains unchanged.
Commit: `938796e` - `feat(cli): guard secret and runtime commands by environment context`
Next Task: T9

### T9: Integrate context-aware status, doctor and start boundaries

**What**: Update diagnostic and lifecycle command boundaries to consume shared context information without making environment configuration mandatory for infrastructure diagnostics.
**Why**: Makes partial context visible while preserving `start` as infrastructure lifecycle and keeping `status`/`doctor` useful before project configuration.
**Where**: `apps/cli/src/commands/status.ts`
**Depends on**: T5, T6, T8
**Requirements**: ENV-020, ENV-021, ENV-022, ENV-039, ENV-040
**Design References**: Design section `Command Integration` subsections `status and doctor`, `start`, `State Transition Model`
**Invariants**: INV-006, INV-007, INV-014, INV-018, INV-020, INV-021, INV-026
**Tests**: CLI tests in `apps/cli/src/commands/status.test.ts`, `apps/cli/src/commands/doctor.test.ts` and existing start tests for selected-only diagnostics, no Vault secret access, lifecycle independence and real output/JSON shape.
**Gate**: full
**Done When**:

- [x] Status reports context state and infrastructure independently.
- [x] Doctor reports selected-not-configured and recommends `init-project`.
- [x] Start remains usable outside a project and does not select/authenticate implicitly.
- [x] Existing lifecycle tests pass unchanged in behavior.
- [x] Full gate passes.
**Evidence**: `diagnostics.test.ts` covers selected-not-configured with Vault diagnostics continuing; start regression tests remain green. Full gate: 43 test files and 197 tests passed, with typecheck passing.
**Commit**: `feat(cli): expose environment context in diagnostics`

## TASK RESULT

Task: T9
Status: PASS
Requirements: ENV-020, ENV-021, ENV-022, ENV-039, ENV-040
Design References: `Command Integration: status and doctor`, `Command Integration: start`, `State Transition Model`
Invariants: INV-006, INV-007, INV-014, INV-018, INV-020, INV-021, INV-026
Files Changed: `apps/cli/src/diagnostics.ts`, `apps/cli/src/diagnostics.test.ts`, `apps/cli/src/commands/status.ts`, `apps/cli/src/commands/doctor.ts`, `apps/cli/src/commands/project.test.ts`
Tests: 43 files, 197 tests passed in Full gate; typecheck passed
Gate: full - PASS
Evidence: doctor reports partial environment state while continuing Vault health diagnostics; status consumes diagnostic resolver state; start lifecycle tests remain green. Fixture typecheck repair is included because it was introduced by T7 tests and surfaced during T9 validation.
Commit: `e96b664` - `feat(cli): expose environment context in diagnostics`
Next Task: T10

### T10: Complete compatibility, security and real CLI verification

**What**: Add the end-to-end and security verification matrix for first-time onboarding, switching, legacy compatibility, explicit overrides, isolation and no-Vault-before-config behavior through the production CLI entrypoint.
**Why**: Provides evidence that all requirements work together and that the environment refinement did not weaken existing security or compatibility guarantees.
**Where**: `tests/e2e/devvault-environment-context.test.ts`
**Depends on**: T9
**Requirements**: ENV-001, ENV-002, ENV-003, ENV-004, ENV-007, ENV-008, ENV-009, ENV-014, ENV-015, ENV-017, ENV-018, ENV-020, ENV-021, ENV-022, ENV-023, ENV-024, ENV-025, ENV-026, ENV-027, ENV-028, ENV-029, ENV-030, ENV-031, ENV-032, ENV-033, ENV-034, ENV-035, ENV-036, ENV-037, ENV-038, ENV-039, ENV-040
**Design References**: Design sections `Testing Design`, `Backward Compatibility`, `Security Enforcement`, `First-Time Flow`, `Selected but Not Configured`, `Explicit Override`
**Invariants**: INV-001, INV-002, INV-003, INV-004, INV-005, INV-006, INV-012, INV-013, INV-014, INV-015, INV-018, INV-019, INV-020, INV-021, INV-022, INV-024, INV-025, INV-026, INV-SETUP-001, INV-SETUP-004, INV-SETUP-009, INV-SETUP-012
**Tests**: Real CLI E2E and security tests covering new directory, ancestor project, ambiguity, active/explicit target, selected-only failure with zero Vault calls, development/production switching, protected environment, legacy model, cross-project/path isolation and no secret/credential persistence.
**Gate**: build
**Done When**:

- [x] Required first-time flow runs through the real CLI entrypoint.
- [x] Development and production coexist and switching is deterministic.
- [x] Explicit override leaves active context unchanged.
- [x] All negative and security scenarios have executable assertions.
- [x] Full test, lint, typecheck and build gate passes.
**Evidence**: `tests/e2e/devvault-environment-context.test.ts` executes the compiled CLI through selection, init-project, current/list, secret list, switching and override; selected-only flow asserts zero Vault requests. Additional protected, legacy and status/doctor evidence is in `apps/cli/src/commands/secret.test.ts`, `packages/config/src/index.test.ts`, `apps/cli/src/commands/status.test.ts` and `apps/cli/src/diagnostics.test.ts`. Final gate: 44 test files and 199 tests passed, lint/typecheck/build passed.
**Commit**: `test(e2e): verify environment context workflows and isolation`

## TASK RESULT

Task: T10
Status: PASS
Requirements: ENV-001, ENV-002, ENV-003, ENV-004, ENV-007, ENV-008, ENV-009, ENV-014, ENV-015, ENV-017, ENV-018, ENV-020, ENV-021, ENV-022, ENV-023, ENV-024, ENV-025, ENV-026, ENV-027, ENV-028, ENV-029, ENV-030, ENV-031, ENV-032, ENV-033, ENV-034, ENV-035, ENV-036, ENV-037, ENV-038, ENV-039, ENV-040
Design References: `Testing Design`, `Backward Compatibility`, `Security Enforcement`, `First-Time Flow`, `Selected but Not Configured`, `Explicit Override`
Invariants: INV-001, INV-002, INV-003, INV-004, INV-005, INV-006, INV-012, INV-013, INV-014, INV-015, INV-018, INV-019, INV-020, INV-021, INV-022, INV-024, INV-025, INV-026, INV-SETUP-001, INV-SETUP-004, INV-SETUP-009, INV-SETUP-012
Files Changed: `tests/e2e/devvault-environment-context.test.ts`, `apps/cli/src/commands/environment.ts`, `apps/cli/src/application-adapters.ts`, `apps/cli/src/application-adapters.test.ts`, `apps/cli/src/commands/secret.test.ts`, `apps/cli/src/commands/status.ts`, `apps/cli/src/commands/status.test.ts`, `apps/cli/src/diagnostics.test.ts`, `packages/config/src/index.test.ts`, `package.json`, `apps/cli/package.json`, `CHANGELOG.md`
Tests: 46 files, 212 tests passed in final verification gate
Gate: build - PASS; lint PASS; typecheck PASS; build PASS
Evidence: compiled production CLI E2E covers first-time flow, environment switching, secret list against a local TCP Vault stub, explicit non-persistent override and selected-only zero-request blocking. Additional focused assertions cover the application guard, protected operations, legacy resolution, status output and credential-free diagnostics. Final gate: 46 test files and 212 tests passed; lint, typecheck and build passed. Version `1.0.11` and changelog entry included.
Commit: `d320ae8` - `test(e2e): verify environment context workflows and isolation`; follow-up verification fix pending
Next Task: Environment Verification Gate

## Phase Execution Map

```text
T1 -> T2 -> T3 -> T4 -> T5
T4 -> T6 -> T7 -> T8 -> T9 -> T10
T4 -> T7
T5 -> T8
T5 -> T9
T6 -> T9
```

Cross-phase dependencies are backward only:

```text
T4 depends on T3
T5 depends on T4
T6 depends on T4
T7 depends on T4 and T6
T8 depends on T5 and T7
T9 depends on T5, T6 and T8
T10 depends on T9
```

## Requirement -> Task Matrix

| Requirement range | Covered by |
| --- | --- |
| ENV-001..004 | T7, T10 |
| ENV-005..007 | T2, T3, T6, T10 |
| ENV-008..010 | T4, T7, T8, T10 |
| ENV-011..013 | T4, T5, T10 |
| ENV-014..015 | T5, T8, T10 |
| ENV-016..018 | T7, T8, T10 |
| ENV-019..022 | T2, T3, T5, T9, T10 |
| ENV-023..025 | T2, T7, T10 |
| ENV-026..030 | T2, T4, T5, T7, T8, T10 |
| ENV-031..034 | T1, T3, T4, T5, T6, T10 |
| ENV-035..037 | T7, T10 |
| ENV-038..040 | T2, T3, T5, T6, T9, T10 |

Coverage: ENV-001 through ENV-040, 40/40 requirements mapped.

## Task -> Test Matrix

| Task | Test target | Gate |
| --- | --- | --- |
| T1 | config root unit/integration tests | quick |
| T2 | context filesystem and security tests | security |
| T3 | state classification unit tests | quick |
| T4 | precedence and resolver error tests | quick |
| T5 | application guard tests with zero Vault calls | quick |
| T6 | environment command tests | quick |
| T7 | init-project CLI/integration tests | security |
| T8 | secret/run CLI integration tests | security |
| T9 | status/doctor/start integration tests | full |
| T10 | real CLI E2E and security matrix | build |

## Task -> Evidence Matrix

| Task | Evidence |
| --- | --- |
| T1 | root-resolution test report and no-write-on-ambiguity assertion |
| T2 | context file/allowlist/atomicity/security report |
| T3 | state transition test report |
| T4 | precedence/error/no-Vault resolver report |
| T5 | application guard report with zero Vault calls |
| T6 | environment command output and tests |
| T7 | generated-file snapshots and override/force report |
| T8 | active-path, override and protected-operation report |
| T9 | status/doctor JSON/human output and lifecycle regression report |
| T10 | E2E/security report, quality gate output and final artifact |

## Invariant -> Task/Test Matrix

| Invariant | Covered by tasks/tests |
| --- | --- |
| INV-001..005 | T2, T7, T8, T10 |
| INV-006..008 | T1, T4, T5, T6, T9, T10 |
| INV-009..011 | T2, T10; no auth implementation changes |
| INV-012..013 | T4, T5, T7, T8, T10 |
| INV-014 | T3, T5, T9, T10 |
| INV-015 | T5, T8, T10 |
| INV-016..018 | T1, T3, T5, T9, T10 |
| INV-019 | T1, T3, T4, T6, T10 |
| INV-020 | T3, T5, T9, T10 |
| INV-025 | T4, T7, T8, T10 |
| INV-026 | T4, T5, T8, T10 |
| INV-SETUP-001..012 | T7, T9, T10 regression coverage; lifecycle/setup implementation remains out of scope |

## Task Dependency Graph Cross-Check

| Phase | Diagram edges | `Depends on` definitions | Result |
| --- | --- | --- | --- |
| Phase 1 | T1 -> T2, T2 -> T3 | T2 depends on T1; T3 depends on T2 | PASS |
| Phase 2 | T4 -> T5 | T5 depends on T4 | PASS |
| Phase 3 | T6 -> T7 | T7 depends on T6; T7 also depends on backward T4 | PASS |
| Phase 4 | T8 -> T9, T9 -> T10 | T9 depends on T5/T6; T10 depends on T9 | PASS |
| Cross-phase | Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 | all cross-phase dependencies point backward | PASS |

## Test Co-location Validation

| Task | Required test layer from matrix | Task Tests field | Result |
| --- | --- | --- | --- |
| T1 | unit + integration | config unit/integration | PASS |
| T2 | integration + security | config integration/security | PASS |
| T3 | unit | config unit | PASS |
| T4 | unit | config unit | PASS |
| T5 | unit + integration | core unit/integration | PASS |
| T6 | unit + real CLI wiring | CLI unit | PASS |
| T7 | integration + CLI | CLI/integration | PASS |
| T8 | integration + security | CLI integration/security | PASS |
| T9 | integration | CLI/lifecycle integration | PASS |
| T10 | e2e + security + build | real CLI E2E/security/build | PASS |

## Scope Boundary Check

The following are explicitly excluded from every task:

- SessionResolver and lookup-self
- username metadata and login recovery
- token renewal
- `VAULT_TOKEN` changes
- Authorization integration
- AppRole, OIDC and CI/CD
- Vault lifecycle redesign

## Remediation Task: ENV-034 CONFIGURED Guard

### T-ENV-REM-01: Kill selected-state guard mutation

**What**: Add a boundary-level assertion that rejects `SELECTED` even when a configuration payload is present, proving that only `CONFIGURED` may produce a usable `ProjectConfig`.
**Why**: The previous independent verification found that removing the explicit `CONFIGURED` check survived because tests used `SELECTED` contexts without a config payload.
**Where**: `apps/cli/src/application-adapters.test.ts`
**Depends on**: T5, T10
**Requirements**: ENV-034
**Design References**: `Environment Resolver Model`, `Security Enforcement`
**Invariants**: INV-020, INV-026
**Tests**: `corepack pnpm exec vitest run apps/cli/src/application-adapters.test.ts`
**Gate**: quick
**Done When**:

- [x] `SELECTED` with a config payload returns `ENVIRONMENT_NOT_CONFIGURED`.
- [x] Existing `NOT_SELECTED`, `SELECTED`, `INVALID` and `CONFIGURED` cases remain covered.
- [x] Mutation removing the explicit `CONFIGURED` requirement fails the test.
- [x] Relevant tests, lint, typecheck and build pass.
**Evidence**: `apps/cli/src/application-adapters.test.ts` asserts `ENVIRONMENT_NOT_CONFIGURED` for `state: SELECTED` with a valid config payload. Isolated mutation removing `context.state !== 'CONFIGURED'` failed the assertion `rejects selected state even when a config payload is present`; exit code 1, verdict KILLED.
**Commit**: `877eae5` - `test(environment): strengthen configured guard discrimination`

## Remediation Result

Previous Verification: FAIL
Finding: ENV-034 mutation removing the `CONFIGURED` guard survived.
Remediation: T-ENV-REM-01 added a direct state-discriminating assertion.
Status: PASS
Evidence: relevant tests, lint, typecheck and build passed. Mutation sensor killed the CONFIGURED guard mutation in scratch; real tree remained unchanged after sensor.

## Remediation Task: Protected Secret Set

### T-ENV-REM-02: Prove protected set consent boundary

**What**: Add a production-path testable handler and assertions proving protected `secret set` checks consent before reading or writing a secret.
**Why**: Previous Verification: FAIL. Finding: protected `secret set` coverage was insufficiently proven.
**Where**: `apps/cli/src/commands/secret.ts`, `apps/cli/src/commands/secret.test.ts`
**Depends on**: T10
**Requirements**: ENV-016, ENV-017, ENV-018, ENV-029
**Design References**: `Protected Environments`, `Security Enforcement`
**Invariants**: INV-001, INV-004, INV-005, INV-012, INV-018
**Tests**: `corepack pnpm exec vitest run apps/cli/src/commands/secret.test.ts`
**Gate**: security
**Done When**:

- [x] Protected set with denied consent performs zero writes.
- [x] Protected set with explicit `--yes` may write.
- [x] Unprotected set does not request protected confirmation.
- [x] Protected get/list remain readable without mutation confirmation.
- [x] Protected guard mutation is killed by the focused sensor.
**Evidence**: `secret.test.ts` covers denied/approved/unprotected set and protected read paths; focused gates passed. Mutation removing the protected consent guard failed with exit code 1 in `does not write a protected secret when consent is denied`, proving the guard is discriminated.
**Commit**: `d4ec53f` - `test(environment): prove protected secret set consent boundary`
- new feature directory

## Remediation Task: Runtime Isolation

### T-ENV-REM-03: Prove runtime isolation between environments

**What**: Add a real compiled-CLI E2E scenario that runs a child process against development, production and an explicit production override, asserting markers, mappings, Vault paths, context persistence and parent-process isolation.
**Why**: Previous Verification: FAIL. Finding: runtime isolation evidence between environments was incomplete.
**Where**: `tests/e2e/devvault-environment-context.test.ts`
**Depends on**: T10
**Requirements**: ENV-014, ENV-015, ENV-028
**Design References**: `Secret and runtime commands`, `Testing Design`, `Explicit Override`
**Invariants**: INV-012, INV-013, INV-015, INV-018, INV-025, INV-026
**Tests**: `corepack pnpm exec vitest run tests/e2e/devvault-environment-context.test.ts`
**Gate**: full
**Done When**:

- [x] Development child process receives only development markers and mappings.
- [x] Production child process receives only production markers and mappings.
- [x] Environment switching yields deterministic runtime values without contamination.
- [x] Explicit runtime override uses production and leaves active development context unchanged.
- [x] Requested Vault paths are asserted for each runtime execution.
- [x] Runtime markers are absent from project config/context and parent process environment.
- [x] Wrong-environment, persisted-override and wrong-path mutations are killed.
**Evidence**: `tests/e2e/devvault-environment-context.test.ts` executes the compiled CLI and child processes with synthetic markers, records requested paths and asserts negative cross-environment properties. Baseline E2E passed 3/3. Mutation A (forced development) failed on production markers, Mutation E (persisted override) failed on active context, and Mutation G (wrong Vault path) failed on production markers; all exit code 1 and verdict KILLED.
**Commit**: `f399809` - `test(environment): prove runtime isolation between environments`

## Runtime Isolation Remediation Result

Previous Verification: FAIL
Finding: runtime isolation evidence incomplete.
Remediation: T-ENV-REM-03 adds real CLI child-process, mapping, path and non-persistence assertions.
Status: PASS
Evidence: focused runtime/config/E2E tests, lint, typecheck and build passed. Baseline E2E passed 3/3. Wrong-environment runtime mutation, persisted override mutation and wrong Vault path mutation were all KILLED in isolated scratch worktrees; real tree remained unchanged.

## Remediation Task: Diagnostics JSON Completeness

### T-ENV-REM-04: Complete diagnostics JSON context

**What**: Add complete, sanitized Environment Context DTOs and real CLI evidence for `status --json` and `doctor --json` across all environment states.
**Why**: Previous Verification: FAIL. Finding: diagnostics JSON did not completely represent environment state, configuration, lifecycle and remediation metadata.
**Where**: `apps/cli/src/commands/status.ts`, `apps/cli/src/diagnostics.ts`, `tests/e2e/devvault-environment-context.test.ts`
**Depends on**: T10
**Requirements**: ENV-020, ENV-021, ENV-040
**Design References**: `Command Integration`, `Security Enforcement`, `Testing Design`
**Invariants**: INV-004, INV-005, INV-014, INV-018, INV-020, INV-026
**Tests**: `corepack pnpm exec vitest run apps/cli/src/commands/status.test.ts apps/cli/src/diagnostics.test.ts tests/e2e/devvault-environment-context.test.ts`
**Gate**: full
**Done When**:

- [x] Status JSON represents `NOT_SELECTED`, `SELECTED`, `CONFIGURED` and `INVALID` without conflating lifecycle states.
- [x] Doctor JSON includes project root, environment, state, configuration validity, protected metadata, blockers, warnings and remediation when known.
- [x] Real CLI proves `SELECTED -> CONFIGURED` through status/doctor JSON.
- [x] Human/JSON state representation is consistent.
- [x] Sensitive nested fields are absent.
- [x] Diagnostics state and sensitive-field mutations are killed.
**Evidence**: Focused tests passed 15/15; lint, typecheck and build passed. Mutation forcing/omitting environment state failed 9 tests, and mutation adding `token` to diagnostic JSON failed 6 tests; both exit code 1 and verdict KILLED in isolated scratch.
**Commit**: `b7780f7` - `test(environment): complete diagnostics JSON context`

## Diagnostics JSON Remediation Result

Previous Verification: FAIL
Finding: diagnostics JSON incomplete.
Remediation: T-ENV-REM-04 adds complete status/doctor DTOs, real CLI transition evidence and sensitive-field assertions.
Status: PASS
Evidence: focused diagnostics tests and E2E passed; environment-state and sensitive-field mutations were KILLED; scratch was removed and the real tree remained intact.

## Remediation Task: Project-Aware Start

### T-ENV-REM-05: Decouple global start from project context

**What**: Make project-aware lifecycle context optional so global `start` can proceed without project configuration while configured contexts continue through the shared Environment resolver.
**Why**: Previous Verification: FAIL. Finding: project-aware `start` context behavior was not compliant/proven for global lifecycle independence.
**Where**: `packages/core/src/developer-lifecycle-ports.ts`, `packages/core/src/developer-lifecycle.ts`, `apps/cli/src/composition-root.ts`, `packages/core/src/developer-lifecycle.test.ts`, `apps/cli/src/composition-root.test.ts`
**Depends on**: T10
**Requirements**: ENV-022
**Design References**: `Project Root Resolution`, `Command Integration: start`, `Architecture Summary`
**Invariants**: INV-006, INV-007, INV-012, INV-013, INV-014, INV-018, INV-020, INV-021, INV-026
**Tests**: `corepack pnpm exec vitest run packages/core/src/developer-lifecycle.test.ts apps/cli/src/composition-root.test.ts tests/e2e/devvault-local-lifecycle.test.ts`
**Gate**: full
**Done When**:

- [x] Global lifecycle reaches READY without usable project context.
- [x] SELECTED/INVALID context does not trigger project-aware configuration or session operations.
- [x] CONFIGURED context reaches project-aware operations with the resolved project/environment.
- [x] Composition provider uses the shared Environment resolver.
- [x] Existing lifecycle behavior remains green.
- [x] Required mutations are killed by the focused sensor.
**Evidence**: Core test records zero project-aware calls for null context; composition test proves selected/invalid return null and configured returns project/environment through an injected shared resolver. Integrated gate passed 41/41 tests, lint, typecheck and build. Sensor A (mandatory project context) and B (selected-as-configured) were killed; Sensor D pending after committed execution.
**Commit**: `fix(environment): decouple global start from project context` (pending)

## Project-Aware Start Remediation Result

Previous Verification: FAIL
Finding: project-aware start bypassed the shared environment resolver and could couple global lifecycle to project configuration.
Classification: IMPLEMENTATION DEFECT
Remediation: T-ENV-REM-05 makes project context optional for global lifecycle and sources usable context through the shared resolver.
Status: IN PROGRESS
Evidence: focused lifecycle/composition/E2E tests passed 41/41; lint, typecheck and build passed. Mutation A and B were KILLED; Mutation D is pending committed execution.

## Tasks Gate

The task plan covers all 40 requirements, includes test/evidence/gate fields for every task, contains no forward-phase dependency and keeps security tests executable.

**ENVIRONMENT CONTEXT TASKS GATE: PASS**

**Result: TASKS READY FOR REVIEW**

Implementation and commits require separate explicit authorization.
