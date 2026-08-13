# Setup Guide

`devvault setup` evaluates and records readiness for the local DevVault environment. It does not create project secret files, persist Vault credentials or install Docker Desktop.

## Commands

```bash
devvault setup
```

Runs the setup orchestration with consent required before mutating steps.

```bash
devvault setup --check
devvault setup --check --json
```

Runs read-only checks. It does not acquire the writer lock or persist setup state. JSON output is sanitized and uses the same result exit code as human output.

```bash
devvault setup --repair
```

Resumes incomplete steps from validated user-level setup state. Repair does not reset Vault, delete backend data or remove project files.

```bash
devvault setup --non-interactive
```

Never prompts. A required mutation without authorization returns `BLOCKED`.

```bash
devvault setup --yes
```

Approves the setup mutations that were already classified and described by the command. It is not a general authorization for unspecified or destructive operations.

## Result States

| Result | Exit code | Meaning |
| --- | ---: | --- |
| `READY` | 0 | Mandatory capabilities passed for the selected profile |
| `DEGRADED` | 3 | Mandatory capabilities passed, optional capability is unavailable |
| `BLOCKED` | 4 | Consent, dependency or environment policy prevents progress |
| `FAILED` | 5 | Unexpected failure, corrupt state, lock conflict or invalid backend response |

Vault lifecycle states such as `SEALED` and `UNINITIALIZED` are separate from these setup results.

## State Location

Setup state is stored under the user configuration directory, for example:

```text
Linux/macOS: $XDG_CONFIG_HOME/devvault/setup-state.json
Fallback:     ~/.config/devvault/setup-state.json
Windows:      %APPDATA%/devvault/setup-state.json
```

The state is allowlisted and contains only readiness metadata. Passwords, tokens, SecretIDs, authorization headers, secret values, unseal keys, recovery keys and root credentials are rejected.

## Current Phase 0 Boundary

Phase 0 provides the setup contracts, platform/backend adapters, readiness validation, state persistence, command surface and acceptance evidence. The current command surface does not replace the later human authentication, AppRole, OIDC, final policy or dynamic-secret phases.

Docker Desktop installation or modification is reported as blocked by policy. Run setup on an environment where Docker and the local Vault service are already available, or use the explicit remote backend boundary for read-only checks.

## Project Directory Rule

Run infrastructure commands such as `init` from the DevVault checkout. Run project commands such as `init-project`, `bootstrap`, `login`, `secret` and `run` from the root of the real application. `bootstrap` derives the project policy from the current directory name, so running it in the DevVault checkout assigns the human identity to the wrong project.

The `Secret value:` prompt shown by `bootstrap` asks for the new Userpass human password. The prompt is hidden input; it is not asking for a Vault root token, unseal key or application secret. Application secrets are entered later with `secret set <key>`.

## Security Notes

Environment variables are used only where they are required for application compatibility. They are not a complete security boundary: `/proc`, process inspection, debuggers, child processes and crash dumps may expose values. Never place credentials in `devvault.yaml`, command arguments, Git, logs or project files.
