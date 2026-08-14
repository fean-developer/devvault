# DevVault CLI v0.1.11-mvp

This is a pre-1.0 MVP for trusted local developers.

## Included

- `devvault start` with automatic local Vault bootstrap
- Automatic local unseal, KV v2 and project policy preparation
- Multi-environment configuration
- `devvault environment set|current|list`
- Secret/runtime environment overrides
- OS keyring developer sessions
- `devvault status` and `devvault doctor`

## Limitations

- Linux, macOS and WSL are the supported target environments.
- Live remote Vault, native Windows and Docker Desktop-specific behavior require separate validation.
- A compromised workstation or Docker daemon can access local secrets.
- `devvault start` does not replace explicit project secret creation.

Read the repository release notes and Portuguese usage guide for the complete security and operational limitations.
