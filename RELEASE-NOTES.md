# Release Notes — DevVault v0.1.0-mvp

**Release Date:** 2026-08-13
**Version:** v0.1.0-mvp (pre-1.0, limited scope)
**Status:** Tier 1 (Core Correctness) — PASS; Tier 2 (Infra-Verified) — PENDING

## What Is This Release

**DevVault CLI** for local developer setup and readiness workflows. A developer installs this CLI, runs `devvault setup`, and gets a validated, tested, evidence-backed check that their local environment is ready for secret management with HashiCorp Vault.

This release represents **Tier 1 (Core Correctness)** only: the setup logic, validation, security, and error semantics are proven correct through test evidence and mutation-sensor validation in Linux/macOS environments with local/dev-mode Vault.

**This is NOT v1.0.0.** Full Phase 0 completion and Phase 1 (authentication, project management, secret runtime) are future releases.

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
- **Secret storage:** Phase 0 is setup only. Secret storage, retrieval, runtime injection, and project management are Phase 1+ features.
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

- **Phase 1:** Human authentication (OIDC, AppRole), project management, multi-tenant policies.
- **Tier 2 verification:** Windows, Docker Desktop, live remote Vault, multi-project isolation (pending infrastructure and approval).
- **v1.0.0:** Full Phase 0 completion (Tier 1 + Tier 2) and Phase 1 release; at that point, the CLI will be suitable for production distribution.

## Links

- [Phase 0 Readiness Report](./docs/phase-0-readiness-report.md) — detailed verification summary
- [MVP Decision (ADR)](./docs/artefatos/ADR-Phase0-MVP-Release-Scope.md) — formal decision, risk acceptance, sign-off
- [Architecture Documentation](./docs/architecture.md) — design overview
- [Security Model](./docs/security.md) — threat model and boundaries
- [Specification](./docs/devvault-setup/spec.md) — detailed feature specification
