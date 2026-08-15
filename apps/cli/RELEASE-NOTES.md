# DevVault CLI v0.1.12-beta.6

DevVault CLI is a pre-1.0 MVP for trusted local developers.

## This package

The npm package installs the `devvault` executable. It provides a developer-facing workflow over a local HashiCorp Vault instance:

```bash
npm install -g @fean-developer/devvault-cli
devvault start
```

## Included

- automatic local Vault initialization and unseal;
- KV v2 and project policy preparation;
- multi-environment project configuration;
- environment selection and one-command overrides;
- runtime secret injection for command-line applications;
- OS keyring developer sessions;
- `status`, `doctor`, `secret`, `run` and user management commands.

## Validated application model

DevVault supports applications that consume environment variables, including Node.js, Python, Go, Java, .NET, Ruby, PHP, shell scripts and database/migration CLIs. The application must already be installed and must read the mapped variable names.

## Requirements and limitations

- Node.js 20+;
- Docker Engine or Docker Desktop with Compose;
- Linux, macOS or WSL for the validated MVP scope;
- OS keyring support for developer sessions;
- native Windows, live remote Vault and Docker Desktop-specific behavior require additional validation;
- local secrets remain exposed to a compromised workstation or Docker daemon;
- DevVault does not create `.env` files.

Read `README.md` and `docs/GUIA-USO-PT-BR.md` in the package for the complete workflow.
