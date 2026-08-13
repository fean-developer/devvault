# DevVault Local Developer Lifecycle Specification

**Feature:** `devvault-local-lifecycle`
**Status:** Proposed
**Phase:** New feature after Phase 0 setup foundation
**Scope:** Local developer lifecycle only
**Authority:** Existing Architecture Authority and Phase 0 contracts remain authoritative

## Problem Statement

The current DevVault workflow requires developers to understand infrastructure concepts and execute multiple commands such as setup, Docker Compose operations, Vault initialization, unseal and KV preparation. This creates unnecessary operational knowledge and makes a clean local environment difficult to use.

The product-level intent is to provide a single developer-facing command:

```bash
devvault start
```

The command SHALL be a thin application-level lifecycle facade over the existing setup, backend, state, validation and platform boundaries. It SHALL hide infrastructure details without hiding actionable failures or weakening security.

## Architecture Discovery Summary

The repository already contains reusable Phase 0 capabilities:

- `StepSetupOrchestrator` and `SetupStep` execution contracts;
- `SetupStateStore` with allowlisted non-sensitive metadata and locking;
- dependency checking and consent ports;
- local Docker and remote Vault backend contracts;
- Vault lifecycle classification;
- local Docker startup through a platform adapter;
- KV v2 and capability validation through the Vault client;
- readiness profiles and setup result states;
- CLI composition root and command registration boundaries;
- CredentialStore abstraction for developer session storage;
- sanitization and security test infrastructure.

The current system does not provide Vault operator initialization or unseal operations. Phase 0 explicitly excludes automatic unseal and a real OS CredentialStore implementation. This feature SHALL extend those boundaries only through an approved design and SHALL NOT rewrite Phase 0 documents or silently change Phase 0 invariants.

## Goals

1. Make `devvault start` the primary local developer workflow.
2. Start an owned local backend when it is stopped.
3. Reuse the existing setup orchestration and readiness contracts.
4. Detect and report Vault lifecycle states without requiring infrastructure knowledge for the happy path.
5. Support safe manual unseal for local development in V1 when required.
6. Configure or validate local KV v2 only through explicit local ownership and consent rules.
7. Preserve idempotency and non-destructive recovery.
8. Keep remote Vault operator-managed and read-only from lifecycle automation.
9. Keep the CLI thin and delegate behavior to application ports and adapters.
10. Make local readiness observable through simple developer output and detailed `doctor` diagnostics.

## Out of Scope

This feature SHALL NOT include:

- AppRole;
- OIDC;
- CI/CD authentication;
- dynamic secrets;
- Vault Agent;
- corporate policy management;
- corporate identity provisioning;
- full human authentication redesign, renewal or revocation;
- automatic Docker Desktop installation or modification;
- standalone packaging;
- remote Vault initialization, unseal or administrative mutation;
- automatic persistence of unseal keys or root tokens;
- automatic reset or destruction of Vault data;
- rewriting Phase 0 specification, design, tasks or validation;
- changing the canonical Phase 0 invariant matrix in this feature.

## User Stories

### LIFECYCLE-US-001: Start a local environment

As a local developer, I want one command to prepare my DevVault environment so that I do not need to understand Docker or Vault internals.

### LIFECYCLE-US-002: Repeat start safely

As a local developer, I want to run `devvault start` repeatedly so that an already prepared environment remains unchanged and ready.

### LIFECYCLE-US-003: Recover from a sealed Vault

As a local developer, I want `start` to explain when the local Vault requires an unlock key and accept it securely without persisting it.

### LIFECYCLE-US-004: Diagnose a blocked environment

As a developer in a restricted or incomplete environment, I want `doctor` to expose technical details while `start` gives me an actionable summary.

### LIFECYCLE-US-005: Protect remote infrastructure

As an operator of a remote Vault, I want `start` to validate availability without initializing or modifying my remote environment.

## Command Surface

### `devvault start`

Primary developer-facing command. It prepares and validates an owned local environment, or performs read-only validation for an explicitly configured remote backend.

The command MAY expose presentation options such as `--json`, `--non-interactive` and `--verbose` only if they preserve the same lifecycle and security semantics. Exact options belong to Design.

### `devvault status`

Fast, read-only readiness query. It SHALL NOT perform setup repair, initialization, unseal, policy writes or other mutations.

### `devvault doctor`

Detailed diagnostic command. It MAY expose backend, platform, lifecycle, KV, state, policy, blockers and warnings, but SHALL never expose credential material.

### Existing advanced commands

The following commands remain available and retain their Phase 0 responsibilities:

```text
devvault setup
devvault setup --check
devvault setup --repair
devvault doctor
devvault status
```

`devvault start` SHALL NOT silently redefine `devvault setup`.

### `devvault stop`

`stop` is evaluated as part of this lifecycle boundary but is not approved for implementation by this Specification. A future stop operation MAY stop only an owned local backend and SHALL preserve volumes, secrets, policies and project configuration. Its inclusion requires the open decisions below to be resolved during Design.

## Local Lifecycle Behavior

The lifecycle service SHALL orchestrate existing application contracts and any approved new local lifecycle ports. The CLI SHALL not contain Docker, Vault HTTP, unseal, CredentialStore, filesystem, platform or readiness rules.

The logical local flow is:

```text
start
  -> detect environment
  -> select owned local backend
  -> start local backend when stopped
  -> detect Vault lifecycle
  -> handle lifecycle state according to policy
  -> configure or validate local KV when authorized
  -> validate setup/readiness
  -> return developer-facing result
```

### Clean local environment

WHEN `devvault start` runs with no running local backend, THE SYSTEM SHALL start the owned local backend only after the existing consent policy permits the mutation.

IF the Vault is not initialized, THE SYSTEM SHALL either execute an explicitly approved local initialization flow defined by Design or return `BLOCKED` with an actionable operator step. It SHALL not silently invent or persist bootstrap material.

### Vault stopped

WHEN the owned local backend is stopped, THE SYSTEM SHALL start it and then revalidate lifecycle, KV and readiness. Existing volumes and secrets SHALL remain intact.

### Vault `NOT_INITIALIZED`

The system SHALL distinguish this state from unavailable or sealed.

V1 SHALL not silently initialize a persistent Vault unless the bootstrap material delivery and consent model is explicitly approved. If no approved local initialization flow exists, `start` SHALL return `BLOCKED` and direct the user to `doctor`.

### Vault `SEALED`

V1 SHALL support manual local unseal only if the user explicitly provides the unlock material through hidden interactive input or another approved ephemeral input boundary.

The unseal material SHALL:

- exist only in memory for the operation;
- never appear in stdout, stderr, logs, JSON, exceptions, argv, setup state or project files;
- never be written to arbitrary temporary files;
- never be persisted automatically in the existing CredentialStore.

If `--non-interactive` is used and no authorized ephemeral input is available, the system SHALL return `BLOCKED` without attempting unseal.

### Vault `UNSEALED`

WHEN the Vault is initialized and unsealed, THE SYSTEM SHALL validate the configured local KV mount and required capabilities before reporting readiness.

### Vault `CONFIGURED`

WHEN KV and local policy configuration are valid but developer authentication or project configuration is missing, THE SYSTEM SHALL report the missing developer-level prerequisite without claiming that the application runtime is ready.

### Vault `READY`

WHEN all mandatory capabilities for the selected local lifecycle profile pass, THE SYSTEM SHALL return `READY` and SHALL avoid unnecessary mutations.

A repeated `start` in this state SHALL preserve existing data and return an equivalent successful result.

## Remote Behavior

WHEN an explicitly configured remote backend is selected, `devvault start` SHALL perform only the read-only operations supported by the remote contract:

- endpoint validation;
- connectivity and health checks;
- lifecycle classification;
- KV validation;
- requested capability validation.

The remote path SHALL NOT:

- initialize Vault;
- unseal Vault;
- write policies;
- create identities;
- configure corporate authentication;
- provision infrastructure;
- start or stop Docker;
- use local lifecycle ownership assumptions.

If an operator action is required, the result SHALL be `BLOCKED` with an actionable explanation and a `doctor` remediation path.

## Bootstrap Credential Model

### V1 decision

V1 SHALL use manual, ephemeral unseal input when unseal is required. It SHALL not add automatic bootstrap credential persistence to the existing CredentialStore.

The existing CredentialStore is currently suitable for developer session credentials, but it is not by itself an approved contract for root tokens, initialization responses or unseal keys. Reusing it for bootstrap material would create a new security boundary and requires an ADR and threat-model review.

### V2 consideration

A future version MAY evaluate OS CredentialStore storage for local bootstrap material through a dedicated contract. That work SHALL require:

- an ADR;
- explicit threat-model analysis;
- platform-specific adapter decisions;
- consent and deletion semantics;
- behavior when the OS credential provider is unavailable;
- tests proving no plaintext fallback.

V2 is outside this Specification's implementation scope.

## Security Requirements

- The system SHALL preserve `INV-001` through `INV-018` and applicable `INV-SETUP-*` invariants.
- The system SHALL not persist root tokens, unseal keys, recovery keys, passwords, authorization headers or secret values in setup state.
- The system SHALL not place credentials in URLs, CLI arguments, project files, `.env` files, logs, JSON output, exceptions or arbitrary temporary files.
- The system SHALL not delete Vault data, volumes, policies, secrets or project configuration automatically.
- The system SHALL use explicit consent for mutating local operations according to the existing consent model.
- The system SHALL map unavailable credentials or denied consent to `BLOCKED`, not to a successful or degraded readiness result.
- The system SHALL keep human authentication separate from application authentication.
- The system SHALL not use a root token as the normal developer runtime credential.
- The system SHALL sanitize human-readable, structured and exception-derived lifecycle output.

## Idempotency

WHEN `devvault start` runs against an already-ready local environment, THE SYSTEM SHALL perform only the minimum validation required and SHALL not recreate containers, reset Vault, overwrite policies or alter secrets unnecessarily.

WHEN `devvault start` runs after a local Docker restart, THE SYSTEM SHALL resume the non-destructive lifecycle and revalidate the environment.

WHEN a lifecycle step has completed but the process is interrupted, THE SYSTEM SHALL resume from validated non-sensitive state or safely revalidate the step.

Repeated execution SHALL preserve existing Vault data and project configuration.

## Recovery

### Process crash or interruption

The system SHALL release lifecycle locks and SHALL persist only validated allowlisted metadata. An interrupted operation SHALL be retryable without destructive reset.

### Docker restart

The system SHALL detect the stopped container, start the owned local backend and revalidate Vault lifecycle. If the Vault is sealed, V1 SHALL request manual unseal again rather than persist the key.

### Vault restart

The system SHALL distinguish a sealed Vault from an unavailable Vault and report the required action without claiming readiness.

### Inconsistent state

IF lifecycle metadata is corrupt or incompatible, THE SYSTEM SHALL return `FAILED` or `BLOCKED` according to the existing setup result rules and SHALL not delete Vault data automatically.

### CredentialStore unavailable

For V1 manual unseal, an unavailable CredentialStore SHALL not prevent ephemeral unseal input when an approved interactive input boundary exists. For developer session operations, the existing CredentialStore error behavior SHALL remain unchanged. No plaintext fallback SHALL be introduced.

## Error Model

The lifecycle service SHALL reuse existing setup result states:

| Result | Meaning |
| --- | --- |
| `READY` | All mandatory capabilities for the selected lifecycle profile passed. |
| `DEGRADED` | Only explicitly optional capabilities are unavailable. |
| `BLOCKED` | Consent, environment policy, operator action, unavailable profile capability or remote management boundary prevents progress. |
| `FAILED` | Unexpected operation failure, invalid response, corrupt state, lock failure or persistence failure. |

Lifecycle states SHALL remain separate:

```text
UNAVAILABLE
NOT_INITIALIZED
SEALED
UNSEALED
CONFIGURED
READY
```

The system SHALL not introduce a second persistent lifecycle state model without an approved architectural decision.

## Readiness Definition

`Local DevVault Ready` means all of the following are true for the selected local profile:

1. the owned local backend is reachable;
2. Vault is initialized and unsealed;
3. the required KV v2 mount is valid;
4. mandatory local capabilities are validated;
5. setup state is valid and consistent;
6. no required consent or operator action remains pending;
7. the result is not based on an unvalidated or optional-only shortcut.

Developer authentication and application-specific secret mappings remain separate profile concerns and SHALL not be silently reported as complete merely because infrastructure is ready.

## Scope Boundaries

| Boundary | Included | Excluded |
| --- | --- | --- |
| Local backend | Start, detect, validate and safe manual-unseal coordination | Destructive reset, automatic bootstrap persistence |
| Remote backend | Read-only health, lifecycle, KV and capability validation | Initialization, unseal, policy and identity mutation |
| Phase 0 | Reuse setup contracts, state, profiles, adapters and invariants | Rewriting Phase 0 artifacts or changing its acceptance history |
| Lifecycle | Developer-facing start orchestration and readiness translation | Full authentication architecture |
| CredentialStore | Existing developer-session abstraction; availability handling | Bootstrap credential persistence in V1 |
| Policies | Validate local required capabilities through existing boundaries | Corporate policy administration |
| Stop | Architectural evaluation only in this feature | Approved implementation without further decisions |

## Architecture Constraints

1. The CLI SHALL remain a thin registration and presentation layer.
2. Application services SHALL depend on ports and interfaces.
3. Core SHALL not import Docker, Vault HTTP, child-process, filesystem, keyring or platform APIs.
4. Platform-specific behavior SHALL remain in adapters.
5. Local and remote backends SHALL share capability-based contracts without forcing Docker operations on remote backends.
6. Lifecycle SHALL orchestrate existing setup capabilities rather than duplicate setup or readiness rules.
7. Setup result state and Vault lifecycle state SHALL remain distinct.
8. `SetupStateStore` SHALL remain the source of persisted setup metadata; a second state store is prohibited without an ADR.
9. Remote lifecycle operations SHALL be read-only.
10. Mutations SHALL remain consent-gated and idempotent.

## Applicable Existing Invariants

This feature references, but does not modify, the canonical matrix in `docs/architecture/architecture-invariants.md`:

- `INV-001` through `INV-018`;
- `INV-SETUP-001` through `INV-SETUP-012`.

The most directly affected invariants are:

- `INV-006`, `INV-007`, `INV-008`: CLI/application/adapter boundaries;
- `INV-009`, `INV-010`, `INV-011`: authentication and credential storage;
- `INV-014`: lifecycle state distinction;
- `INV-SETUP-002`, `INV-SETUP-003`, `INV-SETUP-004`, `INV-SETUP-005`, `INV-SETUP-009`, `INV-SETUP-010`, `INV-SETUP-011`: security, consent, idempotency, recovery and local/remote boundaries.

### Proposed feature invariants

These are proposals for Design review only and do not modify the canonical invariant matrix:

- `INV-LIFE-001`: `start` is idempotent and non-destructive.
- `INV-LIFE-002`: local stop preserves volumes, secrets, policies and project configuration.
- `INV-LIFE-003`: remote lifecycle is never administratively mutating.
- `INV-LIFE-004`: V1 unseal material exists only in memory during the operation.
- `INV-LIFE-005`: lifecycle success requires mandatory readiness validation.
- `INV-LIFE-006`: lifecycle does not create a second setup state model.

Each proposed invariant SHALL be accepted, changed or rejected during Design before implementation.

## Requirement IDs and Acceptance Criteria

### LIFECYCLE-001: Primary start command

WHEN a developer invokes `devvault start`, THE SYSTEM SHALL execute the lifecycle application service through the production CLI composition root and SHALL not require the developer to invoke `setup` manually.

**Acceptance:** The real CLI registration path reaches the lifecycle service with local and remote fixtures.

### LIFECYCLE-002: Local backend preparation

WHEN the selected backend is owned local Docker and the container is stopped, THE SYSTEM SHALL start the local backend through the platform adapter after consent and SHALL then revalidate readiness.

**Acceptance:** A recording local adapter observes one start operation and a second `start` does not repeat it unnecessarily.

### LIFECYCLE-003: Idempotent repeated start

WHEN `devvault start` is run repeatedly against a ready local environment, THE SYSTEM SHALL preserve Vault data, policies, secrets and project configuration and SHALL return `READY` each time.

**Acceptance:** Two consecutive runs have equivalent successful results and no destructive calls.

### LIFECYCLE-004: Lifecycle classification

WHEN the backend reports `UNAVAILABLE`, `NOT_INITIALIZED`, `SEALED`, `UNSEALED`, `CONFIGURED` or `READY`, THE SYSTEM SHALL preserve that lifecycle distinction internally and produce the corresponding lifecycle behavior defined by this Specification.

**Acceptance:** A recording backend matrix maps every lifecycle state to the expected result and next action.

### LIFECYCLE-005: Manual V1 unseal

WHEN a local Vault is `SEALED` and an approved interactive input boundary is available, THE SYSTEM SHALL request unseal material without echoing or persisting it and SHALL revalidate readiness after unseal.

**Acceptance:** Tests verify the unseal value is absent from stdout, stderr, logs, argv, exceptions, setup state and project files.

### LIFECYCLE-006: Non-interactive sealed handling

WHEN a local Vault is `SEALED` and `--non-interactive` is used without authorized ephemeral input, THE SYSTEM SHALL return `BLOCKED` and SHALL not attempt unseal.

**Acceptance:** A recording adapter observes no unseal call.

### LIFECYCLE-007: Uninitialized handling

WHEN a local Vault is `NOT_INITIALIZED`, THE SYSTEM SHALL either use an explicitly approved local initialization contract or return `BLOCKED` with an actionable operator instruction; it SHALL not silently persist bootstrap material.

**Acceptance:** The uninitialized matrix proves no implicit initialization or secret persistence occurs without the approved contract.

### LIFECYCLE-008: KV readiness

WHEN the local Vault is initialized and unsealed, THE SYSTEM SHALL validate the required KV v2 mount before returning `READY`.

**Acceptance:** Missing, valid and malformed KV fixtures produce the expected result without false `READY`.

### LIFECYCLE-009: Mandatory capability readiness

WHEN a mandatory local capability is unavailable, THE SYSTEM SHALL return `BLOCKED` or `FAILED` according to the existing result rules and SHALL not return `READY` or `DEGRADED`.

**Acceptance:** Capability mutation tests distinguish mandatory and optional outcomes.

### LIFECYCLE-010: Remote read-only boundary

WHEN an explicit remote backend is selected, THE SYSTEM SHALL perform only read-only lifecycle, KV and capability validation and SHALL not initialize, unseal or mutate the remote Vault.

**Acceptance:** Recording remote adapters show zero administrative mutation calls.

### LIFECYCLE-011: Docker restriction handling

WHEN Docker is unavailable or a restricted environment prevents local lifecycle ownership, THE SYSTEM SHALL return `BLOCKED` with an actionable diagnostic path and SHALL not install or modify Docker Desktop.

**Acceptance:** Restricted fixtures show no installation or Docker Desktop mutation call.

### LIFECYCLE-012: Consent enforcement

WHEN a lifecycle operation requires mutation, THE SYSTEM SHALL request consent through the existing consent boundary before invoking the mutating adapter.

**Acceptance:** Denied consent produces `BLOCKED` and zero mutation calls.

### LIFECYCLE-013: Status is read-only

WHEN `devvault status` is invoked, THE SYSTEM SHALL report lifecycle/readiness information without starting, initializing, unsealing, configuring or repairing the environment.

**Acceptance:** Recording adapters show only read operations.

### LIFECYCLE-014: Diagnostic separation

WHEN `devvault doctor` is invoked, THE SYSTEM SHALL expose the technical diagnostic details needed to explain lifecycle and readiness failures without exposing credentials.

**Acceptance:** Doctor output contains lifecycle/blocker evidence and passes credential leakage scans.

### LIFECYCLE-015: State reuse

WHEN lifecycle metadata is persisted, THE SYSTEM SHALL reuse the existing validated `SetupStateStore` and SHALL not create a second independent setup state model.

**Acceptance:** State tests show the lifecycle uses the existing schema and rejects forbidden fields.

### LIFECYCLE-016: Crash recovery

WHEN lifecycle execution is interrupted before or after a step boundary, THE SYSTEM SHALL resume or revalidate safely without deleting Vault data or project configuration.

**Acceptance:** Interruption fixtures recover deterministically and preserve non-sensitive state.

### LIFECYCLE-017: Restart recovery

WHEN Docker or Vault restarts after a previously ready local environment, THE SYSTEM SHALL revalidate lifecycle and request manual unseal again if required, without persisting unseal material.

**Acceptance:** Restart fixtures return `READY` after approved ephemeral unseal or `BLOCKED` with a clear next action.

### LIFECYCLE-018: CredentialStore boundary

WHEN the existing CredentialStore is unavailable, THE SYSTEM SHALL not introduce plaintext fallback and SHALL distinguish session credential failure from V1 manual unseal input handling.

**Acceptance:** CredentialStore failure fixtures show no file fallback and preserve the specified result state.

### LIFECYCLE-019: Non-destructive stop decision

IF a future `devvault stop` operation is approved, THE SYSTEM SHALL stop only an owned local backend and SHALL preserve Vault data, volumes, policies, secrets and project configuration.

**Acceptance:** Stop remains a Design-gated capability; any implementation test must assert preserved data and zero remote calls.

### LIFECYCLE-020: Output sanitization

WHEN any lifecycle result, error, log or JSON output is emitted, THE SYSTEM SHALL exclude tokens, passwords, unseal keys, recovery keys, root credentials, authorization headers and secret values.

**Acceptance:** Human output, JSON, exceptions, logs and process-argument capture are scanned for forbidden values.

### LIFECYCLE-021: Thin CLI boundary

WHEN the CLI registers lifecycle commands, THE SYSTEM SHALL delegate behavior to application services and SHALL not contain Docker, Vault, platform, filesystem, CredentialStore or readiness rules.

**Acceptance:** Architecture/dependency scans and production wiring tests confirm the boundary.

### LIFECYCLE-022: Lifecycle result semantics

WHEN lifecycle execution completes, THE SYSTEM SHALL reuse `READY`, `DEGRADED`, `BLOCKED` and `FAILED` semantics and SHALL not introduce a conflicting result state.

**Acceptance:** Result and exit-code tests cover all four outcomes.

## Edge Cases

- Local container is running but Vault is unreachable.
- Vault returns HTTP 503 because it is sealed.
- Vault is initialized but the unseal key is unavailable.
- Vault is unsealed but KV v2 is missing.
- KV exists but required project capabilities are denied.
- A remote endpoint is configured with credentials in its URL.
- Docker CLI exists but the daemon is unavailable.
- Docker Desktop installation would be required.
- Consent is denied after environment detection.
- `--non-interactive` is used with a required mutation.
- Lifecycle state is corrupt or stale.
- Another lifecycle process holds the lock.
- The process crashes during start or unseal.
- The CredentialStore provider is unavailable.
- A user invokes `start` outside a project directory.
- A user invokes `start` with a remote backend and expects local mutation.
- A previous setup state contains only older Phase 0 metadata.

## Traceability Expectations

Every requirement SHALL later map through the following chain:

```text
LIFECYCLE requirement
    -> Design decision
    -> Atomic task
    -> Implementation
    -> Focused test
    -> Evidence artifact
    -> Phase gate result
```

No requirement may be marked complete from documentation alone. Requirements depending on infrastructure SHALL distinguish `IMPLEMENTED`, `TESTED`, `NOT_TESTED` and `BLOCKED`.

## Success Criteria

The Specification is ready for Design when:

- all local/remote boundaries are explicit;
- V1 manual unseal behavior is accepted;
- V2 CredentialStore bootstrap persistence is excluded or separately ADR-gated;
- no Phase 0 artifact is modified;
- existing setup and lifecycle result models are preserved;
- every requirement has a unique `LIFECYCLE-*` identifier;
- every acceptance criterion is measurable and testable;
- stop implementation status is decided during Design;
- open decisions are explicitly recorded;
- architecture and security risks are understood;
- a later Design can map each requirement to existing or new ports.

## Assumptions & Open Questions

The following assumptions constrain this Specification until Design resolves or rejects them:

| Assumption | Default | Status |
| --- | --- | --- |
| V1 unseal handling | Manual, interactive and ephemeral | Open for Design confirmation |
| Bootstrap credential persistence | Prohibited in V1 | Fixed for this Specification |
| Remote lifecycle ownership | Operator-managed and read-only | Fixed for this Specification |
| Phase 0 artifacts | Reused without modification | Fixed for this Specification |
| Existing setup result states | Reused unchanged | Fixed for this Specification |
| `devvault stop` | Evaluated but not approved for implementation | Open for Design decision |

Open questions:

### Open Questions

1. Is local Vault first-time initialization part of this feature, or should V1 return `BLOCKED` at `NOT_INITIALIZED` and require an explicit operator command?
2. If local initialization is included, how is the generated root token and unseal key delivered to the developer without logs, files or unsafe persistence?
3. Should `start` require a project `devvault.yaml`, or may it prepare infrastructure globally before project configuration exists?
4. Should local KV configuration occur during `start`, or remain an explicit administrative/bootstrap operation?
5. Should `start` require a developer session before reporting infrastructure `READY`?
6. Should `stop` be included in this feature after Design, or deferred to a separate lifecycle feature?
7. Should `stop` only stop Docker Compose, or also seal the local Vault?
8. What exact signal establishes that a backend is owned by DevVault and safe for local mutation?
9. Which input boundary is approved for V1 manual unseal in interactive and CI environments?
10. Should a missing OS CredentialStore block only login/status or the entire local lifecycle?
11. Is a new dedicated operator port acceptable, given Phase 0's explicit exclusion of automatic unseal?
12. Which profile defines `Local DevVault Ready`: `local-bootstrap`, a new lifecycle profile, or a composition of existing profiles?
13. What is the expected behavior of `start` outside a project directory?

## Requirement Traceability

The future Design phase SHALL maintain a traceability matrix with one row for each requirement:

| Requirement range | Design | Task | Test | Evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| LIFECYCLE-001 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-002 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-003 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-004 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-005 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-006 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-007 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-008 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-009 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-010 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-011 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-012 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-013 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-014 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-015 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-016 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-017 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-018 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-019 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-020 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-021 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |
| LIFECYCLE-022 | Pending Design | Pending Tasks | Pending implementation | Pending validation | Pending phase gate |

No requirement SHALL be considered complete without linked implementation evidence and a passing focused test where technically possible. Infrastructure-dependent requirements SHALL record `IMPLEMENTED`, `TESTED`, `NOT_TESTED` or `BLOCKED` explicitly.

## Specification Gate Recommendation

**Status:** Ready for Design after open questions are resolved.

The feature is architecturally viable as a new lifecycle feature that reuses Phase 0 foundations. It is not a safe one-line CLI facade because local initialization and unseal require new operator capabilities and explicit security decisions. No implementation, adapter, Design document or Tasks document is authorized by this Specification stage.
