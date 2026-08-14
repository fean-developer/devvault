# DevVault CLI

Developer-first local secret runtime powered by HashiCorp Vault.

## Install

```bash
npm install -g @devvault/cli
```

Requirements:

- Node.js 20+
- Docker Engine or Docker Desktop with Compose
- Linux, macOS or WSL with an available OS keyring

## Start a project

```bash
cd ~/my-project
devvault init-project --environment development
devvault environment set development
devvault start
devvault secret set database.password
devvault run -- npm start
```

`devvault start` initializes and unseals the owned local Vault automatically. Root tokens and unseal keys are not requested from the developer.

Create another environment independently:

```bash
devvault init-project --environment production
devvault environment set production
```

Use an environment for one command without changing the active context:

```bash
devvault run --environment production -- npm start
```

Read the complete Portuguese guide in `docs/GUIA-USO-PT-BR.md`.

This is an MVP pre-release. Read the release notes before use.
