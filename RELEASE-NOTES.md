# Release Notes — DevVault v1.0.6

**Release Date:** 2026-08-24
**Version:** v1.0.7
**Status:** Stable package release for the validated local-development scope

## What Is This Release
 
Keywords included in package.json for the CLI

# Release Notes — DevVault v1.0.6

**Release Date:** 2026-08-24
**Version:** v1.0.6
**Status:** Stable package release for the validated local-development scope

## What Is This Release
 
Update README and release notes, add Docker compose instructions, and include keywords in package.json

# Release Notes — DevVault v1.0.5

**Release Date:** 2026-08-21
**Version:** v1.0.5
**Status:** Stable package release for the validated local-development scope

## What Is This Release

**DevVault CLI** for local developer setup and readiness workflows. A developer installs this CLI, runs `devvault setup`, and gets a validated, tested, evidence-backed check that their local environment is ready for secret management with HashiCorp Vault.

This release packages the developer-first local Vault workflow as the public `@fean-developer/devvault-cli` npm package. It includes the `devvault start` lifecycle, project and environment workflows, runtime secret injection, OS keyring sessions, diagnostics and the distribution checks required to validate a clean npm installation.

The release is stable for the validated local-development scope. It does not claim that every platform or remote Vault topology has been validated.

## Highlights

- The generated npm manifest now includes GitHub `repository`, `homepage` and `bugs` metadata.
- npm README documentation links now use public GitHub URLs, avoiding 404s caused by scoped-package relative links on npmjs.com.
- Package verification now fails if GitHub metadata or public documentation links are missing from `.npm-dist`.
- The npm README now uses a public absolute URL for the branding image.
- The npm package also includes the branding image as a local asset.
- Public scoped npm package: `@fean-developer/devvault-cli`.
- Self-contained npm package generation, tarball verification and executable validation before publishing.
- Version metadata synchronized between the package and the CLI binary.
- `devvault start` now waits for Vault readiness before continuing.
- Animated TTY progress spinner and clearer lifecycle progress feedback, while preserving clean JSON and redirected output.
- Correct handling of effective Vault capability responses for project policy diagnostics.

## What Works (Tier 1)

Guaranteed:

- ✓ `devvault setup` — interactive setup workflow
- ✓ `devvault setup --non-interactive --yes` — non-interactive with explicit approval
- ✓ `devvault setup --check` — read-only readiness check
- ✓ `devvault setup --json` — machine-readable output
- ✓ `devvault setup --repair` — recover from incomplete setup
- ✓ **Effective validation:** KV v2 mount validation and Vault policy/capability checks actually contact the Vault server and validate real responses (not static checks)
- ✓ **Result semantics:** READY, DEGRADED, BLOCKED, FAILED states correctly represent setup progress
- ✓ **Security:** Secrets are redacted from human-readable and JSON output; lifecycle state words (`unsealed`, `sealed`) remain visible for clarity
- ✓ **Error handling:** Setup step exceptions are converted to generic, safe error messages — no internal details leak
- ✓ **Test coverage:** 134 tests across 33 files, 2 full serial runs, mutation sensor (8/8 killed), lint/typecheck/build all green

## What Is NOT Validated (Tier 2 — PENDING)

**Do NOT use this release if you require any of the following. Tier 2 validation is incomplete and the CLI may or may not work correctly in these environments:**

### Native Windows

**Status:** NOT TESTED

The CLI has not been validated on Windows (cmd.exe, PowerShell, Windows Terminal). The code may work, or it may fail in ways we haven't discovered. Do not use this release on Windows without testing it first in a non-production environment.

**Unblock plan:** Add windows-latest CI runner and re-run test suite. Requires CI configuration change only.

### Docker Desktop

**Status:** NOT TESTED IN THIS ENVIRONMENT

The CLI's Docker integration has not been validated against Docker Desktop specifically. Behavior is unknown.

**Unblock plan:** Provision an approved Docker Desktop environment for CI/QA, or validate against a compatible alternative (Colima, Podman). Requires corporate environment/IT approval.

### Live Remote Vault

**Status:** NOT TESTED

Only local/dev-mode Vault has been validated. Real remote Vault endpoints — especially with TLS, network latency, authentication backends, and production configurations — are untested. The CLI's behavior against a live remote Vault is unknown.

**Do not use this release against a production Vault without first validating in a staging environment.**

**Unblock plan:** Stand up a disposable Vault dev/staging instance reachable from CI with network policy and scoped token. Requires infrastructure provisioning and approval.

### Multi-Project Least-Privilege Isolation

**Status:** NOT TESTED

Setup validation assumes a single project or shared Vault. The CLI's behavior when multiple projects exist with distinct policies and least-privilege isolation requirements is unverified.

**Do not rely on readiness checks as a security guarantee for multi-tenant or multi-project isolation until this is validated.**

**Unblock plan:** Provision a real two-policy Vault setup and run existing isolation tests against it. Depends on live remote Vault infrastructure (see above).

### Comprehensive Process/Log/Crash-Dump Coverage

**Status:** PARTIALLY TESTED

The CLI's setup logic was tested for:
- ✓ Process arguments (`argv`) stability
- ✓ Exception-to-generic-error conversion
- ✓ Sanitized human and JSON output

NOT tested:
- ✗ Full `/proc` inspection scenarios
- ✗ Crash dump content analysis
- ✗ All global log sinks and error paths

Secret leakage through these surfaces is unlikely but not proven impossible.

**Risk:** For non-production use or internal developers only. Do not distribute to untrusted external users until this is closed.

**Unblock plan:** Dedicated code-only correction cycle to audit and test remaining process/log surfaces. No external infrastructure required; pure engineering work.

## Known Limitations

- **Platform support:** Linux and macOS only. Windows behavior is unknown (see above).
- **Vault target:** Local/dev-mode Vault or provisioned staging only. Production remote Vault untested.
- **Secret exposure:** Runtime injection uses environment variables; a compromised workstation or child process may inspect them.
- **Auto-update:** Not implemented. You must manually update by installing a new version.
- **Managed service:** Not a background agent or daemon. The CLI runs when you invoke it.

## Risk Acceptance

By using this release, you accept the following residual risks:

| Risk | If it happens | Mitigation |
|---|---|---|
| CLI fails on your platform | Features don't work, setup hangs or errors | Test in staging first; report exact platform and error |
| Secrets leak through unexpected process/log surface | Undetected credential exposure | For now, use only for internal developers; test in non-production environments |
| Remote Vault behavior differs from expectations | Readiness checks pass but runtime fails | Test against your Vault staging instance; report behavior differences |
| Multi-project isolation boundary fails | Projects can see each other's secrets | Do not use for multi-tenant setups yet; validate against your policies first |

## How to Report Issues

If you encounter problems:

1. Note your **exact platform** (OS, distribution, Docker variant if applicable).
2. Include the **full error message** and context from `devvault setup --check --json`.
3. State whether your Vault is **local/dev-mode** or **remote/production**.
4. Include your **Vault version** and **configuration** (KV mount name, policy names if possible — do NOT include credentials).

Report to: _[project issue tracker]_

## What's Next

- **Future authentication and operations:** OIDC, AppRole, broader project policy isolation and additional deployment workflows.
- **Tier 2 verification:** Windows, Docker Desktop, live remote Vault, multi-project isolation (pending infrastructure and approval).

## Links

- [Phase 0 Readiness Report](./docs/phase-0-readiness-report.md) — detailed verification summary
- [MVP Decision (ADR)](./docs/artefatos/ADR-Phase0-MVP-Release-Scope.md) — formal decision, risk acceptance, sign-off
- [Architecture Documentation](./docs/architecture.md) — design overview
- [Security Model](./docs/security.md) — threat model and boundaries
- [Specification](./docs/devvault-setup/spec.md) — detailed feature specification
