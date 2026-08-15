<p align="center">
    <img src="./assets/images/devvault.png">
</p>

<h1 align="center">DevVault your developer vault local</h1>


<p align="center">
  DevVault: Zero `.env` files, protected secrets, and hassle-free development.
</p>

---

[![npm version](https://img.shields.io/npm/v/@fean-developer/devvault-cli)](https://www.npmjs.com/package/@fean-developer/devvault-cli)
[![npm downloads](https://img.shields.io/npm/dm/@fean-developer/devvault-cli)](https://www.npmjs.com/package/@fean-developer/devvault-cli)
[![install size](https://packagephobia.com/badge?p=@fean-developer/devvault-cli)](https://packagephobia.com/result?p=@fean-developer/devvault-cli)
[![Linux](https://img.shields.io/badge/Linux-supported-2ea44f?logo=linux&logoColor=white)](#platform-support)
[![WSL2](https://img.shields.io/badge/WSL2-supported-2ea44f?logo=windows&logoColor=white)](#platform-support)
[![macOS](https://img.shields.io/badge/macOS-supported-2ea44f?logo=apple&logoColor=white)](#platform-support)

---

DevVault is a command-line developer experience layer for HashiCorp Vault. It lets local applications consume secrets at runtime without committing `.env` files, passwords or tokens to the project repository.

DevVault is a CLI, not an application framework or a replacement for HashiCorp Vault. Vault remains the source of truth for secrets, while DevVault prepares the local environment, resolves project environments and injects mapped secrets into a child process.

## Why DevVault

- local Vault bootstrap through `devvault start`;
- automatic local initialization and unseal for the owned development Vault;
- project and environment isolation;
- runtime secret injection without creating `.env` files;
- OS keyring sessions for developer authentication;
- safe status and diagnostic commands;
- explicit protection for sensitive environments.

## Requirements

- Node.js 20 or newer;
- Docker Engine or Docker Desktop with Docker Compose;
- Linux, macOS or WSL for the validated MVP scope;
- an available OS keyring for developer sessions;
- network access to npm during installation.

Native Windows, live remote Vault and Docker Desktop-specific behavior require additional validation in this MVP.

## Platform support

| Platform | Status |
|---|---|
| Linux | ✅ Supported and tested |
| WSL2 | ✅ Supported and tested |
| macOS | ✅ Supported |
| Native Windows | 🚧 Planned |


## Installation

```bash
npm install -g @fean-developer/devvault-cli
devvault --version
devvault --help
```

## First project

From the root of an application project:

```bash
cd ~/my-project
devvault init-project --environment development
devvault environment set development
devvault start
```

`devvault start` prepares the owned local Vault automatically. The developer does not need to create, copy or enter a root token or unseal key.

During startup, the CLI displays progress for the local environment, Vault and secret storage. Failures show the reason and suggest `devvault doctor`.

Store application secrets through hidden prompts:

```bash
devvault secret set database.username
devvault secret set database.password
```

Run the application with configured secrets:

```bash
devvault run -- npm start
```

No `.env` file is created.

## Environments

```bash
devvault init-project --environment development
devvault init-project --environment production
devvault environment set development
devvault environment current
devvault environment list
```

Use another environment for one command without changing the active context:

```bash
devvault secret list --environment production
devvault run --environment production -- npm start
```

## Supported applications

DevVault can run any local command that reads configuration from environment variables. It is not limited to Node.js.

| Application type | Example |
| --- | --- |
| Node.js / JavaScript / TypeScript | `devvault run -- npm start` |
| Python | `devvault run -- python app.py` |
| Go | `devvault run -- ./my-service` |
| Java / Spring Boot | `devvault run -- java -jar app.jar` |
| .NET | `devvault run -- dotnet run` |
| Ruby / Rails | `devvault run -- bundle exec rails server` |
| PHP / Laravel | `devvault run -- php artisan serve` |
| Shell scripts | `devvault run -- ./deploy-local.sh` |
| Database and migration CLIs | `devvault run -- npx prisma migrate dev` |

The application must already know which environment variable names to read. Configure mappings in the environment YAML:

```yaml
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
```

## Common commands

```bash
devvault start
devvault status
devvault doctor
devvault secret set <key>
devvault secret get <key>
devvault secret list
devvault secret delete <key> --yes
devvault run -- <command> [args...]
devvault logout
```

Create an additional local developer identity:

```bash
devvault user create --username <name>
devvault logout
devvault login --username <name>
```

## Documentation

- [Guia completo em português](docs/GUIA-USO-PT-BR.md)
- [Release notes](RELEASE-NOTES.md)

## Security and MVP limitations

Secrets stay in Vault and are resolved only when a process starts. Do not put tokens, passwords or secret values in project files, command arguments, logs or Git.

This is a pre-1.0 MVP. A compromised workstation, Docker daemon or local user may access local secrets. Read the release notes before use.
