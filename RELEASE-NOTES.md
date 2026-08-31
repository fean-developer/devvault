# Release Notes — DevVault v1.0.34

**Release Date:** 2026-08-31
**Version:** v1.0.34
**Status:** Patch release for the validated local-development scope

## Highlights

- Fixed `devvault secret list` for DevVault's single-document KV v2 storage
	model. It now returns sorted, flattened logical keys such as
	`database.password` and `database.username`.
- Secret values are never printed by `secret list`.
- Missing or empty project/environment documents return an empty list.

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
npm install -g @fean-developer/devvault-cli@1.0.34
devvault --version
```

To remove the CLI:

```bash
npm uninstall -g @fean-developer/devvault-cli
```
