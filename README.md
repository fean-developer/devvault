# DevVault

DevVault is a developer experience layer over HashiCorp Vault. It lets local commands consume project secrets without creating `.env` files or writing secret values to the repository.

## Início rápido

```bash
cd ~/fean-lab/build-local-runner
devvault init-project --environment development
devvault init-project --environment production
devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```

O comando `devvault start` inicializa e desbloqueia o Vault local, configura KV/policies e prepara a sessão do desenvolvedor sem pedir root token ou unseal key.

Para o passo a passo completo em português, consulte o [Guia de Uso em Português](docs/GUIA-USO-PT-BR.md).

## Status

The project is under active MVP development. The current release (v0.1.11-mvp) contains automatic local Vault bootstrap, multi-environment project configuration, deterministic environment resolution, secret/runtime isolation, setup state persistence and lifecycle diagnostics.

**Phase 0 — Core Correctness (Tier 1):** PASS
**Phase 0 — Infra-Verified (Tier 2):** PENDING (see limitations below)

## Scope & Limitations (MVP Release)

This release targets **Linux and macOS developers** with **local/dev-mode Vault instances**. Native Windows, Docker Desktop, live remote Vault, and multi-project least-privilege isolation are **not validated**. See [RELEASE-NOTES.md](RELEASE-NOTES.md) for detailed platform status, known limitations, and risk acceptance guidance.

This is **v0.1.9-mvp** (pre-1.0), not v1.0.0. Full Phase 0 completion and Phase 1 features are future releases. Do not use this release in production or for untrusted external developers without understanding and accepting the limitations.

## Requirements

- Node.js 20 or newer
- Corepack enabled
- Docker Engine or Docker Desktop with Compose
- pnpm 10, activated through Corepack

The repository uses `corepack pnpm` in its scripts, so a global pnpm installation is not required.

## Installation

```bash
corepack enable
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Project configuration

Each environment has its own `environments/<name>/devvault.yaml` containing only project metadata and Vault references:

```yaml
version: 1
project: my-api
environment: development
protected: false
vault:
  mount: secret
  path: projects/my-api/development
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
```

Mapping values are Vault paths inside the configured project secret. Literal credentials, tokens and unknown fields are rejected by the configuration schema.

Use `devvault start` from the application project. It owns the local Vault bootstrap and does not require manual root tokens or unseal keys.

## Local Vault

Start the local server:

```bash
docker compose -f infra/vault/docker-compose.yml up -d
```

The host binding is restricted to `127.0.0.1:8200`. The persistent Docker volume is named `devvault-vault-data`.

The server uses file storage. `devvault start` initializes and unseals the owned local Vault automatically. Bootstrap material is kept in the dedicated local Docker boundary and is never requested from the developer. Do not put credentials in project files, Git, shell history or logs.

## Current CLI

The executable is available after building:

```bash
corepack pnpm build
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js --version
```

The current commands are:

Available now:

```text
devvault setup [--check] [--json] [--repair] [--non-interactive] [--yes]
devvault init
devvault bootstrap --username <username>
devvault init-project --environment <name> [--force]
devvault environment set <name>
devvault environment current
devvault environment list
devvault start [--json] [--non-interactive]
devvault status [--json]
devvault doctor [--json]
devvault login [--username <username>]
devvault logout
devvault secret set <key> [--environment <name>] [--yes]
devvault secret get <key> [--show]
devvault secret list [--environment <name>]
devvault secret delete <key> --yes
```

Run a configured process without creating `.env` files:

```bash
devvault run [--environment <name>] -- node app.js
```

`devvault start` is the normal workflow. `devvault init` and `devvault setup` remain advanced commands for diagnostics and automation.

`devvault login` uses Vault Userpass and stores the short-lived session in the operating system keyring through `keytar`. It does not fall back to plaintext files. Linux requires Secret Service, Windows uses Credential Manager, and WSL requires an explicitly configured keyring integration.

`devvault doctor` also checks the effective read capability for the configured project path without reading or printing secret values.

The setup workflow is documented in the [setup guide](docs/setup.md). Phase 0 setup state and readiness evidence are documented in the [Phase 0 readiness report](docs/phase-0-readiness-report.md). The setup command does not install Docker Desktop, create `.env` files or replace later human authentication and policy phases.

## Security rules

- Secrets remain in Vault and are resolved only when needed.
- `devvault.yaml` must never contain secret values.
- Secret values must not be printed in logs or error messages.
- Environment variables are a compatibility mechanism, not a complete security boundary.
- Local process inspection, `/proc`, debuggers, child processes and crash dumps can expose environment values.
- A compromised workstation or Docker installation can access local secrets; DevVault does not eliminate that risk.

## Development

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

Unit tests live beside package source. Docker-backed integration tests and end-to-end tests will live under `tests/`.

## Documentation

- [Release Notes — MVP](RELEASE-NOTES.md) — platform support, limitations, risk acceptance
- [MVP Decision & Tier 2 Tracking](docs/artefatos/ADR-Phase0-MVP-Release-Scope.md) — formal decision, known blockers, unblock plans
- [Phase 0 Readiness Report](docs/phase-0-readiness-report.md) — verification evidence and timeline
- [Usage guide](docs/usage.md)
- [Guia de Uso em Português](docs/GUIA-USO-PT-BR.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Threat model](docs/threat-model.md)
- [Platform compatibility](docs/platform-compatibility.md)
- [Setup guide](docs/setup.md)
- [Distribution evaluation](docs/distribution.md)