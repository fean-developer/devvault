# DevVault Session / Authentication Specification

**Feature:** `devvault-session-auth`
**Status:** Proposed - specification only
**Phase:** TLC Phase 1
**Authority:** Approved Environment Context and Architecture Decisions

## Problem Statement

A developer can authenticate with `devvault login --username <username>`, but the current local session is represented only by a stored token. When the Vault token expires or is revoked, an authenticated operation can be reported as a generic Vault failure. The developer should be directed to `devvault login` when the session is invalid, without using `devvault start` as session recovery.

The feature defines an explicit boundary between:

```text
Vault infrastructure availability
Developer authentication session
Authorization for an operation
```

The feature does not redesign authorization or Vault lifecycle management.

## Goals

- Provide an explicit human developer session model.
- Persist the session only through the approved `CredentialStore` boundary.
- Use Vault evidence, not local token presence alone, to establish validity.
- Distinguish authentication failure, authorization denial and infrastructure failure.
- Provide actionable recovery through `devvault login --username <username>`.
- Represent session state safely in `status` and `doctor`.
- Preserve Environment Context and its states unchanged.
- Keep human authentication separate from application authentication.

## Out of Scope

This feature does not specify implementation of:

- Authorization redesign, new policies, RBAC or capability management.
- AppRole, OIDC, CI/CD, GitHub Actions or service identities.
- Automatic login or password persistence.
- Root token exposure or unseal key exposure.
- Token renewal or automatic refresh.
- Vault Agent or direct application SDK authentication.
- Environment Context changes or fallback to `development`.
- A session manager with multiple simultaneously selectable users.
- A mandatory `lookup-self` request before every secret operation.
- A server-side revocation policy beyond attempting the existing revoke operation at logout.

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Human authentication method | Existing configured Userpass flow | Keeps this feature focused on session semantics and preserves the current human-auth boundary. | yes |
| Session scope | Global per Vault backend and authentication identity | Vault tokens identify a developer identity independently from project/environment selection. | yes |
| Session validation | Remote Vault evidence when proof is required; local metadata is only a hint | Token presence and local timestamps cannot prove current validity. | yes |
| Token renewal | Deferred | Explicit re-login is simpler and avoids hidden credential mutation in this feature. | yes |
| Username metadata | Allowed as non-sensitive CredentialStore metadata | Improves recovery UX without persisting a password or project credential. | pending privacy decision |
| Normal-command `VAULT_TOKEN` precedence | Requires explicit compatibility/architecture decision | Administrative material must not silently masquerade as a human session. | requires ADR |
| Numeric exit codes | Defined during Design | The Specification requires semantic results while preserving the existing CLI compatibility boundary. | pending |

The detailed unresolved decisions are listed in the final **Open Questions** section.

Open questions: none for the normative session model; the deferred compatibility and UX decisions below are explicitly bounded to Design or ADR review.

## User Stories

### AUTH-US-001: Recover an expired developer session

**As a developer**, I want an expired session to direct me to `devvault login`, so that I do not need to restart Vault infrastructure to authenticate again.

### AUTH-US-002: Distinguish authentication from authorization

**As a developer**, I want permission denial to remain distinct from session expiration, so that I can take the correct operational action.

### AUTH-US-003: Inspect session state safely

**As a developer**, I want `status` and `doctor` to report session state without credentials, so that diagnostics are useful without creating a leakage path.

### AUTH-US-004: Manage a local developer session

**As a developer**, I want login and logout to securely replace or remove my local session while preserving project and Vault lifecycle state.

## Architectural Separation

The following contexts are independent:

| Context | Answers | Owner |
| --- | --- | --- |
| Project Context | Which project is being operated? | Environment Context |
| Environment Context | Which environment is selected/configured? | Environment Context |
| Vault Lifecycle | Is the backend operational? | Vault lifecycle |
| Developer Session | Which human identity is authenticated and is it valid? | Session/Auth |
| Authorization | Is this identity allowed to perform this operation? | Authorization |

A command may compose these contexts, but one context MUST NOT be inferred from another. In particular:

```text
Vault READY + Session EXPIRED != Vault UNAVAILABLE
Session ACTIVE + Permission DENIED != Session EXPIRED
Session VALID != Authorization GRANTED
```

## Current-State Baseline

The current implementation provides Userpass login/logout and an abstract `CredentialStore`, but it has these known limitations:

- `login` persists only a token under the `session` key.
- Username and lease metadata are not persisted.
- Token presence in the store is currently used as evidence of authentication presence.
- `leaseDuration` returned by login is not retained as session metadata.
- `lookup-self` is not currently available as a session validation contract.
- Normal client composition currently considers `VAULT_TOKEN` before the stored session.
- No automatic renewal exists.

These observations describe the baseline only. They do not authorize implementation changes in this specification step.

## Session State Model

The normative session states are:

| State | Meaning | Required evidence | Recovery |
| --- | --- | --- | --- |
| `NOT_AUTHENTICATED` | No developer session is available in the CredentialStore. | No stored session token/record. | `devvault login --username <username>` |
| `ACTIVE` | Vault has accepted the session or a valid authenticated operation has established it as usable. | Successful validation or authenticated operation. | Continue operation. |
| `INVALID` | The token is rejected, but the available evidence does not prove expiration or revocation specifically. | Safe Vault authentication evidence. | Login again. |
| `EXPIRED` | Expiration is proved by lease metadata or a Vault response/lookup with sufficient evidence. | Explicit expiration evidence. | Login again. |
| `REVOKED` | Revocation is proved by Vault evidence. | Explicit revocation evidence. | Login again; do not restore the rejected token. |
| `UNKNOWN` | A token may exist, but validity cannot be determined because the validation dependency is unavailable or inconclusive. | Insufficient or unavailable evidence. | Diagnose Vault connectivity/lifecycle; do not claim expiration. |

The following rules are mandatory:

1. A token existing in the CredentialStore MUST NOT by itself produce `ACTIVE`.
2. `EXPIRED` and `REVOKED` MUST be used only when the evidence supports the distinction.
3. When expiration and revocation cannot be distinguished, the result MUST be `INVALID` or an equivalent non-specific invalid-session result.
4. Vault lifecycle states remain separate from session states. `READY`, `UNAVAILABLE`, `SEALED` and `NOT_INITIALIZED` are not session states.
5. Session metadata shown to users MUST omit the token.

## Source Of Truth And Validation

Vault is the source of truth for session validity. CredentialStore presence is local evidence of a candidate session, not proof of validity.

The eventual implementation MAY use `auth/token/lookup-self` or an equivalent backend validation operation. The contract MUST support:

- successful validation returning a non-secret session result;
- safe classification of invalid, expired or revoked tokens when Vault provides sufficient evidence;
- an `UNKNOWN` result when Vault cannot be reached or the response is inconclusive;
- no token, password, authorization header or raw response body in the returned diagnostic DTO.

Validation frequency is command-specific:

- `status` MAY perform lightweight validation.
- `doctor` MAY perform complete remote session validation and capability diagnostics.
- `secret` and `run` SHOULD prefer their authenticated operation and semantic error mapping without an unnecessary preliminary round trip.
- A separate lookup MAY be performed when required to classify an authentication error.

A local `expiresAt` hint MAY produce an early warning, but MUST NOT replace remote validation when proof of validity is required. A stale local hint MUST NOT convert an unavailable Vault into `EXPIRED`.

## CredentialStore Session Record

The session token MUST remain exclusively behind the approved `CredentialStore` abstraction. No session material may be written to project configuration, `.devvault/context.json`, setup state, logs, command arguments or temporary files.

The session record is conceptually:

```text
session token: sensitive, permitted only inside CredentialStore
username: non-sensitive identity metadata, permitted with privacy safeguards
issuedAt: non-sensitive timing metadata, permitted
expiresAt: non-sensitive timing metadata, permitted as a hint
leaseDuration: non-sensitive timing metadata, permitted
authMount: non-sensitive configuration metadata, permitted
password: prohibited
root token: prohibited
unseal key/recovery key: prohibited
SecretID: prohibited
```

Metadata MUST NOT be treated as proof of validity. The username MAY be persisted to improve recovery UX. The password MUST never be persisted. The record format and key layout belong to Design; this specification does not prescribe a serialization format.

## Session Scope And Identity

A developer session is global to its Vault backend and authentication identity, not project-scoped or environment-scoped. Environment selection changes the target configuration and path; it does not automatically invalidate the session or guarantee access.

For multiple users, a successful `login alice` followed by a successful `login bob` MUST replace the active local developer session only after Bob's authentication succeeds. The MVP does not require simultaneous named sessions or session switching. A failed login MUST preserve the previously usable session unless the backend explicitly proves it is invalid.

A new login MUST never store a root/bootstrap token as a developer session.

## Login

`devvault login --username <username>` is the canonical human recovery flow.

On success, the system MUST:

1. authenticate the username and password against the configured human authentication method;
2. distinguish authentication failure from Vault unavailable and Vault sealed/not-ready when determinable;
3. validate that the response contains usable session material;
4. persist the new session only through CredentialStore;
5. persist approved non-sensitive identity/lease metadata if supported;
6. replace an old session only after the new authentication succeeds;
7. retain no password or bootstrap credential;
8. print identity metadata only as appropriate, never the token;
9. avoid starting or reconfiguring Vault when Vault is already operational.

On failure, the system MUST leave no password or partial token record behind and MUST NOT include sensitive request or response data in the error.

A login failure caused by Vault unavailability MUST not be presented as invalid credentials. A sealed or not-ready Vault MUST be reported as an infrastructure/lifecycle condition, not as an expired session.

## Expired And Invalid Session UX

When Vault is operational and the session is proven expired, the user-facing result MUST communicate expiration and provide:

```text
Session for <username> expired.
Run:
  devvault login --username <username>
```

When the username is unavailable:

```text
Your DevVault session expired.
Run:
  devvault login --username <username>
```

For `INVALID` or `REVOKED`, the message MUST direct the developer to login again without claiming a more precise cause than the evidence supports. Session recovery MUST NOT require `devvault start` when Vault is already ready.

When the Vault is unavailable or sealed, the message MUST direct the developer to infrastructure/lifecycle recovery and MUST NOT request login as a substitute.

## Command And Session Matrix

| Command | Classification | Session behavior | Environment behavior |
| --- | --- | --- | --- |
| `start` | `session-independent` | Does not require or repair a developer session. | Global lifecycle; project-aware work consumes confirmed context only. |
| `setup` | `session-independent` | Does not require a developer session. | Does not change Environment Context semantics. |
| `environment set` | `session-independent` | Does not require or inspect a session. | Selects an environment without Vault access or fallback. |
| `environment current` | `session-independent` | Does not require a session. | Reports `NOT_SELECTED`, `SELECTED`, `CONFIGURED` or `INVALID`. |
| `environment list` | `session-independent` | Does not require a session. | Lists local environment configuration/state. |
| `init-project` | `session-independent` | Does not require a developer session. | Creates project configuration for the resolved environment only. |
| `login` | `session-independent` | Creates or replaces the human session. | Must not introduce environment fallback. |
| `logout` | `session-independent` | Removes the local session; remote revoke is best effort. | Preserves Environment Context and project configuration. |
| `status` | `session-observing` | Reports session state when validation is possible. | Continues to report environment/lifecycle independently. |
| `doctor` | `session-observing` | May validate session and report `UNKNOWN` when validation is unavailable. | Reports environment and lifecycle separately. |
| `secret get` | `session-required` | Requires a usable session and authorization. | Requires resolved `CONFIGURED` environment. |
| `secret list` | `session-required` | Requires a usable session and authorization. | Requires resolved `CONFIGURED` environment. |
| `secret set` | `session-required` | Requires a usable session and authorization. | Requires resolved `CONFIGURED` environment and protected rules. |
| `secret delete` | `session-required` | Requires a usable session and authorization. | Requires resolved `CONFIGURED` environment and destructive confirmation. |
| `run` | `session-required` | Requires a usable session and authorization for all mappings. | Requires resolved `CONFIGURED` environment. |

`session-independent` means the command does not require a valid developer session. It does not authorize the command to use a developer token for unrelated operations. `session-observing` commands MUST not turn a diagnostic failure into an implicit login or infrastructure mutation.

## Logout

`devvault logout` MUST:

- attempt to revoke the current developer session when one exists;
- remove the local session regardless of remote revoke success;
- remove or invalidate associated local metadata;
- preserve Vault infrastructure;
- preserve Environment Context and `.devvault/context.json`;
- preserve project configuration;
- preserve bootstrap/lifecycle material;
- cause a later session-required operation to report `NOT_AUTHENTICATED`.

A remote revoke failure MAY be reported as a warning after local cleanup. Logout MUST NOT expose the token or raw Vault response.

## Failure Semantics

Classification MUST consider the endpoint, safe response semantics, Vault lifecycle evidence and authorization evidence. HTTP status alone is insufficient where the backend does not provide enough context.

| Vault condition | Session condition | Authorization condition | Expected result |
| --- | --- | --- | --- |
| `READY` | `ACTIVE` | `ALLOWED` | Operation proceeds. |
| `READY` | `EXPIRED` | Not applicable | Session-expired result and login instruction. |
| `READY` | `INVALID` or `REVOKED` | Not applicable | Invalid-session result and login instruction. |
| `READY` | `NOT_AUTHENTICATED` | Not applicable | Login-required result and login instruction. |
| `READY` | `ACTIVE` | `DENIED` | Permission-denied result; session remains active. |
| `READY` | `ACTIVE` | `UNKNOWN` | Authorization-unknown result; do not request login solely for this. |
| `UNAVAILABLE` | `UNKNOWN` | Not applicable | Vault-unavailable result and infrastructure recovery. |
| `SEALED` | `UNKNOWN` | Not applicable | Vault-sealed/not-ready result and lifecycle recovery. |
| `NOT_INITIALIZED` | `UNKNOWN` | Not applicable | Vault-not-initialized result and lifecycle/setup recovery. |
| `READY` | `UNKNOWN` | Not applicable | Validation-unknown result; do not claim expiration. |

HTTP semantics:

- `401` MAY indicate invalid authentication, but the implementation MUST use safe body/endpoint evidence before choosing `INVALID`, `EXPIRED` or `REVOKED`.
- `403` MUST NOT automatically mean expired. It may mean valid session with insufficient capability and MUST be mapped to permission denied when authorization evidence supports that conclusion.
- `503` MUST NOT automatically mean expired. Health response and lifecycle evidence determine whether the result is sealed, unavailable, standby/not-ready or another infrastructure condition.
- Transport failure MUST be represented as Vault-unavailable or validation-unknown according to the operation, never as proven expiration.
- A secret operation returning permission denied after successful session validation MUST preserve the session as `ACTIVE`.

## Authorization Boundary

This feature consumes authorization results but does not define policies or redesign capability evaluation.

The following distinction is normative:

```text
lookup-self succeeds
secret read returns 403
=> Session ACTIVE, operation PERMISSION_DENIED
```

The system MUST NOT request a new login, invoke `start`, or invoke `init-project` solely because an authenticated operation is denied. Authorization integration belongs to a later feature.

## Environment Context Integration

Session/Auth MUST consume the existing Environment Context resolver when a protected operation needs project/environment configuration. It MUST preserve these states exactly:

```text
NOT_SELECTED
SELECTED
CONFIGURED
INVALID
```

Rules:

- A session MUST NOT create or select an environment.
- Session validity MUST NOT depend on an environment being selected unless the operation itself requires environment configuration.
- A selected-but-unconfigured environment MUST fail with the existing environment remediation, before protected Vault access.
- An invalid environment MUST not be treated as configured.
- `--environment` remains a temporary, non-persistent override.
- No session feature may silently fall back to `development`.

Changing environments keeps the candidate session but causes the next protected operation to evaluate authorization for the new project/environment.

## `VAULT_TOKEN` Compatibility Boundary

The current behavior gives `VAULT_TOKEN` precedence when constructing some Vault clients. This is a known compatibility and security risk because administrative material can mask the human developer identity.

This specification requires:

- `VAULT_TOKEN` MUST never be persisted as a developer session.
- Bootstrap and explicitly administrative lifecycle operations MAY use `VAULT_TOKEN` according to their existing contract.
- Normal human secret/runtime operations MUST NOT silently present `VAULT_TOKEN` as the developer session.
- Diagnostics MUST distinguish administrative/external credentials from a CredentialStore-backed developer session when such a distinction is observable.
- Removing or changing current precedence requires an explicit compatibility decision and ADR before implementation.

**Status:** REQUIRES ADR before implementation if the change affects existing normal-command compatibility. No precedence change is authorized by this Specification-only step.

## Security Requirements

| ID | Requirement |
| --- | --- |
| AUTH-SEC-001 | The session token MUST never appear in logs, stdout, stderr, JSON diagnostics, exceptions, command arguments, project files or temporary files. |
| AUTH-SEC-002 | The password MUST never be persisted, logged, returned in an exception or included in diagnostics. |
| AUTH-SEC-003 | Authentication headers and raw Vault response bodies MUST be sanitized before logging or error propagation. |
| AUTH-SEC-004 | Session metadata exposed to users MUST exclude token, password, SecretID, root token and unseal/recovery keys. |
| AUTH-SEC-005 | Expired/invalid sessions MUST not silently fall back to bootstrap or root identity. |
| AUTH-SEC-006 | Normal developer operations MUST not use bootstrap root credentials as the developer session. |
| AUTH-SEC-007 | Logout MUST remove the local token and session metadata even when remote revocation fails. |
| AUTH-SEC-008 | Login MUST replace an existing session only after successful authentication and safe persistence. |
| AUTH-SEC-009 | `context.json`, environment configuration and project files MUST remain free of session credentials. |
| AUTH-SEC-010 | CredentialStore access MUST remain behind an abstraction and platform-specific storage MUST remain outside Core. |
| AUTH-SEC-011 | A session validation failure caused by Vault unavailability MUST not be recorded or displayed as expiration. |
| AUTH-SEC-012 | Developer authentication MUST remain separate from application authentication. |

## Requirement Traceability

| ID | Requirement | Problem | Expected behavior | Security relevance | Future test category |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | Session states are explicit and independent from lifecycle/authorization. | Ambiguous failures. | Return the correct state/result. | Prevents incorrect recovery and privilege assumptions. | Unit/state model |
| AUTH-002 | CredentialStore presence is not validity proof. | Expired tokens look usable. | Validate with Vault evidence when required. | Prevents stale-token use. | Mutation/discrimination |
| AUTH-003 | Vault validation supports `ACTIVE`, invalid, expired/revoked when proven, and `UNKNOWN`. | No session validation contract. | Map evidence without false certainty. | Preserves availability/auth boundaries. | Vault adapter integration |
| AUTH-004 | Login authenticates through the configured human method. | Login is the recovery path. | Successful login creates a usable session. | Keeps human auth explicit. | Integration/E2E |
| AUTH-005 | Login persists only approved session data through CredentialStore. | Session data lacks policy. | Token stays behind the store; password is absent. | Prevents project/file leakage. | Security |
| AUTH-006 | Login failures distinguish auth, Vault unavailable and sealed/not-ready when determinable. | Generic errors mislead users. | Return domain-specific recovery. | Avoids unsafe recovery actions. | Error mapping |
| AUTH-007 | Successful login replaces the prior session atomically from the user's perspective. | Failed re-login could destroy a good session. | Preserve old session until new login succeeds. | Limits lockout and partial state. | Unit/integration |
| AUTH-008 | Expired/invalid/revoked sessions direct the user to login. | Users use `start` for session recovery. | Show username when safely known and login command. | Keeps recovery domain-specific. | CLI/E2E |
| AUTH-009 | `403` is not automatically session expiration. | Authorization and auth are conflated. | Preserve active session on permission denial. | Prevents needless credential churn. | Discrimination |
| AUTH-010 | `503` and transport failure are not automatically expiration. | Infrastructure errors are misclassified. | Use lifecycle/unknown result. | Prevents false security conclusions. | Error mapping |
| AUTH-011 | Session scope is global per Vault backend/identity. | Environment changes may force unnecessary login. | Keep session while re-evaluating authorization. | Separates identity from capability. | Multi-environment integration |
| AUTH-012 | Logout clears local state and preserves unrelated project/lifecycle state. | Stale credentials remain locally. | Later protected command reports `NOT_AUTHENTICATED`. | Reduces credential persistence. | E2E/security |
| AUTH-013 | Session-observing diagnostics expose safe session state. | Status only reports token presence. | Show state/identity without credentials. | Prevents diagnostic leakage. | CLI JSON/security |
| AUTH-014 | Session-required commands validate/use a session before secret/runtime operation. | Operations may bypass session validation. | No authenticated operation proceeds without a usable session. | Enforces auth boundary. | Mutation/E2E |
| AUTH-015 | Environment Context remains unchanged and is resolved independently. | Auth could introduce fallback. | Preserve four environment states and precedence. | Prevents cross-environment access. | Regression |
| AUTH-016 | `VAULT_TOKEN` is never a persisted developer identity and its compatibility boundary is explicit. | Admin token can mask human session. | Keep bootstrap/admin use distinct; ADR for precedence change. | Limits blast radius. | Composition/security |
| AUTH-017 | Human authentication remains separate from application authentication. | Credential models can be conflated. | AppRole/OIDC remain out of scope. | Prevents identity misuse. | Architecture compliance |
| AUTH-018 | No renewal is required for this feature. | Renewal adds lifecycle complexity. | Expiration leads to explicit login recovery. | Avoids hidden credential mutation. | Scope validation |

## Acceptance Criteria

The following criteria are executable in future implementation validation:

1. With no session in CredentialStore, a session-required command returns `NOT_AUTHENTICATED`, does not call the secret/runtime operation, and prints a login instruction.
2. With a stored token whose Vault validation succeeds, a protected secret operation proceeds and diagnostics represent the session as `ACTIVE` without printing the token.
3. With Vault evidence proving expiration, a protected command returns `EXPIRED`, names the known username only when available, and instructs `devvault login --username <username>` without invoking `start`.
4. With an invalid token where expiration/revocation cannot be distinguished, the command returns `INVALID`, not `EXPIRED` and not `VAULT_UNAVAILABLE`.
5. With a valid session and a secret read returning authorization denial, the result is permission denied, the session remains `ACTIVE`, and no login instruction is emitted solely for the denial.
6. With Vault unavailable during validation, the result is Vault unavailable or `UNKNOWN` according to the operation, never proven `EXPIRED`.
7. With Vault sealed or not initialized, the result identifies lifecycle recovery and does not request login as the infrastructure fix.
8. A successful login persists the new token only via CredentialStore, optionally persists approved metadata, and never persists the password or project credentials.
9. A failed login does not overwrite a previously usable session and does not leave a partial new session record.
10. Logout clears the local token and metadata even when remote revocation fails, while preserving Environment Context and project configuration.
11. `status --json` and `doctor --json` report Vault lifecycle and session state as separate fields and contain no token, password, header or raw Vault body.
12. A valid session permits `secret get`, `secret list`, `secret set`, `secret delete` and `run` only after the existing Environment Context resolver returns `CONFIGURED` and authorization permits the operation.
13. An expired or invalid session blocks `secret` and `run` before secret injection or child-process execution.
14. Changing the active environment does not automatically delete or invalidate a valid session; the next protected operation evaluates authorization for the selected environment.
15. A mutation that treats token presence as `ACTIVE` is detected by tests.
16. Mutations that map `403` or `503` directly to expiration are detected by tests.
17. A mutation that falls back to a bootstrap/root token after session invalidation is detected by tests.
18. A mutation that leaves the token after logout is detected by tests.

## Future Test Categories

Implementation MUST include evidence across these categories before the feature gate:

- Session state and evidence mapping unit tests.
- CredentialStore metadata and replacement tests.
- Vault response/error mapping tests for `401`, `403`, `503`, sealed, unavailable and transport failure.
- Login/logout CLI tests, including failed re-login preservation.
- Status/doctor human and JSON redaction tests.
- Secret and runtime tests proving session-required gating and no secret injection after failure.
- Multi-environment tests proving session retention but authorization re-evaluation.
- Mutation tests for token presence, status shortcuts, root fallback, diagnostics leakage and logout cleanup.
- Integration tests against a real or explicitly provisioned Vault backend where available.

## Open Questions

### OQ-AUTH-001: Normal-command `VAULT_TOKEN` precedence

- **Question:** Should normal human secret/runtime commands reject or ignore `VAULT_TOKEN` when a CredentialStore session exists, or retain compatibility behind an explicit administrative mode?
- **Options:** preserve current precedence; prefer CredentialStore session; require an explicit admin flag/mode; reject mixed credentials.
- **Recommendation:** Prefer CredentialStore-backed human session for normal developer operations and reserve `VAULT_TOKEN` for explicit administrative/bootstrap commands.
- **Impact:** Requires compatibility review and an ADR before implementation if existing command behavior changes. This Specification does not change the current behavior.

### OQ-AUTH-002: Username metadata privacy policy

- **Question:** Should the last successful username be persisted to improve expired-session recovery UX?
- **Options:** do not persist; persist as non-sensitive metadata in CredentialStore; persist only after explicit user consent.
- **Recommendation:** Persist username as non-sensitive metadata in the approved CredentialStore, never in project files, with a clear local-privacy note in user documentation.
- **Impact:** Affects CredentialStore record shape and diagnostics, but not authentication validity. Design must define exact storage and redaction behavior.

### OQ-AUTH-003: Public exit-code contract

- **Question:** Which stable numeric exit codes should represent login required, invalid session, permission denied and Vault lifecycle failures?
- **Options:** reuse existing generic codes; define a new stable domain-code table; defer numeric stability until CLI compatibility review.
- **Recommendation:** Define a stable table during Design before implementation; this Specification requires semantic distinctions but does not reserve numeric values.
- **Impact:** Affects automation and backward compatibility, not the domain state model.

## Validation

This artifact is Specification-only. Design, Tasks and implementation are intentionally absent for this feature.

Required validator target:

```text
validate_spec.py spec.md -> 0 errors, 0 warnings
```

No production code, Environment Context Specification, Environment Context Design, Environment Context Tasks or Session/Auth Design/Tasks are changed by this feature step.
