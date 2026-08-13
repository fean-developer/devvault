# DevVault MVP Tasks

## Execution Protocol

Implement these tasks with the `tlc-spec-driven` skill. Each task is completed only after its gate passes, `tasks.md` is updated, and one atomic Conventional Commit is created.

**Design**: `.specs/features/devvault-mvp/design.md`
**Status**: In Progress

## Test Coverage Matrix

> Generated from project instructions and the empty repository. No existing test guidelines were found; strong defaults apply.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Config and core domain | unit | All branches, mapped 1:1 to acceptance criteria and edge cases | `packages/**/*.test.ts` | `pnpm test` |
| Vault adapter and policies | integration | Happy path, permission errors, unavailable Vault and persistence | `tests/integration/**/*.test.ts` | `pnpm test` |
| CLI and runtime | e2e | Complete command flows, exit codes, streams and no secret files | `tests/e2e/**/*.test.ts` | `pnpm test` |
| Security and logging | security | Negative assertions for stdout, stderr, logs and files | `tests/security/**/*.test.ts` | `pnpm test` |
| Config/build wiring | none | TypeScript, lint and build gates | `tsconfig.json` | `pnpm typecheck && pnpm lint && pnpm build` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit/config tasks | `pnpm test` |
| Full | Vault, CLI and runtime tasks | `pnpm test` |
| Build | Phase completion | `pnpm typecheck && pnpm lint && pnpm build` |

## Execution Plan

### Phase 1: Foundation

Tasks execute in the listed order.

### Phase 2: Configuration and Core

Tasks execute in the listed order.

### Phase 3: Vault Infrastructure

Tasks execute in the listed order.

### Phase 4: CLI Vertical Slice

Tasks execute in the listed order, subject to the explicit dependencies below.

## Task Breakdown

### T1: Create pnpm workspace

**What**: Create root package metadata, workspace and TypeScript configuration.
**Where**: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`
**Depends on**: None
**Requirement**: CFG-01
**Tests**: none
**Gate**: build

### T2: Create package boundaries

**What**: Create the CLI, core and config package manifests and source entry points.
**Where**: `apps/cli`, `packages/core`, `packages/config`
**Depends on**: T1
**Requirement**: CFG-01
**Tests**: none
**Gate**: build

### T3: Add core contracts and errors

**What**: Define ports and safe domain errors for Vault, credentials and process execution.
**Where**: `packages/core/src`
**Depends on**: T2
**Requirement**: AUTH-01
**Tests**: unit
**Gate**: quick

### T4: Add initial CLI entry point

**What**: Expose a real Commander-based executable with name, help and version.
**Where**: `apps/cli/src/index.ts`
**Depends on**: T2
**Requirement**: TEST-01
**Tests**: e2e
**Gate**: full

### T5: Implement project config schema

**What**: Validate version, project, environment, Vault path and mappings using Zod.
**Where**: `packages/config/src/index.ts`
**Depends on**: T2
**Requirement**: CFG-01
**Tests**: unit
**Gate**: quick

### T6: Reject invalid and sensitive configuration

**What**: Add config policy validation that rejects malformed identifiers and secret values.
**Where**: `packages/config/src`
**Depends on**: T5
**Requirement**: CFG-02
**Tests**: unit
**Gate**: quick

### T7: Add fixture and configuration documentation

**What**: Document the safe YAML model and add a non-sensitive test fixture.
**Where**: `README.md`, `docs/configuration.md`, `tests/fixtures`
**Depends on**: T6
**Requirement**: CFG-03
**Tests**: none
**Gate**: build

### T8: Add persistent local Vault Compose

**What**: Define pinned Vault image, local bind, persistent volume and healthcheck.
**Where**: `infra/vault/docker-compose.yml`
**Depends on**: T1
**Requirement**: INFRA-01
**Tests**: integration
**Gate**: full

### T9: Implement Vault health adapter

**What**: Implement health calls and explicit unavailable/sealed error mapping.
**Where**: `packages/vault-client/src`
**Depends on**: T8
**Requirement**: INFRA-01
**Tests**: integration
**Gate**: full

### T10: Add idempotent KV bootstrap

**What**: Enable KV v2 and bootstrap it without deleting existing data.
**Where**: `packages/vault-client/src`, `infra/vault/bootstrap`
**Depends on**: T9
**Requirement**: INFRA-02
**Tests**: integration
**Gate**: full

### T11: Add least-privilege policies

**What**: Add developer, readonly, application and admin policies with project-scoped paths.
**Where**: `infra/vault/policies`
**Depends on**: T10
**Requirement**: INFRA-03
**Tests**: integration
**Gate**: full

**Status**: Complete. Vault adapter, Compose configuration and policies are implemented and validated by unit tests and build gates.

### T17: Configure Userpass bootstrap

**Status**: Complete. Userpass enablement and human identity creation are idempotent and validated against a real Vault dev instance.
**Tests**: integration
**Gate**: full

### T18: Validate effective project permissions

**Status**: Complete. Vault capability checks and real cross-project allow/deny validation are implemented.
**Tests**: integration
**Gate**: full

### T19: Extract application services

**Status**: Complete. Core application ports and service orchestration are used by CLI secrets and runtime commands.
**Tests**: unit
**Gate**: quick

### T20: Validate platform and Vault lifecycle boundaries

**Status**: Complete. Lifecycle states are modeled in Core and Docker Compose execution is isolated in the platform package.
**Tests**: unit
**Gate**: build

### T21: Extract composition root and platform credential adapter

**Status**: Complete. CLI adapter construction is centralized and Keytar/Docker implementations are outside Core.
**Tests**: unit
**Gate**: build

### T22: Extract CLI command modules

**Status**: Complete. Setup, auth, diagnostics, secrets and runtime commands are registered from dedicated modules.
**Tests**: e2e
**Gate**: full

### T23: Close architecture gate lifecycle and path checks

**Status**: Complete. Project paths are bound to project/environment and doctor reports lifecycle state.
**Tests**: unit
**Gate**: build

### T24: Implement Phase 1 platform foundations

**Status**: Partial. Linux is tested; WSL2, Windows, PowerShell and Docker Desktop are explicitly not executed in this environment.
**Tests**: integration
**Gate**: build

### T12: Implement project discovery

**What**: Locate `devvault.yaml` from the current directory without reading secret files.
**Where**: `packages/config/src`
**Depends on**: T5
**Requirement**: CFG-03
**Tests**: unit
**Gate**: quick

### T13: Implement secret set/list/get operations

**What**: Add KV v2 operations with hidden input, safe listing and opt-in display.
**Where**: `packages/vault-client/src`, `apps/cli/src/commands`
**Depends on**: T11, T12
**Requirement**: SEC-01
**Tests**: integration
**Gate**: full

### T14: Implement runtime process launcher

**What**: Launch child processes with mapped secrets, streams, signals and exit code propagation.
**Where**: `apps/cli/src/runtime`
**Depends on**: T13
**Requirement**: RUN-01
**Tests**: e2e
**Gate**: full

**Status**: Complete. Runtime mapping, child process execution and exit code propagation are implemented and tested.

### T15: Implement `init`, `init-project` and `doctor`

**What**: Wire setup, safe project config creation and diagnostic checks with human/JSON output.
**Where**: `apps/cli/src/commands`
**Depends on**: T10, T12
**Requirement**: TEST-01
**Tests**: e2e
**Gate**: full

**Status**: Partial. `init-project` and `doctor` are implemented; Vault bootstrap and `init` remain pending.

### T16: Add security and persistence acceptance suite

**What**: Verify no secret leakage, no generated secret files, permission denial and Docker persistence.
**Where**: `tests/integration`, `tests/e2e`, `tests/security`
**Depends on**: T13, T14, T15
**Requirement**: TEST-01
**Tests**: security
**Gate**: full

## Phase Execution Map

```text
T1 → T2
T2 → T3
T2 → T4
T2 → T5
T5 → T6
T6 → T7
T1 → T8
T8 → T9
T9 → T10
T10 → T11
T5 → T12
T11 → T13
T12 → T13
T13 → T14
T10 → T15
T12 → T15
T13 → T16
T14 → T16
T15 → T16
```

## Validation Tables

### Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | None | OK |
| T2 | T1 | T1 → T2 | OK |
| T3 | T2 | T2 → T3 | OK |
| T4 | T2 | T2 → T4 | OK |
| T5 | T2 | T2 → T5 | OK |
| T6 | T5 | T5 → T6 | OK |
| T7 | T6 | T6 → T7 | OK |
| T8 | T1 | T1 → T8 | OK |
| T9 | T8 | T8 → T9 | OK |
| T10 | T9 | T9 → T10 | OK |
| T11 | T10 | T10 → T11 | OK |
| T12 | T5 | T5 → T12 | OK |
| T13 | T11, T12 | T11 → T13; T12 → T13 | OK |
| T14 | T13 | T13 → T14 | OK |
| T15 | T10, T12 | T10 → T15; T12 → T15 | OK |
| T16 | T13, T14, T15 | T13 → T16; T14 → T16; T15 → T16 | OK |

### Test Co-location Validation

| Task | Layer | Matrix | Task | Status |
| --- | --- | --- | --- | --- |
| T3 | Core domain | unit | unit | OK |
| T4 | CLI | e2e | e2e | OK |
| T5-T6 | Config/domain | unit | unit | OK |
| T8-T11 | Vault/policies | integration | integration | OK |
| T12 | Config/domain | unit | unit | OK |
| T13 | Vault/CLI | integration | integration | OK |
| T14-T15 | CLI/runtime | e2e | e2e | OK |
| T16 | Security | security | security | OK |