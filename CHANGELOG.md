# Changelog

## [0.1.44] - 2026-08-13

- Clarified the real-project workflow and renamed the bootstrap password prompt to distinguish it from application secrets.

## [0.1.43] - 2026-08-13

- Added the Phase 0 gate review report and recorded the phase as partially validated due to native Windows and Docker Desktop evidence limits.

## [0.1.42] - 2026-08-13

- Completed Phase 0 setup documentation, platform limitations and readiness evidence.

## [0.1.41] - 2026-08-13

- Documented standalone distribution options and deferred a Node SEA proof of concept.

## [0.1.40] - 2026-08-13

- Added Phase 0 E2E/readiness scenarios for setup repetition, repair, blocked environments, consent and remote read-only checks.

## [0.1.39] - 2026-08-13

- Added Phase 0 security acceptance coverage for setup state, JSON output, errors, URLs, temporary files and project secret-file boundaries.

## [0.1.38] - 2026-08-13

- Added the `devvault setup` command with check, repair, JSON, non-interactive and explicit approval options.
- Added CLI result/exit-code and output sanitization coverage.

## [0.1.37] - 2026-08-13

- Added filesystem-backed SetupStateStore with atomic writes, exclusive lock and corruption handling.
- Added tests ensuring state remains outside project files and rejects forbidden credentials.

## [0.1.36] - 2026-08-13

- Added Core StepSetupOrchestrator with consent, check-mode and state-store coordination.
- Added orchestration tests for ordered steps, blocked consent and read-only checks.

## [0.1.35] - 2026-08-13

- Added profile-scoped SetupValidator with READY/DEGRADED/BLOCKED/FAILED mapping.
- Added sanitized capability metadata validation.

## [0.1.34] - 2026-08-13

- Added capability-based local/remote Vault backend selection.
- Added explicit BLOCKED behavior when no backend is viable.

## [0.1.33] - 2026-08-13

- Added the read-only RemoteVaultBackend adapter.
- Added endpoint sanitization and remote lifecycle/failure tests without Docker coupling.

## [0.1.32] - 2026-08-13

- Added the read-only LocalDockerVaultBackend adapter.
- Added Docker/container/Vault lifecycle validation without destructive operations.

## [0.1.31] - 2026-08-13

- Added the platform `DependencyChecker` adapter for Docker, Compose, Vault container and WSL capabilities.
- Added explicit Docker Desktop policy blocking without installation attempts.

## [0.1.30] - 2026-08-12

- Added Core consent and authorized installation boundaries.
- Added blocking behavior for non-interactive mutations and Docker Desktop changes.

## [0.1.29] - 2026-08-12

- Added Core SetupStateStore, lock, atomic-save and repair contracts.
- Added tests for state load/save outcomes and non-destructive recovery semantics.

## [0.1.28] - 2026-08-12

- Added strict Phase 0 SetupState schema and sensitive metadata validation.
- Added rejection tests for credential fields, values and credential-bearing URLs.

## [0.1.27] - 2026-08-12

- Added Core setup ports and typed SetupStep orchestration contracts.
- Added explicit read-only setup check mode representation.

## [0.1.26] - 2026-08-12

- Added Core Vault backend detection, capability and validation contracts.
- Canonicalized Vault lifecycle contracts without adding infrastructure dependencies.

## [0.1.25] - 2026-08-12

- Added the Phase 0 setup result, exit code and readiness profile model.
- Added Core tests for mandatory versus optional capability outcomes.

## [0.1.24] - 2026-08-12

- Added a step-by-step real project quickstart for the current DevVault MVP state.
- Documented WSL2, keyring, bootstrap, runtime and lifecycle limitations.

## [0.1.23] - 2026-08-12

- Recorded real Windows PowerShell to WSL2 bridge validation evidence.
- Kept native Windows as not executed and Docker Desktop as blocked by environment.

## [0.1.22] - 2026-08-12

- Recorded real WSL2 Phase 1 validation evidence and Vault reseal behavior after restart.
- Documented Windows/PowerShell as not executed and Docker Desktop as blocked by environment.

## [0.1.21] - 2026-08-12

- Added platform compatibility evidence for Linux, WSL2, Windows, PowerShell and Docker Desktop.
- Added command-not-found runtime coverage.

## [0.1.20] - 2026-08-12

- Enforced project/environment Vault path binding during configuration validation.
- Integrated Vault lifecycle state into `doctor` reports.
- Made bootstrap explicitly stop before operator initialization or unseal.

## [0.1.19] - 2026-08-12

- Extracted all CLI commands into dedicated command modules.
- Reduced `index.ts` to CLI registration, composition and global error handling.

## [0.1.18] - 2026-08-12

- Moved Keytar and Docker Compose adapters into `@devvault/platform`.
- Added a CLI composition root for Vault, authentication, credentials, Docker and application services.
- Consolidated `CredentialStore` as a Core port.

## [0.1.17] - 2026-08-12

- Added explicit Vault lifecycle state classification.
- Added platform-level DockerManager and moved Compose startup out of the CLI implementation.
- Kept explicit `VAULT_TOKEN` workflows functional when the OS keyring is unavailable.

## [0.1.16] - 2026-08-12

- Added Core application service ports for project, secret and runtime operations.
- Moved CLI secret and run orchestration behind injected application adapters.

## [0.1.15] - 2026-08-12

- Added effective Vault capability checks to diagnostics.
- Added project policy validation without reading secret values.

## [0.1.14] - 2026-08-12

- Added idempotent Userpass enablement and human identity creation.
- Added `devvault bootstrap` without persisting bootstrap credentials.

## [0.1.13] - 2026-08-12

- Corrected generated KV v2 policy paths for project-scoped data and metadata.
- Documented Userpass, keyring requirements and policy scope.

## [0.1.12] - 2026-08-12

- Declared keytar directly for the CLI runtime so keyring-backed authentication resolves correctly.

## [0.1.11] - 2026-08-12

- Added Userpass `login` and token-revoking `logout` commands.
- Added keyring-backed session storage through `KeytarCredentialStore`.
- Added authenticated session state to `status` output.

## [0.1.10] - 2026-08-12

- Added non-echoing interactive secret input.
- Added centralized CLI error output without stack traces.

## [0.1.9] - 2026-08-12

- Added `devvault run -- <command>` with Vault mapping resolution.
- Added child process stream inheritance, signal forwarding and exit code propagation.

## [0.1.8] - 2026-08-12

- Treated missing KV metadata paths as empty lists for first-time projects.
- Added a real integration edge-case regression test for empty secret listings.

## [0.1.7] - 2026-08-12

- Added idempotent `devvault init` for local Compose startup and KV v2 preparation.
- Added Vault mount inspection before enabling KV v2.

## [0.1.6] - 2026-08-12

- Added `secret set`, `get`, `list` and confirmed `delete` operations.
- Added nested KV values and stdin-based secret input without command-line values.

## [0.1.5] - 2026-08-12

- Added `status` and `doctor` commands with human-readable and JSON output.
- Added diagnostics tests for healthy and failed local setup states.

## [0.1.4] - 2026-08-12

- Aligned the CLI version output with the workspace release version.

## [0.1.3] - 2026-08-12

- Added ESLint 9 flat configuration with TypeScript support.

## [0.1.2] - 2026-08-12

- Added the functional `devvault init-project` command.
- Prevented accidental project configuration overwrite unless `--force` is explicit.

## [0.1.1] - 2026-08-12

- Added the Vault KV v2 HTTP client and typed error mapping.
- Added persistent local Vault Docker Compose configuration and least-privilege policies.
- Added README, usage, configuration, architecture, security, troubleshooting and threat model guides.

## [0.1.0] - 2026-08-12

- Started the DevVault MVP monorepo.
- Added typed core contracts and project configuration validation.
- Added the initial CLI entry point.