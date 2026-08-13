# DevVault MVP Specification

## Problem Statement

DevVault provides a developer experience layer over HashiCorp Vault so local processes can consume project secrets without storing them in project files.

## Goals

- [ ] Provide a functional local Vault-backed CLI vertical slice.
- [ ] Keep secret values out of project files, logs, and temporary files.
- [ ] Run a configured child process with resolved secrets and the correct exit code.

## Out of Scope

| Feature | Reason |
| --- | --- |
| AppRole implementation | Follow-up after the MVP vertical slice |
| Native OS credential stores | Interface is introduced first; platform implementations follow |
| Vault Agent, OIDC and dynamic secrets | Post-MVP integrations |
| VS Code extension | Separate product surface |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Human authentication | Explicit token input or `VAULT_TOKEN`; never project-file persistence | Avoid silently creating an insecure token file in the MVP | n |
| Secret display | `secret get` hides the value unless `--show` is supplied | Reduce accidental terminal disclosure | n |
| Local Vault bind | `127.0.0.1:8200` | Restrict local exposure | n |
| Package manager | pnpm | Required by the project instructions | y |

**Open questions:** none; remaining decisions are recorded as assumptions above.

## User Stories

### P1: Run a project with Vault secrets

**User Story**: As a developer, I want to run a configured command with secrets resolved from Vault so that I do not need a `.env` file.

**Acceptance Criteria**:

1. WHEN `devvault run -- node app.js` is executed in a configured project THEN the system SHALL start the child process with mapped secret environment variables.
2. IF the Vault secret is not authorized THEN the system SHALL return a permission-denied error without exposing the secret value.
3. WHILE the child process is running THEN the system SHALL forward its standard input, output, error streams and received termination signals.
4. The system SHALL not create `.env`, secret configuration files, or secret temporary files.

**Independent Test**: A fixture app prints a mapped secret, and the test confirms the output while checking that no secret file exists.

### P1: Manage project secrets

**User Story**: As a developer, I want to set, inspect and delete project secrets through the CLI so that Vault remains the source of truth.

**Acceptance Criteria**:

1. WHEN `devvault secret set <key>` is executed THEN the system SHALL request the value without echoing it and write it to KV v2.
2. WHEN `devvault secret list` is executed THEN the system SHALL list secret keys without returning their values.
3. WHEN `devvault secret get <key>` is executed without `--show` THEN the system SHALL not print the secret value.
4. IF `devvault secret delete <key>` is executed without confirmation THEN the system SHALL leave the secret unchanged.

**Independent Test**: Integration tests use a real local Vault and verify set, list, protected get and confirmed delete behavior.

### P1: Diagnose local setup

**User Story**: As a developer, I want `init`, `init-project` and `doctor` so that setup failures are actionable.

**Acceptance Criteria**:

1. WHEN `devvault init` is executed repeatedly THEN the system SHALL preserve existing secrets and policies.
2. WHEN `devvault init-project` is executed in a project directory THEN the system SHALL create only non-sensitive `devvault.yaml` configuration.
3. IF Docker, Vault or project configuration is unavailable THEN `devvault doctor` SHALL identify the failed check without printing secret values.

**Independent Test**: Docker/Vault integration fixtures run setup twice, inspect the generated config, and exercise doctor failure checks.

## Edge Cases

- IF `devvault.yaml` is absent THEN the system SHALL return a project configuration error with the expected file name.
- IF configuration contains malformed project or environment identifiers THEN the system SHALL reject it before any Vault call.
- IF Vault is unavailable THEN the system SHALL return a Vault availability error without logging credentials.
- IF the child process exits non-zero THEN the CLI SHALL return that exit code.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CFG-01 | P1 Diagnose | Foundation | Pending |
| CFG-02 | P1 Diagnose | Foundation | Pending |
| INFRA-01 | P1 Diagnose | Vault | Verified |
| INFRA-02 | P1 Diagnose | Vault | Verified |
| AUTH-01 | P1 Run | Auth | Pending |
| SEC-01 | P1 Manage | Secrets | In Design |
| SEC-02 | P1 Manage | Secrets | Pending |
| SEC-03 | P1 Manage | Security | Pending |
| RUN-01 | P1 Run | Runtime | Verified |
| RUN-02 | P1 Run | Runtime | Verified |
| RUN-03 | P1 Run | Runtime | Verified |
| RUN-04 | P1 Run | Runtime | Verified |
| TEST-01 | All | Validation | In Design |
| TEST-02 | P1 Diagnose | Vault | Pending |

## Success Criteria

- [ ] The documented MVP acceptance flow runs against a real local Vault.
- [ ] No secret value is written to project configuration, logs or temporary files.
- [ ] Unit, integration, E2E and security gates pass.