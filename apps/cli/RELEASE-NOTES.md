# Release Notes — DevVault v1.0.33

**Release Date:** 2026-08-30
**Version:** v1.0.33
**Status:** MVP release candidate for the validated local-development scope

## Highlights

- Public npm package: `@fean-developer/devvault-cli`.
- Local Vault lifecycle, project environments, Userpass developer sessions, secret management, runtime injection, diagnostics, and authorization denial handling.
- Secrets are resolved only at runtime; DevVault does not create `.env` files.
- The distributed package includes the MIT license, release notes, local Vault Compose files, and the `devvault` executable.

## Validated Scope

- Linux: supported and tested.
- WSL2: tested with limitations.
- PowerShell to WSL: tested with limitations.
- Local HashiCorp Vault 1.20.4: real-Vault happy path and authorization-denial smoke tested.

## Limitations

- macOS is unverified.
- Native Windows is unsupported for this release.
- Docker Desktop-specific behavior and live remote Vault deployments remain unverified.
- Runtime secrets are environment variables and can be exposed on a compromised workstation or to child processes.
- Auto-update and standalone binaries are not implemented.

## Upgrade

```bash
npm install -g @fean-developer/devvault-cli@1.0.33
devvault --version
```

To remove the CLI:

```bash
npm uninstall -g @fean-developer/devvault-cli
```
