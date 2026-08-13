# DevVault Local Developer Lifecycle Tasks

## Execution Protocol

Implement these tasks with the `tlc-spec-driven` skill. Execute one task at a time. Each task requires tests and its gate to pass before the task is marked complete and committed. Do not modify Phase 0 feature artifacts. Do not implement `devvault stop` in this feature.

**Specification**: `.specs/features/devvault-local-lifecycle/spec.md`
**Design**: `.specs/features/devvault-local-lifecycle/design.md`
**Status**: Draft

## Test Coverage Matrix

> Generated from `AGENTS.md`, `docs/`, `vitest.config.ts`, package scripts, existing tests and the lifecycle Specification. Guidelines found: `AGENTS.md`, `docs/architecture/architecture-invariants.md`, `vitest.config.ts`, existing repository test suites.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Core lifecycle ports and service | unit | All lifecycle result branches; 1:1 to lifecycle acceptance criteria; every listed lifecycle edge case applicable to the service | `packages/core/src/**/*.test.ts` | `corepack pnpm test` |
| Vault client lifecycle operations | integration-style unit | Unseal request shape, HTTP errors, and secret-value non-disclosure | `packages/vault-client/src/**/*.test.ts` | `corepack pnpm test` |
| Platform lifecycle adapter | integration | Local start, health, unseal delegation, unavailable Docker, sealed and uninitialized states | `packages/platform/src/**/*.test.ts` | `corepack pnpm test` |
| CLI command and composition path | e2e | Real command registration and wiring for start, happy path, blocked lifecycle, repeated start and sanitized output | `apps/cli/src/**/*.test.ts`, `tests/e2e/**/*.test.ts` | `corepack pnpm test` |
| Security boundary | security | No unseal material or credentials in output, argv, state, exceptions, logs or project files | `tests/security/**/*.test.ts` | `corepack pnpm test` |
| Documentation and release metadata | none | Build and static consistency only; no runtime test required | `docs/usage.md`, `CHANGELOG.md`, package manifests | build gate |

## Gate Check Commands

> Generated from repository scripts and `vitest.config.ts`.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Core or adapter task with focused unit/integration tests | `corepack pnpm test` |
| Full | CLI, e2e or security task | `corepack pnpm test` |
| Build | Last task in a phase or release metadata task | `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build && corepack pnpm test` |

**Co-located tests:** Every code task includes tests in the same task. Tests must satisfy the matrix and derive assertions from the Specification rather than implementation details.

## Execution Plan

Phases execute sequentially. Tasks within each phase execute in order.

### Phase 1: Core lifecycle contracts

```text
T1 -> T2
T1 -> T3
```

### Phase 2: Infrastructure adapters

```text
T1 -> T4
T3 -> T5
T4 -> T5
```

### Phase 3: Production wiring

```text
T2 -> T6
T5 -> T6
T6 -> T7
```

### Phase 4: Evidence and release

```text
T7 -> T8
T8 -> T9
```

## Task Breakdown

### T1: Define lifecycle contracts and result models

**What**: Add the Core ports and typed models for `start`, lifecycle status, local lifecycle operations and local bootstrap material storage.
**Where**: `packages/core/src/developer-lifecycle-ports.ts`
**Depends on**: None
**Reuses**: `packages/core/src/vault-lifecycle.ts`, `packages/core/src/setup-model.ts`, `packages/core/src/setup-steps.ts`
**Requirements**: LIFECYCLE-004, LIFECYCLE-005, LIFECYCLE-006, LIFECYCLE-015, LIFECYCLE-018, LIFECYCLE-022

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Port types contain no Docker, Vault HTTP, filesystem, keyring or platform imports.
- [ ] Start/status inputs and sanitized result models reuse existing setup and lifecycle states.
- [ ] V1 contracts expose local initialization and bootstrap storage only through a dedicated infrastructure port.
- [ ] Unit tests verify lifecycle/result type behavior and sensitive values are not part of persisted metadata types.

**Tests**: unit
**Gate**: quick

**Status**: Complete
**Evidence**: `packages/core/src/developer-lifecycle-ports.test.ts` passes 3 focused tests; Core lifecycle contracts export no infrastructure dependencies and expose no initialization or bootstrap persistence operation.

### T2: Implement the Core developer lifecycle service

**What**: Implement lifecycle orchestration for local start/status using existing setup/backend/validator boundaries, including automatic local initialization and unseal.
**Where**: `packages/core/src/developer-lifecycle.ts`
**Depends on**: T1
**Reuses**: `StepSetupOrchestrator`, `SetupStateStore`, `BackendSelector`, `VaultBackend`, `SetupValidator`, `classifyVaultLifecycle`
**Requirements**: LIFECYCLE-001, LIFECYCLE-003, LIFECYCLE-004, LIFECYCLE-005, LIFECYCLE-006, LIFECYCLE-007, LIFECYCLE-008, LIFECYCLE-009, LIFECYCLE-010, LIFECYCLE-012, LIFECYCLE-015, LIFECYCLE-016, LIFECYCLE-017, LIFECYCLE-020, LIFECYCLE-022

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Ready environments skip unnecessary mutations and return `READY`.
- [ ] Stopped local backends request start through the local lifecycle port.
- [ ] `NOT_INITIALIZED` initializes only the owned local backend and never exposes bootstrap material.
- [ ] `SEALED` retrieves local bootstrap material without developer input and revalidates readiness.
- [ ] Remote lifecycle performs validation only and never receives local mutation operations.
- [ ] Repeated start, interrupted execution, consent denial and mandatory capability failures map to specified result states.
- [ ] Unit tests cover every applicable service branch and listed edge case.

**Tests**: unit
**Gate**: quick

**Status**: Superseded by automatic-bootstrap design; implementation work must be redone.

### T3: Add Vault client operator operations

**What**: Extend the Vault client contract with initialization and unseal operations used only by the local lifecycle adapter.
**Where**: `packages/vault-client/src/index.ts`
**Depends on**: T1
**Reuses**: Existing `HttpVaultClient.request` error mapping and Vault health contract
**Requirements**: LIFECYCLE-005, LIFECYCLE-006, LIFECYCLE-007, LIFECYCLE-020

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The client sends initialization and unseal requests only to the local Vault endpoint without placing material in a URL or command argument.
- [ ] HTTP success, sealed/error and malformed response paths map to existing safe errors.
- [ ] The unseal key is not included in error messages or returned metadata.
- [ ] Vault client tests assert request shape and absence of the key from serialized errors.

**Tests**: integration
**Gate**: quick

**Status**: Superseded; initialization operation still required.

### T4: Implement the local bootstrap material boundary

**What**: Implement the dedicated Docker-managed local bootstrap material boundary with restrictive file permissions and no project/state integration.
**Where**: `packages/platform/src/local-bootstrap-material-store.ts`
**Depends on**: T1
**Reuses**: platform path and filesystem adapter patterns
**Requirements**: LIFECYCLE-005, LIFECYCLE-007, LIFECYCLE-020

**Done when**:

- [ ] Bootstrap material is stored only under the dedicated local infrastructure boundary.
- [ ] Material never appears in setup state, project files, output or logs.
- [ ] Missing material is represented as a first-start condition, not a developer prompt.
- [ ] Tests cover save/load and forbidden project/state paths.

**Tests**: integration
**Gate**: quick

### T5: Implement the local lifecycle platform adapter

**What**: Implement the platform adapter that starts the owned local Compose backend, initializes/unseals Vault through the dedicated bootstrap boundary and reads health without exposing material.
**Where**: `packages/platform/src/local-vault-lifecycle.ts`
**Depends on**: T3, T4
**Reuses**: `DockerManager`, `DockerComposeManager`, `HttpVaultClient`, local backend configuration
**Requirements**: LIFECYCLE-002, LIFECYCLE-004, LIFECYCLE-005, LIFECYCLE-007, LIFECYCLE-011, LIFECYCLE-017, LIFECYCLE-020

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `start()` delegates only to the configured local Compose file.
- [ ] `health()` preserves initialized/sealed lifecycle facts.
- [ ] `unseal()` delegates the key only in memory and never writes state or files.
- [ ] Docker unavailable, Vault unavailable, sealed and uninitialized fixtures are represented without false readiness.
- [ ] Platform adapter tests cover delegation and failure mapping.

**Tests**: integration
**Gate**: quick

**Status**: Superseded; adapter must be extended for automatic bootstrap.

### T6: Wire lifecycle services in the composition root

**What**: Construct the Core lifecycle service, local lifecycle adapter and bootstrap material store through the existing composition root.
**Where**: `apps/cli/src/composition-root.ts`
**Depends on**: T2, T5
**Reuses**: Existing adapter construction, setup dependencies, input abstraction and Vault client configuration
**Requirements**: LIFECYCLE-001, LIFECYCLE-005, LIFECYCLE-010, LIFECYCLE-021

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Composition returns the lifecycle application service without constructing infrastructure in command modules.
- [ ] Local and remote backend selection remains explicit.
- [ ] Manual unseal input uses the existing hidden-input behavior and no CredentialStore bootstrap fallback.
- [ ] Composition tests prove the production dependency graph is wired.

**Tests**: integration
**Gate**: quick

**Status**: Superseded; composition must wire the local bootstrap boundary.

### T7: Register the `devvault start` command

**What**: Add the thin CLI command adapter and register it in the production command entry point with human-readable and sanitized JSON output.
**Where**: `apps/cli/src/commands/start.ts`
**Depends on**: T6
**Reuses**: Commander registration, setup result sanitization and command error handling
**Requirements**: LIFECYCLE-001, LIFECYCLE-006, LIFECYCLE-013, LIFECYCLE-014, LIFECYCLE-020, LIFECYCLE-021, LIFECYCLE-022

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `devvault start` is registered through the real CLI entry point.
- [ ] The command delegates all behavior to the lifecycle service.
- [ ] Human output hides implementation details while `--json` remains sanitized and uses existing result semantics.
- [ ] Non-interactive and blocked results return deterministic existing exit codes.
- [ ] The command module contains no Docker, Vault, filesystem, keyring or readiness rules.

**Tests**: e2e
**Gate**: full

**Status**: Complete
**Evidence**: `apps/cli/src/commands/start.test.ts` and `composition-root.test.ts` pass 5 tests; the CLI build succeeds and the public `start` command is registered through `index.ts`.

### T8: Add production-path lifecycle and security evidence

**What**: Add tests that invoke the real CLI registration/composition path and cover lifecycle scenarios and credential non-disclosure.
**Where**: `tests/e2e/devvault-local-lifecycle.test.ts`
**Depends on**: T7
**Reuses**: Existing recording adapters, setup fixtures and security test patterns
**Requirements**: LIFECYCLE-001, LIFECYCLE-003, LIFECYCLE-004, LIFECYCLE-005, LIFECYCLE-006, LIFECYCLE-007, LIFECYCLE-008, LIFECYCLE-009, LIFECYCLE-010, LIFECYCLE-011, LIFECYCLE-012, LIFECYCLE-013, LIFECYCLE-014, LIFECYCLE-016, LIFECYCLE-017, LIFECYCLE-018, LIFECYCLE-020, LIFECYCLE-021, LIFECYCLE-022

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Tests exercise the actual command registration/wiring rather than only isolated service constructors.
- [ ] Clean, repeated, stopped, sealed, uninitialized, unavailable, remote and restricted scenarios have asserted outcomes.
- [ ] Consent denial and non-interactive behavior assert zero unauthorized mutation calls.
- [ ] Output, state, exception and argument captures assert no credential leakage.
- [ ] The existing full test suite remains at or above its pre-task test count.

**Tests**: e2e
**Gate**: full

**Status**: Complete
**Evidence**: `tests/e2e/devvault-local-lifecycle.test.ts` and start command tests pass 7 focused cases; the full suite passes 39 files and 158 tests, covering production registration, repeat start, non-interactive blocking and output sanitization.

### T9: Document and version the lifecycle release

**What**: Update user-facing lifecycle documentation and bump the monorepo/CLI version with a matching changelog entry after implementation evidence passes.
**Where**: `docs/usage.md`
**Depends on**: T8
**Reuses**: Existing usage, setup and release-note conventions
**Requirements**: LIFECYCLE-001, LIFECYCLE-006, LIFECYCLE-007, LIFECYCLE-010, LIFECYCLE-013, LIFECYCLE-014

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Documentation presents `devvault start` as the primary local workflow.
- [ ] It explains `NOT_INITIALIZED`, manual V1 unseal, remote read-only behavior and `doctor` remediation without exposing credentials.
- [ ] `devvault stop` is documented as deferred, not falsely presented as implemented.
- [ ] Package manifests, CLI version and `CHANGELOG.md` contain the same new release version.
- [ ] Build, lint, typecheck and all tests pass.

**Tests**: none
**Gate**: build

**Status**: Complete
**Evidence**: `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm build` and `corepack pnpm test` all pass; full suite passes 39 files and 158 tests. Documentation and synchronized `0.1.3-mvp` release metadata are updated.

## Task Validation Tables

### Granularity and dependency cross-check

| Task | Atomic deliverable | Depends on | Diagram edge present |
| --- | --- | --- | --- |
| T1 | Core lifecycle contracts | None | Yes |
| T2 | Core lifecycle service | T1 | Yes |
| T3 | Vault client unseal operation | T1 | Yes |
| T4 | Local platform adapter | T3 | Yes |
| T5 | Composition wiring | T2, T4 | Yes |
| T6 | CLI command adapter | T5 | Yes |
| T7 | Production-path evidence | T6 | Yes |
| T8 | Documentation/release metadata | T7 | Yes |

### Test co-location validation

| Task | Test type | Matrix layer | Gate | Validation |
| --- | --- | --- | --- | --- |
| T1 | unit | Core lifecycle ports and service | quick | PASS |
| T2 | unit | Core lifecycle ports and service | quick | PASS |
| T3 | integration | Vault client lifecycle operations | quick | PASS |
| T4 | integration | Platform lifecycle adapter | quick | PASS |
| T5 | integration | Platform/CLI wiring | quick | PASS |
| T6 | e2e | CLI command and composition path | full | PASS |
| T7 | e2e/security | CLI command and security boundary | full | PASS |
| T8 | none | Documentation and release metadata | build | PASS |

## Traceability Baseline

| Requirement group | Tasks | Evidence status |
| --- | --- | --- |
| `LIFECYCLE-001` to `LIFECYCLE-004` | T1, T2, T4, T5, T6, T7 | Pending implementation |
| `LIFECYCLE-005` to `LIFECYCLE-007` | T1, T2, T3, T4, T6, T7, T8 | Pending implementation |
| `LIFECYCLE-008` to `LIFECYCLE-012` | T2, T4, T5, T7 | Pending implementation |
| `LIFECYCLE-013` to `LIFECYCLE-018` | T2, T5, T6, T7, T8 | Pending implementation |
| `LIFECYCLE-019` | Deferred; no implementation task | Explicitly out of current implementation scope |
| `LIFECYCLE-020` to `LIFECYCLE-022` | T1, T2, T3, T5, T6, T7 | Pending implementation |
