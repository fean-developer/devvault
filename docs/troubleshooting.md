# Troubleshooting

## `pnpm: command not found`

Use Corepack:

```bash
corepack enable
corepack pnpm install
```

## Vault is unreachable

Check the container and local port:

```bash
docker compose -f infra/vault/docker-compose.yml ps
docker compose -f infra/vault/docker-compose.yml logs vault
curl -sS http://127.0.0.1:8200/v1/sys/health
```

## Configuration is rejected

Check that `devvault.yaml` contains only the documented fields and that mappings point to Vault paths rather than literal values.

## Data disappeared

Confirm that the Compose volume `devvault-vault-data` still exists. Do not use `docker compose down -v` unless deleting the local Vault data is intended.