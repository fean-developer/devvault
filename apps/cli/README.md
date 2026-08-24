<p align="center">
    <img src="https://raw.githubusercontent.com/fean-developer/devvault/main/apps/cli/assets/images/devvault.png" alt="DevVault">
</p>

<h1 align="center">DevVault your developer vault local</h1>


<p align="center">
  DevVault: Zero `.env` files, protected secrets, and hassle-free development.
</p>

---

<p align="center">
<a href="https://www.npmjs.com/package/@fean-developer/devvault-cli"><img src="https://img.shields.io/npm/v/@fean-developer/devvault-cli" alt="npm version"></a>
<a href="https://www.npmjs.com/package/@fean-developer/devvault-cli"><img src="https://img.shields.io/npm/dm/@fean-developer/devvault-cli" alt="npm downloads"></a>
<a href="https://packagephobia.com/result?p=@fean-developer/devvault-cli"><img src="https://packagephobia.com/badge?p=@fean-developer/devvault-cli" alt="install size"></a>
<a href="#platform-support"><img src="https://img.shields.io/badge/Linux-supported-2ea44f?logo=linux&amp;logoColor=white" alt="Linux supported"></a>
<a href="#platform-support"><img src="https://img.shields.io/badge/WSL2-supported-2ea44f?logo=windows&amp;logoColor=white" alt="WSL2 supported"></a>
<a href="#platform-support"><img src="https://img.shields.io/badge/macOS-supported-2ea44f?logo=apple&amp;logoColor=white" alt="macOS supported"></a>
</p>

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
| Docker compose | `devvault run -- docker compose up -d` |

The application must already know which environment variable names to read. Configure mappings in the environment YAML:

```yaml
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
```

- Configure docker compose
> Never do that, this is insecure

```yaml
 backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: myContainerName
    restart: unless-stopped
    env_file:
      - ./backend/.env.docker # don't do that
    environment:
      ...
```

> Use this

```yaml
 backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: myContainerName
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}           # Your secret database.url 
      DATABASE_PASSWORD: ${DATABASE_PASSWORD} # Your secret database.password

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

- [Guia completo em português](https://github.com/fean-developer/devvault/blob/main/apps/cli/docs/GUIA-USO-PT-BR.md)
- [Release notes](https://github.com/fean-developer/devvault/blob/main/apps/cli/RELEASE-NOTES.md)

## Security and MVP limitations

Secrets stay in Vault and are resolved only when a process starts. Do not put tokens, passwords or secret values in project files, command arguments, logs or Git.

This is a pre-1.0 MVP. A compromised workstation, Docker daemon or local user may access local secrets. Read the release notes before use.
