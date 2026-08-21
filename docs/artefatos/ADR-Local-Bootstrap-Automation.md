# ADR: Local Vault Bootstrap Automation

**Status:** Approved
**Date:** 2026-08-13
**Scope:** Local development backend only

## Context

The primary DevVault experience is `devvault start`. Requiring developers to generate, store and manually enter Vault root tokens or unseal keys defeats that goal.

A persistent Vault cannot unseal after restart without access to its unseal material. Therefore automatic local lifecycle requires an internal bootstrap boundary.

## Decision

DevVault will own the bootstrap lifecycle of the local development Vault.

On `devvault start`, for an owned local backend, DevVault may:

1. start the local container;
2. initialize Vault when it is uninitialized;
3. generate bootstrap material internally;
4. store bootstrap material only in a dedicated local bootstrap boundary;
5. unseal Vault automatically;
6. configure KV v2 and local development policies;
7. validate readiness.

The dedicated bootstrap boundary is a local Docker-managed volume with restrictive permissions, separate from project files and setup state. It is not exposed through the CLI and is not used for remote Vaults.

Root tokens and unseal keys are never printed, logged, placed in argv, URLs, JSON output, project files, `.env` files or setup state. They are used only by local lifecycle adapters and are not returned through application service results.

## Alternatives Considered

### Manual unseal

Rejected as the primary UX because it requires the developer to understand Vault internals and violates the product goal.

### Vault dev mode

Rejected as the default because its lifecycle and persistence semantics are not equivalent to the persistent local development Vault required by the project.

### OS CredentialStore for bootstrap material

Deferred. This requires a separate threat model, platform contract and ADR. It may be considered for a later version.

### Persist bootstrap material in setup state or project files

Rejected. This violates the existing security invariants.

## Security Impact

The local bootstrap volume becomes a high-value local credential boundary. Anyone able to read the Docker volume may obtain administrative access to the local Vault. This is accepted for the local development threat model and mitigated by:

- host-local binding;
- dedicated volume separation;
- no remote application;
- no automatic reset;
- explicit destructive reset only;
- no use of bootstrap credentials in normal runtime;
- warnings and documentation for compromised local machines.

## Remote Boundary

Remote Vault remains operator-managed. `devvault start` MUST NOT initialize, unseal, configure or mutate a remote Vault.

## Reset

Automatic reset is prohibited. A future explicit reset operation may remove the local Vault data and bootstrap volume only after confirmation, for example:

```bash
devvault reset --yes
```

Reset is outside the first implementation slice unless explicitly added to the feature tasks.

## Invariant Impact

Existing invariants remain valid. `INV-SETUP-002`, `INV-SETUP-009` and `INV-SETUP-010` are clarified: bootstrap material is prohibited from setup state and project/runtime surfaces, but may exist inside the dedicated local infrastructure boundary owned by the local adapter.

New lifecycle invariant proposed:

`INV-LIFE-007`: local bootstrap material may exist only inside the dedicated local infrastructure boundary and must never cross the application result, logging, project or setup-state boundaries.

## Consequences

Positive:

- developer executes only `devvault start`;
- local Vault survives container restart;
- unseal is automatic;
- root/unseal material remains invisible to normal developer workflows.

Negative:

- local bootstrap volume must be protected;
- deleting the bootstrap volume makes the existing Vault unrecoverable without a reset/reinitialization procedure;
- this does not protect a compromised host or Docker daemon.
