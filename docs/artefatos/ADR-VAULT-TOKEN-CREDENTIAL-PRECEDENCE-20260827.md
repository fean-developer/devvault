# ADR: VAULT_TOKEN Credential Precedence

- **Date:** 2026-08-27
- **Status:** Approved
- **Decision:** Option C - `VAULT_TOKEN` is not an implicit developer session source
- **Scope:** Human Session/Auth credential boundary
- **Related:** `.specs/features/devvault-session-auth/spec.md`, `.specs/features/devvault-session-auth/design.md`

## Context

DevVault has two conceptually different credential classes:

```text
Developer session credential
Bootstrap / administrative credential
```

The developer session is created by `devvault login` and is stored through `CredentialStore`. `VAULT_TOKEN` is used by bootstrap and lifecycle flows and may contain administrative material. These credentials must not be silently interchangeable.

The approved Session/Auth model requires `SessionResolver` to be authoritative for the developer session and requires the credential used by `secret` and `run` to be the same identity whose session was validated.

## Problem

The current composition can select `VAULT_TOKEN` before the CredentialStore session. This permits an administrative or unrelated external token to mask the human session. It can produce identity split:

```text
SessionResolver validates CredentialStore token
Vault operation uses VAULT_TOKEN
```

That split makes logout, diagnostics, expiry recovery and authorization interpretation unreliable, and creates a confused-deputy risk.

## Current Behavior

Evidence from the current source:

| Area | Current behavior | Evidence |
| --- | --- | --- |
| Vault client creation | Reads CredentialStore key `session`, then selects `process.env.VAULT_TOKEN ?? session`. | `apps/cli/src/composition-root.ts:103-113` |
| Project application creation | Uses the same `process.env.VAULT_TOKEN ?? session` precedence. | `apps/cli/src/composition-root.ts:129-141` |
| Login | Authenticates through Userpass and stores only the returned token at key `session`. | `apps/cli/src/commands/auth.ts:8-24` |
| Logout | Reads/deletes key `session` and attempts revoke; it does not remove `VAULT_TOKEN`. | `apps/cli/src/commands/auth.ts:27-40` |
| Status | Uses the generic Vault client and reports authentication from `CredentialStore` session presence, while that client may use `VAULT_TOKEN`. | `apps/cli/src/commands/status.ts:33-47` |
| Bootstrap/init | Require explicit `VAULT_TOKEN` for administrative configuration paths. | `apps/cli/src/commands/bootstrap.ts:12-15`, `apps/cli/src/commands/init.ts:13-18` |

The current behavior is therefore:

```text
VAULT_TOKEN > CredentialStore session
```

for some normal client construction paths, while login/logout model the developer session as the `session` CredentialStore entry.

## Decision Drivers

| Criterion | Weight | Decision implication |
| --- | --- | --- |
| SessionResolver determinism | Critical | One developer source must be authoritative. |
| Logout correctness | Critical | Logout must remove the credential normal developer commands use. |
| Diagnostics correctness | Critical | Reported identity must match operation identity. |
| Bootstrap isolation | Critical | Root/admin material must never become an implicit human session. |
| Security / confused-deputy prevention | Critical | Hidden credential shadowing is unacceptable. |
| Developer UX | High | Expiry must lead to login, not an unexplained credential switch. |
| Backward compatibility | High | Preserve explicit administrative flows and document normal-command change. |
| CLI simplicity | High | Avoid an implicit second human credential mode. |
| Implementation complexity | Medium | Keep the human path CredentialStore-only. |
| Future machine-auth extensibility | Medium | Leave explicit machine credential modes for a separate feature. |

## Options Considered

### Option A - `VAULT_TOKEN` Has Highest Precedence

```text
VAULT_TOKEN > CredentialStore session
```

**Advantages:** preserves current scripts and client construction. It is simple mechanically.

**Disadvantages:**

- SessionResolver can validate a different token from the one used by `secret`/`run`.
- Logout can report success while the command continues using `VAULT_TOKEN`.
- Expired human sessions can be silently bypassed.
- Diagnostics can report `NOT_AUTHENTICATED` while operations succeed as an administrative identity.
- A root token inherited from a shell or CI environment can cause privilege escalation.

**Rejected:** violates the identity-consistency invariant and approved bootstrap separation.

### Option B - CredentialStore Has Highest Precedence

```text
CredentialStore session > VAULT_TOKEN fallback
```

**Advantages:** a logged-in developer session is deterministic and logout has effect while the session exists. It retains fallback compatibility when no session is stored.

**Disadvantages:**

- After logout, normal developer commands silently authenticate with `VAULT_TOKEN`.
- A missing or expired developer session is hidden by an external/admin token.
- Diagnostics need a second credential-source model and could still report the wrong human identity.
- The environment variable remains an implicit machine-auth path in human commands.

**Rejected:** improves precedence only while a session exists but preserves the core logout and bootstrap-fallback risks.

### Option C - `VAULT_TOKEN` Is Not a Developer Session Source

```text
Normal developer session = CredentialStore only
VAULT_TOKEN = explicit administrative/infrastructure source only
```

**Advantages:**

- SessionResolver remains the sole developer-session authority.
- Logout genuinely removes the credential used by `secret` and `run`.
- Expired sessions converge to explicit login and cannot be silently bypassed.
- Diagnostics match the identity used by human operations.
- Bootstrap/root credentials remain isolated.
- Future machine authentication can define an explicit, separately reviewed source.

**Disadvantages:** existing workflows that rely on `VAULT_TOKEN` for normal `secret`, `run` or human status behavior require migration. Users must login explicitly.

**Selected.**

### Option D - Explicit Credential Mode

```text
Default: CredentialStore
Explicit alternate source: user-selected mode
```

**Advantages:** supports advanced external credentials with visible intent.

**Disadvantages:** adds a new public mode/flag and a second credential lifecycle to the MVP. It would require defining machine identity, diagnostics, logout and authorization semantics now.

**Rejected for this feature:** explicit machine credential support belongs to a future machine-auth/CI feature. No new flag is introduced by this ADR.

## Decision

Adopt **Option C**:

1. `VAULT_TOKEN` is not a developer session source for normal human commands.
2. `SessionResolver`, `SessionGuard`, `status`, `doctor`, `secret` and `run` use only the CredentialStore-backed developer session for human authentication state and protected developer operations.
3. Bootstrap, setup, lifecycle and explicitly administrative commands may use `VAULT_TOKEN` under their existing explicit contracts.
4. A missing, expired or invalid CredentialStore session never falls back to `VAULT_TOKEN`.
5. A valid CredentialStore session is never replaced or masked by `VAULT_TOKEN` in normal developer operations.
6. No explicit alternate credential flag is added in this feature.
7. Future CI, machine or external credential support requires a separate feature and explicit credential-source contract.

This is a security correction and a deliberate behavioral change for normal commands, not an implicit precedence rule.

## Detailed Semantics

### Credential Precedence

For normal human developer operations:

```text
CredentialStore developer session only
```

`VAULT_TOKEN` is ignored as a developer session source. It is not read by `SessionResolver` and is not passed to the Vault client used by `secret` or `run`.

For explicit administrative/bootstrap operations:

```text
VAULT_TOKEN according to the command's existing administrative contract
```

The administrative source must remain visibly separate from `DeveloperSession` and must not be persisted in CredentialStore.

### SessionResolver Impact

`SessionResolver` receives a `DeveloperSessionStore`/CredentialStore-backed source only. Its states mean:

- no stored session: `NOT_AUTHENTICATED`;
- remotely validated stored session: `ACTIVE`;
- proven expiry/revocation or generic invalidity: corresponding session state;
- unavailable validation: `UNKNOWN`.

`VAULT_TOKEN` cannot produce a developer `ACTIVE` state. Source metadata may identify an administrative credential only in an administrative diagnostic context; it is never a human session.

### Logout Semantics

After `devvault logout`:

```text
CredentialStore session = absent
VAULT_TOKEN = present or absent
secret/run = NOT_AUTHENTICATED
```

Logout attempts remote revoke for the stored developer token and always clears local developer session material. It does not delete, revoke or reinterpret `VAULT_TOKEN`, because that variable is outside the developer session boundary. Administrative commands may continue to use an explicitly supplied `VAULT_TOKEN` according to their own contract.

### Diagnostics Semantics

When:

```text
CredentialStore = empty
VAULT_TOKEN = valid
```

`status` and `doctor` report:

```text
Developer Session: NOT_AUTHENTICATED
```

They may independently report Vault lifecycle as `READY` using the health boundary. They must not report `Session: ACTIVE`, `Source: ENV` or a human identity based only on `VAULT_TOKEN`.

When CredentialStore contains an expired token and `VAULT_TOKEN` is valid:

```text
Vault: READY
Developer Session: EXPIRED
Recovery: devvault login --username <known user>
```

No silent fallback occurs.

### Login Semantics

After:

```text
devvault login --username alice
```

with `VAULT_TOKEN` set, normal `secret`, `run`, `status` and `doctor` use/report the CredentialStore-backed Alice session. `VAULT_TOKEN` remains available only to explicit administrative commands and is never represented as Alice's session.

### Secret / Run Semantics

`secret get`, `secret list`, `secret set`, `secret delete` and `run` must:

1. resolve Environment Context;
2. require `CONFIGURED` where applicable;
3. resolve and validate the CredentialStore developer session;
4. use the same validated developer identity for the Vault operation;
5. return login-required/invalid/expired/unknown results without using `VAULT_TOKEN` as fallback.

For `run`, no secret injection and no child process occur when the developer session is not `ACTIVE`.

### Failure Semantics

- Stored session invalid plus `VAULT_TOKEN` valid: return the stored session's invalid/expired result; do not use the environment token.
- Stored session absent plus `VAULT_TOKEN` valid: return `NOT_AUTHENTICATED` for human protected commands.
- Stored session valid plus `VAULT_TOKEN` present: use the stored session.
- Vault unavailable while validating the stored session: return `UNKNOWN` or infrastructure failure as specified; do not use `VAULT_TOKEN` to hide the failure.
- Authorization denied for a validated developer session: return `PERMISSION_DENIED`; do not retry with `VAULT_TOKEN`.

## Security Consequences

### Positive

- Eliminates credential shadowing between human and administrative identities.
- Makes logout effective for normal developer operations.
- Prevents stale-session bypass through inherited shell/CI variables.
- Preserves `AUTHENTICATED != AUTHORIZED`.
- Prevents expired/missing developer sessions from becoming root/admin operations.
- Keeps SessionResolver and operation client identity aligned.
- Keeps bootstrap material outside the human session record.

### Negative / Residual Risk

- A user who intentionally runs an explicit administrative command with `VAULT_TOKEN` can still perform administrative actions; this is an explicit credential use, not a hidden developer fallback.
- Existing shell environments may contain `VAULT_TOKEN` and users may initially expect it to work for normal commands.
- The environment variable remains sensitive and can leak through shell/process inspection; its use must remain limited and documented.

## UX Consequences

- A developer with no CredentialStore session must run `devvault login --username <username>` even when `VAULT_TOKEN` is present.
- An expired session receives login recovery rather than silent success under another identity.
- `status` and `doctor` can show Vault `READY` alongside developer session `NOT_AUTHENTICATED` or `EXPIRED`.
- Error text must explain that `VAULT_TOKEN` is reserved for explicit administrative flows only when this context is useful; it must never print the token.

## Backward Compatibility

| Surface | Impact | Classification | Treatment |
| --- | --- | --- | --- |
| `init` / bootstrap / policy administration | Continue accepting explicit `VAULT_TOKEN`. | Compatible | Preserve existing administrative contract. |
| `login` / `logout` | Continue using CredentialStore session. | Compatible | Enrich session handling later without env fallback. |
| `secret` commands with only `VAULT_TOKEN` | No longer authenticate implicitly. | Behavioral change | Require human login; document in release notes. |
| `run` with only `VAULT_TOKEN` | No longer authenticate implicitly. | Behavioral change | Require human login; no fallback. |
| `status` / `doctor` | Session reflects CredentialStore, not env-token presence. | Behavioral change/additive | Preserve lifecycle fields and add distinct session state. |
| Existing token-only CredentialStore record | Remains readable and remotely validated. | Compatible | Username/lease metadata remain optional. |
| External scripts using `VAULT_TOKEN` for normal commands | May stop working. | Breaking for that workflow | Migrate to explicit login or a future machine-auth feature. |

No evidence in the repository establishes an officially supported normal-command `VAULT_TOKEN` workflow; the current behavior is an implementation side effect documented in the baseline, not an approved human-session contract.

## Migration

1. Keep `VAULT_TOKEN` working for existing explicit administrative/bootstrap commands.
2. Change normal human command composition to use CredentialStore-only developer sessions.
3. Emit a clear non-secret error for protected human operations without a developer session.
4. Update user-facing documentation and release notes to state that `VAULT_TOKEN` is administrative-only for this feature.
5. Preserve token-only CredentialStore records and validate them remotely; do not force logout/re-login solely because metadata is absent.
6. Do not introduce a legacy mode or new credential flag in this MVP.
7. Revisit explicit machine credential support in a separate ADR/feature for CI or automation.

## Rejected Alternatives

- **Option A:** rejected because the operation identity can differ from the validated session and logout is ineffective.
- **Option B:** rejected because `VAULT_TOKEN` still silently bypasses logout and expired-session recovery.
- **Option D:** rejected because it expands the MVP with a second public credential mode and machine-auth semantics.

## Impact on Session/Auth Design

The Design remains structurally valid, but the following sections must be reconciled before Tasks:

| Design section | Required reconciliation |
| --- | --- |
| `CredentialSourceResolver` | Make the boundary explicit for admin-only `VAULT_TOKEN`; it must not be part of normal developer session resolution. |
| `SessionResolution` | Remove or constrain `EXTERNAL_ADMINISTRATIVE` from developer-session output, or model it only in an independent administrative diagnostic source. |
| `SessionResolver` | State that its only normal human source is CredentialStore and that env credentials cannot produce `ACTIVE`. |
| `Diagnostics Integration` | Report `NOT_AUTHENTICATED`/`EXPIRED` from CredentialStore independently of lifecycle health; never infer session from `VAULT_TOKEN`. |
| `Guard Ordering` | Require `SessionGuard` to use the same CredentialStore-backed identity later used by the operation client. |
| `Bootstrap Isolation` | Preserve separate admin and developer clients with no fallback edge. |
| `Command Matrix` | Add the admin-only credential-source rule for `start`, `setup`, `init` and bootstrap paths without changing session classifications. |
| `Backward Compatibility` | Mark normal `secret`/`run` env-token use as behavioral change and document migration. |
| `Open Design Decisions` | Remove `VAULT_TOKEN` precedence as an unresolved decision and retain only implementation details safe for Tasks. |

### Components Affected

- `CredentialSourceResolver` and composition-root client factories;
- `SessionResolver` and `DeveloperSessionValidator` wiring;
- `SessionGuard` and authenticated secret/runtime operation client;
- status/doctor diagnostics integration;
- login/logout integration only for source consistency;
- bootstrap/lifecycle composition boundaries.

### Flows Affected

- valid session secret operation;
- expired session secret operation;
- Vault unavailable during validation;
- logout;
- re-login after expiration;
- diagnostics with empty/expired CredentialStore and present `VAULT_TOKEN`;
- bootstrap isolation.

### Tests Affected

- source-selection and identity-consistency unit tests;
- logout with `VAULT_TOKEN` present;
- expired/missing session with valid `VAULT_TOKEN`;
- status/doctor source redaction and state separation;
- secret/run no-fallback tests;
- mutation sensor for root/admin fallback;
- explicit administrative command compatibility tests.

## Impact on Tasks

Tasks may be decomposed only after this ADR is accepted and the Design is reconciled. The implementation must not choose precedence independently.

Required task constraints:

- normal developer commands use CredentialStore-only session source;
- administrative commands retain explicit `VAULT_TOKEN` use;
- no fallback from missing/invalid session to bootstrap token;
- the same token/source validated by SessionResolver is used for the protected operation;
- diagnostics report source/state without credentials;
- migration and documentation update are included;
- no new machine credential mode is introduced.

## ADR Gate

1. **Current behavior:** `VAULT_TOKEN` precedes CredentialStore session in normal client factories. **Resolved.**
2. **Can `VAULT_TOKEN` act as developer credential?** No, not implicitly. **Resolved.**
3. **Conflict with CredentialStore?** Yes, the current precedence creates identity split. **Resolved by Option C.**
4. **Does precedence change public behavior?** Yes, normal `secret`, `run`, and session diagnostics change when only `VAULT_TOKEN` is present. **Accepted and classified as behavioral/breaking for that workflow.**
5. **Can Tasks proceed without this decision?** No. This ADR resolves the blocking decision; Tasks still require Design reconciliation before creation.

## Status

**ADR DECISION: APPROVED**

Option C is selected because it is the only evaluated option that preserves SessionResolver authority, logout correctness, diagnostics identity, bootstrap isolation and the validated-identity invariant. The compatibility impact is explicit and limited to undocumented/implicit use of `VAULT_TOKEN` in normal human commands.
