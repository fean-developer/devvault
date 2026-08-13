# DevVault Usage Guide

## 1. Install and verify

```bash
corepack enable
corepack pnpm install
corepack pnpm test
```

## 2. Developer-first local lifecycle

From a project directory containing `devvault.yaml`, use:

```bash
devvault start
```

`start` starts an owned local Vault container when it is stopped and validates lifecycle, KV v2 and required capabilities. Run it again safely when the environment is already ready.

If the local Vault is sealed or has never been initialized, `start` handles the local bootstrap automatically. Root token and unseal material remain inside the dedicated local Docker bootstrap boundary and are never requested from the developer.

For diagnostics:

```bash
devvault status
devvault doctor
devvault start --json
```

An explicitly configured remote Vault is validated read-only. `start` never initializes, unseals or changes a remote Vault. `devvault stop` is not part of this release.

`start` validates local infrastructure readiness. `doctor` also checks the current human developer identity; `Project policy` can remain unavailable until the developer completes the separate human login flow. The local root bootstrap credential is never used as the normal developer identity.

After infrastructure is ready, application execution still requires a developer identity with the project's least-privilege policy. This is intentional:

```bash
devvault login --username alice
devvault run -- npm start
```

`start` owns local Vault bootstrap. It does not replace human authentication or use the internal root bootstrap credential for application processes.

The local developer session is prepared automatically by `start`. Application secrets remain project-owned and must be entered explicitly:

```bash
devvault secret set database.username
devvault secret set database.password
```

## 3. Start Vault

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

### Clean local reset and credential generation

Use this only when deleting the local Vault data is intentional. It removes all local secrets, users, policies and Vault tokens from the named Docker volume.

```bash
cd /path/to/devvault
docker compose -f infra/vault/docker-compose.yml down
docker volume rm devvault-vault-data
docker compose -f infra/vault/docker-compose.yml up -d
```

Wait until Vault is responding, then initialize it. Vault prints one unseal key and one initial root token because this development configuration uses one key share and one threshold:

```bash
docker exec -it devvault-vault vault operator init -key-shares=1 -key-threshold=1
```

Store the unseal key and root token in a password manager. Do not put them in `.secrets`, `.env`, Git or project configuration. Unseal the new instance:

```bash
docker exec -it devvault-vault vault operator unseal
```

Enter the generated unseal key, then configure KV v2 with the generated root token:

```bash
read -rsp 'Vault root token: ' VAULT_TOKEN
echo
export VAULT_TOKEN
devvault init
```

From the application root, create the project policy and human login:

```bash
cd /path/to/application
VAULT_TOKEN="$VAULT_TOKEN" devvault init-project --environment development
VAULT_TOKEN="$VAULT_TOKEN" devvault bootstrap --username alice
unset VAULT_TOKEN
```

The `bootstrap` password is the new password for `alice`; it is not the Vault root token or unseal key.

Authenticate and verify access:

```bash
devvault login --username alice
devvault doctor
```

If Linux reports `org.freedesktop.secrets`, start a Secret Service session before login:

```bash
eval "$(gnome-keyring-daemon --start --components=secrets)"
```

The expected result is `OK Project policy`, `OK Vault reachable`, `OK Vault initialized` and `OK Vault unsealed`.

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