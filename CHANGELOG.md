# Changelog
## [1.0.28] - 2026-08-28

- Added Session/Auth E2E and security evidence for login recovery, session guards, diagnostics redaction and credential-source isolation.

## [1.0.27] - 2026-08-28

- Scoped session enforcement to protected operations while preserving session-independent project application construction.

## [1.0.26] - 2026-08-28

- Wired CredentialStore-backed session resolution and guards into human project operations, keeping administrative credentials separate.

## [1.0.25] - 2026-08-28

- Added session-observing diagnostics for status and doctor while preserving independent Vault lifecycle reporting.

## [1.0.24] - 2026-08-28

- Added shared session-guard enforcement before runtime secret execution and child-process launch.

## [1.0.23] - 2026-08-28

- Added shared session-guard hooks to all secret commands before protected operations.

## [1.0.22] - 2026-08-28

- Added a centralized session guard that returns only validated developer sessions and blocks all non-active states.

## [1.0.21] - 2026-08-28

- Added developer-session logout orchestration with best-effort remote revocation and unconditional local cleanup.

## [1.0.20] - 2026-08-28

- Added secure login orchestration with metadata normalization and failed-login session preservation.

## [1.0.19] - 2026-08-28

- Added centralized developer session resolution with remote validation and explicit non-authenticated state mapping.

## [1.0.18] - 2026-08-28

- Added safe semantic mapping for developer-session, authorization and Vault lifecycle failures.

## [1.0.17] - 2026-08-28

- Added remote Vault developer-session validation with conservative authentication and infrastructure error semantics.

## [1.0.16] - 2026-08-28

- Separated normalized human authentication results from developer session validation while preserving the existing Userpass login interface.

## [1.0.15] - 2026-08-28

- Added backend-scoped developer session persistence with token-only legacy compatibility and cross-backend isolation.

## [1.0.14] - 2026-08-27

- Decoupled global `start` lifecycle from unavailable project-aware context while preserving configured project operations.

## [1.0.13] - 2026-08-27

- Completed status and doctor JSON diagnostics for environment state, configuration and remediation metadata.

## [1.0.12] - 2026-08-27

- Added protected `secret set` consent coverage, including denied writes and explicit `--yes` authorization.

## [1.0.11] - 2026-08-26

- Added stronger environment-context guard, protected-operation, legacy coexistence and diagnostic verification coverage.

## [1.0.10] - 2026-08-26

- Strengthened environment guard, protected-environment, legacy-configuration and diagnostic coverage.

## [1.0.9] - 2026-08-26

- Added persistent active environment context before project initialization.
- Added environment-state-aware CLI resolution, diagnostics and explicit override handling.

## [1.0.7] - 2026-08-24

- Keywords included in package.json for the CLI

## [1.0.6] - 2026-08-24

- Update README and release notes. 
- Add Docker compose instructions. 
- Include keywords in package.json.


## [1.0.5] - 2026-08-21

- Corrigida a geração do manifesto npm para incluir os metadados públicos de GitHub: `repository`, `homepage` e `bugs`.
- Corrigidos os links de documentação no README publicado no npm para usar URLs absolutas do GitHub e evitar 404 em pacotes com escopo.
- Reforçada a verificação do pacote npm para falhar quando metadados de GitHub ou links públicos de documentação estiverem ausentes.

## [1.0.4] - 2026-08-15

- Corrigida a imagem do README publicado no npm usando uma URL pública absoluta do GitHub.
- Mantido o asset no pacote npm para instalações offline e outros consumidores do pacote.

## [1.0.3] - 2026-08-15

- Corrigida a preparação do pacote npm para incluir `assets/images/devvault.png`, usada pelo README publicado.
- Adicionada verificação automática que falha caso a imagem da marca não esteja presente no pacote gerado.

## [1.0.1] - 2026-08-14

- Publicada a versão estável `@fean-developer/devvault-cli` com metadados de versão sincronizados entre o pacote npm e o binário da CLI.
- Adicionada geração e verificação do pacote npm, incluindo instalação limpa do tarball e execução do binário antes da publicação.
- Adicionada espera explícita pela disponibilidade do Vault após a inicialização pelo Docker Compose, evitando condições de corrida em instalações limpas.
- Adicionado feedback visual do ciclo de inicialização com progresso e spinner TTY, preservando saída JSON e redirecionada sem sequências de controle.
- Corrigido o diagnóstico de policies para interpretar as respostas efetivas de `capabilities-self` do Vault.

## [1.0.0] - 2026-08-14

- Primeira versão estável do DevVault.
- Version é obtida do package.json

## [0.1.12-alpha.2] - 2026-08-14

- Prevented accidental publishing from the monorepo root by keeping the root package private.
- Added npm package verification that installs the generated tarball and executes the `devvault` binary before publishing.
- Aligned the CLI runtime version with the npm package version.

## [0.1.12-alpha.1] - 2026-08-14

- Added `npm run corepack:npm` for compiled npm package generation without a global pnpm installation.
- Added `npm run pack:npm` to create the publishable `.tgz` artifact.

## [0.1.12-beta.8] - 2026-08-14

- Added VS Code tasks that use Corepack, so package generation works without a global pnpm installation.

## [0.1.12-beta.7] - 2026-08-14

- Added the explicit `package:npm` command to generate the publishable package under `.npm-dist/`.

## [0.1.12-beta.6] - 2026-08-14

- Added an animated circular TTY spinner for each `devvault start` lifecycle stage.
- Preserved clean JSON and redirected output without terminal control sequences.

## [0.1.12-beta.5] - 2026-08-14

- Fixed project policy diagnostics for real Vault `capabilities-self` response shapes.

## [0.1.12-beta.4] - 2026-08-14

- Ensures `devvault start` refreshes the local least-privilege developer session before readiness diagnostics.
- Fixes stale keyring sessions causing `doctor` to report project policy failures after a clean npm installation.

## [0.1.12-beta.3] - 2026-08-14

- Added visible progress feedback for `devvault start` stages and actionable failure output.
- Added the explicit `Digite a senha:` prompt for human login.

## [0.1.12-beta.2] - 2026-08-14

- Fixed clean-install startup races by waiting for Vault health after Docker Compose starts.

## [0.1.12-beta.1] - 2026-08-14

- Renamed the public npm package to `@fean-developer/devvault-cli`.
- Switched the prerelease version to `0.1.12-beta.1`.
- Made the root package private while using its metadata to generate the public npm staging package.

## [0.1.12-mvp] - 2026-08-13

- Reworked the npm package README to explain DevVault, its purpose, requirements and supported application types.
- Expanded the Portuguese package guide with complete installation, environment, secret, user and runtime workflows.

## [0.1.11-mvp] - 2026-08-13

- Prepared `@devvault/cli` for npm distribution with a self-contained bundled executable.
- Added npm package README, release notes and Portuguese usage guide.
- Added npm clean-install validation for the public CLI artifact.

## [0.1.10-mvp] - 2026-08-13

- Fixed logout to clear the local keyring session when remote token revocation is unavailable.
- Added `devvault user create --username <name>` for additional local developer identities.
- Improved invalid Userpass login errors.

## [0.1.9-mvp] - 2026-08-13

- Updated README with the current developer-first and multi-environment workflow.
- Added the Portuguese step-by-step usage guide with command variations and recovery instructions.

## [0.1.8-mvp] - 2026-08-13

- Added multi-environment project configuration under `environments/<name>/devvault.yaml`.
- Added `devvault environment set|current|list` and deterministic environment resolution.
- Added explicit environment overrides, protected-environment mutation confirmation and legacy config compatibility.

## [0.1.7-mvp] - 2026-08-13

- Automatically create and refresh the local least-privilege developer session during `devvault start`.
- Store only the developer session token in the OS keyring; keep root/bootstrap material inside the local bootstrap boundary.
- Preserve application secret ownership: missing project secrets remain explicit runtime errors.

## [0.1.6-mvp] - 2026-08-13

- Completed automatic local Vault bootstrap through `devvault start`.
- Added internal initialization, unseal, KV v2 and project policy preparation without developer-managed tokens or unseal keys.
- Added a dedicated Docker bootstrap volume boundary and project-aware readiness validation.
- Preserved remote Vault as operator-managed and read-only.

## [0.1.5-mvp] - 2026-08-13

- Added lifecycle recovery and credential-boundary evidence for local start failures, corrupt state and ephemeral unseal handling.

## [0.1.4-mvp] - 2026-08-13

- Enforced consent before local lifecycle mutations and reused the authoritative setup state store.
- Added production entrypoint coverage and read-only status verification.
- Kept Docker/Vault bootstrap material ephemeral and uninitialized Vault handling explicit.

## [0.1.3-mvp] - 2026-08-13

- Added the developer-first `devvault start` lifecycle facade.
- Added safe local container start, lifecycle/readiness validation and manual ephemeral unseal handling.
- Kept uninitialized Vault handling explicit and remote Vault lifecycle read-only.
- Added production-path lifecycle and output-sanitization coverage.

## [0.1.2-mvp] - 2026-08-13

- Fixed the local Vault Docker healthcheck to use the configured HTTP listener.

## [0.1.1-mvp] - 2026-08-13

- Fixed Linux/WSL login with the CommonJS `keytar` module when bundled as ESM.
- Added coverage for both direct and default-exported keyring APIs.

## [0.1.0-mvp] - 2026-08-13

**Phase 0 MVP Release — Two-Tier Gate Model**

- **APPROVED FOR DISTRIBUTION** under Tier 1 (Core Correctness) scope: Linux, macOS, local/dev-mode Vault.
- **Tier 1 — Core Correctness:** PASS. Setup logic, validation, security, and error semantics proven by tests (134 tests, 2 serial runs), mutation sensor (8/8 killed), and static gates (lint, typecheck, build, spec/tasks validation).
- **Tier 2 — Infra-Verified:** PENDING. Windows, Docker Desktop, live remote Vault, and multi-project least-privilege isolation are unvalidated; tracked with named blockers and unblock preconditions.
- **Known limitations:** Native Windows (NOT TESTED), Docker Desktop (NOT TESTED), live remote Vault (NOT TESTED), multi-project least-privilege isolation (NOT TESTED), full proc/log/dump coverage (PARTIAL). See [RELEASE-NOTES.md](RELEASE-NOTES.md) and [ADR-Phase0-MVP-Release-Scope.md](docs/artefatos/ADR-Phase0-MVP-Release-Scope.md) for details, risks, and mitigation.
- **Version scheme:** This is v0.1.0-mvp (pre-1.0), not v1.0.0. Full Phase 0 PASS (Tier 1 + Tier 2) and Phase 1 are future releases.
- **Distributions:** Suitable for trusted internal developers on Linux/macOS. Do not distribute to external users or untrusted environments without explicit limitation and risk acknowledgment.
- Evidence commits: 940309d (T19), 5092a90 (T20/T23), bc5ec10 (T24 sanitization), e5160cc (T24 mutation sensor).

## [0.1.53] - 2026-08-13

- Recorded the reproducible Phase 0 mutation sensor result: 8 generated, 8 killed, 0 survived.

## [0.1.52] - 2026-08-13

- Preserved lifecycle state words during sanitization and added the reproducible Phase 0 mutation sensor/audit trail.

## [0.1.51] - 2026-08-13

- Closed final controllable Phase 0 verifier findings for human output sanitization, step exceptions and non-interactive consent.

## [0.1.50] - 2026-08-13

- Stabilized the Phase 0 serial verification gate and added non-interactive/read-only capability evidence.

## [0.1.49] - 2026-08-13

- Strengthened Phase 0 security evidence for recursive output sanitization, validator exceptions, argv stability and project policy isolation.

## [0.1.48] - 2026-08-13

- Added effective read-only KV v2 mount and Vault capability validation to Phase 0 setup readiness.
- Ensured repair revalidates readiness and mandatory pending checks return `BLOCKED`.

## [0.1.47] - 2026-08-13

- Strengthened Phase 0 production-path regression and mutation coverage for sealed Vault, mandatory capabilities, no backend and failed steps.

## [0.1.46] - 2026-08-13

- Wired the production setup command to backend selection, Vault readiness, profile validation and consent-gated local start.
- Added regression coverage for blocked/failed readiness outcomes and real Commander exit codes.

## [0.1.45] - 2026-08-13

- Added contextual hidden prompts for application secrets and Userpass passwords.

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