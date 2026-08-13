# DevVault Usage Guide

## 1. Install and verify

```bash
corepack enable
corepack pnpm install
corepack pnpm test
```

## 2. Start Vault

```bash
docker compose -f infra/vault/docker-compose.yml up -d
docker compose -f infra/vault/docker-compose.yml ps
```

The service is reachable only through `http://127.0.0.1:8200` from the host.

For an already initialized Vault, use the CLI bootstrap check:

```bash
VAULT_TOKEN=<token> devvault init
```

The command is idempotent and does not remove the persistent volume. A new Vault must be initialized and unsealed once with the Vault operator before this command can enable KV v2.

For a real project, first change into the application directory. `init-project` and `bootstrap` must run there because the project policy is derived from the current directory name:

```bash
cd ~/src/my-api
VAULT_TOKEN=<administrative-token> devvault init-project --environment development
```

Then create the first human identity from that same project directory:

```bash
VAULT_TOKEN=<administrative-token> devvault bootstrap --username alice
```

When the prompt says `Secret value:`, enter a new password for the human `alice` account. It is not an application secret, root token or unseal key. The administrative token is not stored by DevVault. Bootstrap is separate from Vault operator initialization and unseal.

For a new Vault, initialize and unseal it through the Vault operator procedure first. DevVault will refuse to bootstrap an uninitialized or sealed Vault rather than handling unseal material implicitly.

## 3. Authenticate

```bash
devvault login --username alice
devvault status --json
devvault logout
```

The password is read without echo. The session is stored in the OS keyring. Do not use a plaintext fallback when Secret Service or Windows Credential Manager is unavailable.

## 4. Configure a project

Initialize a project with:

```bash
devvault init-project
```

The command creates only non-sensitive YAML and refuses to replace an existing file unless `--force` is supplied. Do not add credentials to it.

## 5. Store a secret

The intended flow is:

```bash
devvault secret set database.password
```

The value must be entered through a hidden prompt. It must never be passed as a command-line argument because arguments can enter shell history and process inspection output.

## 6. Run an application

The runtime command is planned for the next MVP slice:

```bash
devvault run -- node app.js
```

The child process receives only the mapped values from the configured Vault path. DevVault does not generate `.env` files.

The repository includes a minimal fixture under `tests/fixtures/test-app` for this flow.

## 6. Inspect safely

Use diagnostics without printing values:

```bash
devvault doctor
devvault status --json
```

`doctor` reports Node.js, project configuration and Vault health checks. It returns exit code `1` when a check fails. `status` reports only Vault health and supports JSON output.

## 7. Stop and preserve data

```bash
docker compose -f infra/vault/docker-compose.yml restart
docker compose -f infra/vault/docker-compose.yml down
docker compose -f infra/vault/docker-compose.yml up -d
```

The named volume preserves Vault data across container recreation. Never run `docker volume rm devvault-vault-data` unless deleting the local Vault is intentional.

## Common mistakes

- Do not commit `.env` files or tokens.
- Do not use the Vault root token for an application process.
- Do not put a literal value on the right side of a `runtime.mappings` entry.
- Do not expose port `8200` on all host interfaces.
- Do not assume environment variables protect secrets from a compromised local machine.