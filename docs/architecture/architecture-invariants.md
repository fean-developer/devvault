# Architecture Invariants

These rules MUST NOT be violated without an explicit
Architecture Decision Record.

INV-001
devvault.yaml MUST NOT contain secret values.

INV-002
DevVault MUST NOT create .env files containing secrets.

INV-003
Secrets MUST NOT be written to project files.

INV-004
Secrets MUST NOT appear in logs.

INV-005
Secrets MUST NOT appear in CLI arguments.

INV-006
CLI MUST NOT depend directly on infrastructure adapters.

INV-007
Application services MUST depend on ports/interfaces.

INV-008
Windows, Linux and WSL specific implementations
MUST remain outside the Core.

INV-009
Developer authentication MUST be separate from
application authentication.

INV-010
Root token MUST NOT be required for normal
developer workflows.

INV-011
Credential storage MUST use an abstraction.

INV-012
Project/environment access MUST follow least privilege.

INV-013
Project A MUST NOT access Project B unless explicitly
authorized by policy.

INV-014
Vault lifecycle MUST distinguish:

- unavailable
- not initialized
- sealed
- unsealed
- configured
- ready

INV-015
devvault run MUST resolve secrets at runtime.

INV-016
Adding a new authentication provider MUST NOT require
changes to application use cases.

INV-017
Adding a new operating system MUST NOT require
changes to Core business logic.

INV-018
Every security invariant MUST have automated tests
whenever technically possible.

## Phase 0 Setup Invariants

INV-SETUP-001
Setup MUST NOT report READY unless the selected backend is reachable, the Vault lifecycle is acceptable for the selected profile, and all mandatory capabilities are validated.

INV-SETUP-002
Setup state MUST NOT contain passwords, tokens, SecretIDs, root credentials, authorization headers, secret values, unseal keys, or recovery keys.

INV-SETUP-003
System installation or mutation MUST require explicit consent before the mutating operation starts.

INV-SETUP-004
Setup MUST be idempotent: repeating a completed step MUST preserve existing secrets and configuration.

INV-SETUP-005
Setup MUST be recoverable after interruption by resuming from validated metadata without destructive reset.

INV-SETUP-006
Setup MUST NOT bypass operating-system, Docker, WSL, or corporate security policies.

INV-SETUP-007
Setup MUST NOT install, modify, or enable Docker Desktop automatically.

INV-SETUP-008
Core setup contracts MUST NOT depend on platform APIs, shell commands, Docker, or OS-specific paths.

INV-SETUP-009
Setup MUST NOT persist secrets in setup state, project files, temporary files, logs, JSON output, or exceptions.

INV-SETUP-010
Root credentials MUST NOT become the normal Developer credential or be stored by setup state.

INV-SETUP-011
Local and remote Vault backends MUST implement a common capability-based contract without requiring remote backends to implement Docker operations.

INV-SETUP-012
`devvault setup` MUST prepare the DevVault environment, while `devvault init-project` MUST prepare project configuration; the responsibilities MUST remain separate.