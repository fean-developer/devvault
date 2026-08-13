# DevVault Setup Specification

**Status**: Approved

## Problem Statement

Developers should be able to prepare and validate DevVault without knowing Docker, Docker Compose, Vault, KV v2, pnpm or Corepack. The `devvault setup` workflow must detect the environment, request consent before mutations, select a viable Vault backend, persist only non-sensitive setup metadata, recover from interruption and report an evidence-based result.

## Goals

- [ ] Provide a transparent setup orchestration contract without implementing the setup command in this phase.
- [ ] Distinguish setup results from Vault lifecycle states.
- [ ] Guarantee that setup metadata never persists credentials or secret values.
- [ ] Define local Docker and remote Vault backends behind one capability-based contract.
- [ ] Make every Phase 0 requirement traceable to design, tasks, tests, evidence and a gate.
- [ ] Define explicit readiness profiles, exit codes, recovery semantics and distribution boundaries before Design.

## Out of Scope

| Feature | Reason |
| --- | --- |
| AppRole | Phase 9 application authentication |
| OIDC and CI/CD | Phase 10 federated authentication |
| Dynamic secrets | Post-MVP Vault capability |
| Vault Agent | Post-MVP runtime integration |
| Automatic unseal | Requires operator/auto-unseal policy and belongs to lifecycle hardening |
| Full human login, renewal and revocation | Later authentication phases |
| Final application policies and identities | Phase 6 |
| Real OS CredentialStore implementation | Phase 4; Phase 0 defines the boundary and availability contract only |
| Automatic Docker Desktop installation | Prohibited by environment and architecture constraints |
| Standalone binary packaging implementation | Phase 0 evaluates and records the distribution decision only |
| `init-project` behavior | Project configuration remains separate from environment setup |
| Standalone distribution | Phase 0 records the decision criteria; final packaging remains outside implementation scope |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Setup result states | `READY`, `DEGRADED`, `BLOCKED`, `FAILED`; `NOT_READY` is internal only | Prevents an ambiguous final state from masking blockers | y |
| Vault lifecycle states | `UNAVAILABLE`, `NOT_INITIALIZED`, `SEALED`, `UNSEALED`, `CONFIGURED`, `READY` | Matches the Architecture Authority lifecycle | y |
| Local backend | Docker plus Vault HTTP API | Existing supported backend and Phase 1 adapter boundary | y |
| Remote backend | Explicitly configured Vault HTTP API | Same capability contract without Docker operations | y |
| Docker Desktop installation | Never automatic | Corporate restrictions and security policy | y |
| Setup state location | User configuration directory through a platform adapter | Keeps metadata outside project files | y |
| Setup state contents | Strict allowlist of non-sensitive metadata | Prevents credential persistence | y |
| `--check` behavior | Read-only; no mutating ports may execute | Makes preflight safe and deterministic | y |
| Non-interactive consent | Missing authorization returns `BLOCKED` | Prevents silent system mutation | y |
| `DEGRADED` | Only optional capabilities may be unavailable | Mandatory failures must be `BLOCKED` or `FAILED` | y |
| Local bootstrap readiness | Does not require full human authentication or real CredentialStore | Those capabilities belong to later phases; profile controls mandatory checks | y |

**Open questions:** none. All decisions required for this specification are recorded above.

## Command Surface

| Command | Mutation allowed | Purpose |
| --- | --- | --- |
| `devvault setup` | Yes, after consent | Detect, select, configure and validate the environment |
| `devvault setup --check` | No | Perform read-only preflight and report readiness |
| `devvault setup --json` | Per selected mode | Emit the same result as structured JSON without credentials |
| `devvault setup --repair` | Yes, after consent when required | Resume incomplete idempotent steps |
| `devvault setup --non-interactive` | Only with explicit authorization | Return `BLOCKED` when required authorization is missing |
| `devvault init-project` | Project metadata only | Create or validate project configuration; never prepare environment state |

`--check` is strictly read-only, including setup state access. It MUST NOT call `composeUp`, installers, policy writes, authentication writes or any other mutating adapter.

## Readiness Profiles

| Profile | Mandatory capabilities | Phase 0 availability |
| --- | --- | --- |
| `local-bootstrap` | Platform detection, backend reachable, Vault lifecycle known, KV check available, valid setup state | Available in Phase 0 |
| `developer-runtime` | `local-bootstrap` plus valid Developer authentication, project configuration, project capability and required CredentialStore | Contract only; `NOT_AVAILABLE` until later phases provide the capabilities |
| `remote-check` | Remote backend reachable, explicit endpoint/TLS configuration valid, lifecycle known and requested read-only capabilities validated | Available as a read-only boundary in Phase 0 |

`READY` is profile-scoped. A profile whose mandatory capability is not implemented SHALL return `BLOCKED` or `FAILED`, never `DEGRADED`.

## User Stories

### P1: Transparent environment setup ⭐ MVP

**User Story**: As a developer, I want `devvault setup` to detect and prepare the available environment so that I do not need to understand Docker or Vault internals.

**Why P1**: This is the primary Phase 0 product outcome.

**Acceptance Criteria**:

1. WHEN `devvault setup` is executed interactively THEN the system SHALL detect platform, dependencies and available Vault backend before requesting or performing mutations.
2. WHEN a mutation is required THEN the system SHALL explain the mutation and obtain explicit consent before executing it.
3. IF the selected backend, Vault lifecycle, or mandatory capability is unavailable THEN the system SHALL not report `READY`.
4. The system SHALL keep setup orchestration separate from project configuration initialization.

**Independent Test**: Run setup in a clean environment with injected dependency/backend adapters and verify detection, consent, orchestration and result state without creating project secrets.

### P1: Read-only setup check ⭐ MVP

**User Story**: As a developer or automation system, I want `devvault setup --check` to inspect readiness without changing my system or Vault so that preflight is safe.

**Acceptance Criteria**:

1. WHEN `devvault setup --check` is executed THEN the system SHALL call only read-only dependency, backend, lifecycle, state and validation operations.
2. IF a mutating operation would be required THEN the system SHALL report the missing capability or next action without executing the mutation.
3. The system SHALL return a structured setup result with one of `READY`, `DEGRADED`, `BLOCKED` or `FAILED`.
4. The system SHALL return exit code `0` for `READY`, `3` for `DEGRADED`, `4` for `BLOCKED` and `5` for `FAILED`.

**Independent Test**: Run check with recording adapters and assert that no mutating call occurred and that the result/exit code matches the injected state.

### P1: Machine-readable setup output ⭐ MVP

**User Story**: As an automation system, I want `devvault setup --json` to expose setup evidence without secret material so that setup can be integrated into scripts.

**Acceptance Criteria**:

1. WHEN `devvault setup --json` is executed THEN the system SHALL emit valid JSON containing status, backend, completed steps, pending steps, blockers and warnings.
2. The system SHALL not include passwords, tokens, SecretIDs, root credentials, authorization headers, secret values, unseal keys or recovery keys in JSON output.
3. The system SHALL use the same result state and exit code rules as the human-readable setup command.

**Independent Test**: Execute setup with recording adapters, parse the JSON and scan serialized output for forbidden credential fields and values.

### P1: Idempotent setup and repair ⭐ MVP

**User Story**: As a developer, I want setup to resume safely after interruption and repeated execution so that partial setup does not require destructive reset.

**Acceptance Criteria**:

1. WHEN setup is executed twice with the same valid environment THEN the system SHALL preserve existing secrets and return an equivalent or more complete setup result without destructive reset.
2. WHEN setup is interrupted after a step has persisted valid metadata THEN `devvault setup --repair` SHALL resume from the next incomplete idempotent step.
3. IF setup state is corrupt or fails schema validation THEN the system SHALL return `FAILED` and SHALL NOT delete Vault data automatically.
4. The system SHALL write setup state atomically through a platform adapter and validate it when reading.

**Independent Test**: Interrupt a setup fixture at each step boundary, run repair, compare non-sensitive state and verify no destructive backend operation occurred.

### P1: Backend abstraction and selection ⭐ MVP

**User Story**: As a developer, I want DevVault to use either a local Docker Vault or an explicitly configured remote Vault through the same setup flow so that restricted environments have a supported path.

**Acceptance Criteria**:

1. WHEN local Docker capabilities are available THEN the system SHALL be able to select the local Docker backend.
2. WHEN an explicit remote Vault configuration is available and local Docker is unavailable THEN the system SHALL be able to select the remote backend.
3. IF neither backend is viable THEN the system SHALL return `BLOCKED` with an actionable reason.
4. The backend contract SHALL not require remote backends to implement Docker-specific operations.

**Independent Test**: Run backend selection with local, remote, both-unavailable and restricted-environment fixtures and assert selection plus result state.

### P1: Setup state security ⭐ MVP

**User Story**: As a security-conscious developer, I want setup metadata to contain no credentials or secret values so that setup cannot create a second secret store.

**Acceptance Criteria**:

1. The system SHALL persist only fields allowed by the strict setup state schema.
2. IF setup state contains a forbidden credential field or value THEN the system SHALL reject it before writing.
3. The system SHALL not persist setup state in a project directory, `devvault.yaml`, `.env` file or arbitrary temporary file.
4. The system SHALL sanitize error metadata before it is persisted or emitted.

**Independent Test**: Attempt to save state containing each forbidden credential category and verify rejection, no file write and no credential in error output.

### P1: Consent and restricted environments ⭐ MVP

**User Story**: As a developer in a controlled environment, I want setup to respect consent and corporate restrictions so that it cannot silently alter my machine.

**Acceptance Criteria**:

1. WHEN an installation or system mutation is proposed THEN the system SHALL request explicit consent before invoking the mutating adapter.
2. IF consent is denied THEN the system SHALL return `BLOCKED` and SHALL not invoke the mutation.
3. IF Docker Desktop installation or modification would be required THEN the system SHALL return `BLOCKED` and SHALL not attempt the operation.
4. WHEN `--non-interactive` is used without sufficient authorization for a required mutation THEN the system SHALL return `BLOCKED`.

**Independent Test**: Run consent and restricted-environment fixtures with recording installation adapters and assert no unauthorized mutation occurred.

## Edge Cases

- IF the dependency checker cannot distinguish Docker CLI from daemon availability THEN the system SHALL report the uncertainty as `BLOCKED` or `FAILED`, never `READY`.
- IF the Vault is `NOT_INITIALIZED` or `SEALED` THEN setup SHALL report the lifecycle state and next operator action without silently generating or persisting unseal material.
- IF the setup state file is interrupted during atomic replacement THEN the system SHALL retain the previous valid state or return `FAILED` without partial credentials.
- IF two setup processes run concurrently THEN the system SHALL prevent conflicting state writes or return a deterministic failure.
- IF a remote backend URL contains credential material or a secret query parameter THEN the system SHALL reject or sanitize it before state/log/JSON output.
- IF an optional platform integration is unavailable but mandatory setup capabilities pass THEN the system SHALL return `DEGRADED`, not `READY` with hidden warnings.
- IF `init-project` is invoked during setup THEN setup SHALL not overwrite project configuration or create project secrets.
- IF two setup processes attempt to write state concurrently THEN the system SHALL acquire an exclusive lock or return `FAILED` with a deterministic concurrency error and SHALL not partially overwrite the last valid state.
- IF atomic state replacement fails THEN the system SHALL retain the previous valid state when possible and SHALL return `FAILED` without deleting backend data.
- IF `--non-interactive` lacks authorization for a required mutation THEN the system SHALL return `BLOCKED` without invoking the mutation.
- IF a required capability is unavailable for the selected profile THEN the system SHALL return `BLOCKED` or `FAILED` according to the failure classification table below.

## Result and Exit Code Rules

| Result | Meaning | Exit code |
| --- | --- | ---: |
| `READY` | Every mandatory capability for the selected profile passed | 0 |
| `DEGRADED` | Only explicitly optional capabilities are unavailable | 3 |
| `BLOCKED` | Consent, environment policy, dependency, lifecycle or unavailable profile capability prevents progress | 4 |
| `FAILED` | Unexpected operation failure, invalid response, corrupt state, lock failure or atomic write failure | 5 |

Mandatory capability failures MUST be `BLOCKED` when an external action or authorization can resolve them, and `FAILED` when an expected operation fails unexpectedly. They MUST never be represented as `DEGRADED`.

## Recovery and Concurrency Rules

- A step is complete only after its result is validated and metadata is atomically persisted.
- Interruption before persistence causes the step to be retried by `--repair`.
- Interruption after persistence resumes from the next incomplete step.
- A corrupt or schema-invalid state returns `FAILED`; repair does not delete Vault data.
- Concurrent setup writers require an exclusive lock. A second writer returns `FAILED` with a deterministic lock error or waits according to the platform adapter contract; it must not interleave writes.
- Failure during temporary-file flush or atomic rename returns `FAILED` and preserves the previous valid state when possible.

## Setup State Allowlist

The persisted state MAY contain only:

```text
schemaVersion
status
platform metadata
backend kind
sanitized Vault address
KV mount name
completed step IDs
pending step IDs
non-sensitive error code
updatedAt
```

The state MUST reject unknown fields and any key or value matching password, token, secret, SecretID, authorization header, unseal key, recovery key or root credential. Remote URLs containing credentials or secret query parameters MUST be rejected or sanitized before persistence, logs or JSON output.

## Distribution Boundary

Phase 0 SHALL evaluate, but not implement, a standalone distribution decision. The design comparison MUST cover Node SEA, pkg, nexe and Bun compiled output against:

- Windows, WSL2, Linux and macOS support;
- native dependencies such as keyring adapters;
- update and signing model;
- reproducibility;
- Docker integration;
- binary size and operational support.

The current Node/pnpm/Corepack workflow remains the development workflow. Final user distribution is a later deliverable.

## Requirement Traceability

| Requirement ID | Story | Phase 0 area | Design target | Task target | Test target | Evidence target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SETUP-001 | P1 Transparent setup | orchestration | design.md: orchestrator | tasks.md: setup orchestrator | setup E2E | result/step report | Pending |
| SETUP-002 | P1 Transparent setup | consent | design.md: ConsentService | tasks.md: consent | consent unit/E2E | recorded decision | Pending |
| SETUP-003 | P1 Check | read-only mode | design.md: mutation boundary | tasks.md: setup check | mutation recorder | no mutating calls | Pending |
| SETUP-004 | P1 Check | statuses/exit codes | design.md: state model | tasks.md: result mapper | state unit | status/exit evidence | Pending |
| SETUP-005 | P1 JSON | safe output | design.md: result model | tasks.md: JSON command | JSON security E2E | sanitized JSON | Pending |
| SETUP-006 | P1 Repair | idempotency | design.md: step model | tasks.md: repair | interruption E2E | equivalent state | Pending |
| SETUP-007 | P1 Repair | corrupt state | design.md: state recovery | tasks.md: state validator | corruption unit/E2E | FAILED result | Pending |
| SETUP-008 | P1 Backend | local backend | design.md: VaultBackend | tasks.md: local adapter | local integration | backend evidence | Pending |
| SETUP-009 | P1 Backend | remote backend | design.md: VaultBackend | tasks.md: remote adapter | remote integration | backend evidence | Pending |
| SETUP-010 | P1 Backend | restricted env | design.md: selector | tasks.md: selector | blocked E2E | BLOCKED result | Pending |
| SETUP-011 | P1 State security | strict schema | design.md: SetupState | tasks.md: state store | security tests | sanitized state | Pending |
| SETUP-012 | P1 State security | filesystem boundary | design.md: state location | tasks.md: state store | filesystem security | path evidence | Pending |
| SETUP-013 | P1 Consent | denied mutation | design.md: ConsentService | tasks.md: consent | consent E2E | no mutation | Pending |
| SETUP-014 | P1 Consent | Docker Desktop policy | design.md: restricted env | tasks.md: platform policy | restricted E2E | BLOCKED result | Pending |
| SETUP-015 | P1 Scope | setup/project boundary | design.md: command boundary | tasks.md: commands | boundary test | touched resources | Pending |
| SETUP-016 | P1 Recovery | atomic state | design.md: recovery | tasks.md: state store | interruption E2E | valid prior state | Pending |
| SETUP-017 | P1 Backend | common capabilities | design.md: capability model | tasks.md: backend contract | contract tests | capability matrix | Pending |
| SETUP-018 | P1 Security | sanitized errors | design.md: security model | tasks.md: output sanitizer | security tests | no credential output | Pending |

**Coverage:** 18 total. Design, Task, Test, Evidence and Gate targets are declared and remain `Pending` until those TLC phases are created and approved.

## Success Criteria

- [ ] Every Phase 0 requirement has Design, Task, Test, Evidence and Gate mapping.
- [ ] Every invariant has a test target and evidence target before execution.
- [ ] Setup state security rejects all forbidden credential categories.
- [ ] Setup modes are explicitly read-only or mutating.
- [ ] Local and remote backends share a capability-based contract.
- [ ] No required Phase 0 capability is hidden behind `DEGRADED`.
- [ ] Phase 0 can produce a `Phase 0 Readiness Report` with no `NOT_TESTED` mandatory invariant.
- [ ] All mandatory profiles have explicit capability rules and no required capability is hidden by `DEGRADED`.
- [ ] Concurrent state writers, atomic replacement failure and repair behavior have objective evidence targets.
- [ ] Remote backend is limited to the common read-only capability boundary during Phase 0.
