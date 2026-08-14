# DevVault

DevVault is a developer experience layer over HashiCorp Vault. It lets local applications consume secrets at runtime without committing `.env` files, passwords or tokens to a repository.

Vault remains the source of truth. DevVault provides the local lifecycle, project/environment resolution, secret mapping and process execution experience around it.

## Quick start for users

Install the published CLI:

```bash
npm install -g @fean-developer/devvault-cli
devvault --version
```

From an application project:

```bash
cd ~/my-project
devvault init-project --environment development
devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```

`devvault start` initializes and unseals the owned local Vault, configures KV/policies and prepares the developer session without asking for root tokens or unseal keys.

Complete user documentation:

- [Guia completo em português](docs/GUIA-USO-PT-BR.md)
- [npm package README](apps/cli/README.md)
- [npm package release notes](apps/cli/RELEASE-NOTES.md)

## Multi-environment projects

Create independent configuration files:

```bash
devvault init-project --environment development
devvault init-project --environment production
devvault environment set development
devvault environment current
devvault environment list
```

Use a one-command override without changing the active context:

```bash
devvault secret list --environment production
devvault run --environment production -- npm start
```

Configurations live under:

```text
environments/<environment>/devvault.yaml
```

The active context is local metadata in `.devvault/context.json` and contains no secrets.

## Supported applications

DevVault can run any local command that consumes environment variables, including:

- Node.js, JavaScript and TypeScript;
- Python;
- Go;
- Java and Spring Boot;
- .NET;
- Ruby and Rails;
- PHP and Laravel;
- shell scripts;
- database and migration CLIs.

Example:

```bash
devvault run -- python app.py
devvault run -- ./service
devvault run -- java -jar app.jar
devvault run -- dotnet run
devvault run -- npx prisma migrate dev
```

## Requirements

For users:

- Node.js 20+;
- Docker Engine or Docker Desktop with Compose;
- Linux, macOS or WSL for the validated MVP scope;
- OS keyring support for developer sessions.

Native Windows, live remote Vault and Docker Desktop-specific behavior require additional validation.

For repository development:

- Node.js 20+;
- Corepack;
- pnpm 10 through Corepack;
- Docker with Compose.

## Repository development

```bash
corepack enable
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Build the npm staging package:

```bash
corepack pnpm pack:npm
```

The generated package is created under `.npm-dist/`. Test it locally before publishing:

```bash
cd .npm-dist
npm pack
npm install -g ./fean-developer-devvault-cli-0.1.12-beta.1.tgz
devvault --version
```

Publish only after authenticating with the intended npm account:

```bash
npm login
npm whoami
npm publish --access public
```

## Security

- Secrets remain in Vault and are resolved only at runtime.
- Configuration files contain references, never secret values.
- DevVault does not create `.env` files.
- Tokens, passwords and unseal material must not appear in logs, arguments, JSON or Git.
- The local bootstrap boundary is protected only as well as the local host and Docker daemon.
- A compromised workstation can access local secrets.

## Engineering documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Threat model](docs/threat-model.md)
- [Platform compatibility](docs/platform-compatibility.md)
- [Setup guide](docs/setup.md)
- [Distribution test plan](docs/DISTRIBUTION-TEST-PLAN.md)
