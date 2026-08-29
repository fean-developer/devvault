# DevVault Authorization Integration Specification

**Feature:** `devvault-authorization-integration`
**Status:** Proposed - specification only
**Phase:** TLC Phase 1
**Authority:** Architecture Invariants, verified Environment Context, and verified Session/Auth

## Problem Statement

An ACTIVE developer session identifies an authenticated developer but does not establish whether that developer can read, list, write, or delete a specific Vault resource in a resolved project environment. DevVault SHALL classify permission denial independently from session and lifecycle failures, while retaining HashiCorp Vault as the policy enforcement authority.

The canonical protected-operation boundary is:

```text
Environment Context
    -> SessionResolver
    -> SessionGuard
    -> ValidatedDeveloperSession
    -> Authorization
    -> protected operation
```

Authorization integration MUST NOT redesign Environment Context, SessionResolver, SessionGuard, ValidatedDeveloperSession, DeveloperSessionStore, `VAULT_TOKEN` precedence, AdministrativeCredentialProvider, or lifecycle/bootstrap/start behavior.

## Goals

- Define authorization as a decision about an authenticated developer, operation, and resolved Vault resource.
- Keep Vault policy enforcement as the final authorization authority.
- Define distinct semantic handling for authorization denial, session failure, and Vault unavailability.
- Protect secret operations and runtime secret injection without creating a local shadow RBAC model.
- Preserve environment isolation, protected-environment consent, and existing verified command behavior.
- Define safe, testable diagnostics, failure atomicity, and future discrimination expectations.

## Out of Scope

This feature does not specify implementation of:

- Vault policy creation, update, deletion, synchronization, or policy editing.
- A local RBAC database, role mapping, ACL table, group management, or centralized policy service.
- OIDC authorization mapping, AppRole authorization, CI/CD machine authorization, or authorization UI.
- Authorization caching, persisted capabilities, policy documents, or allow/deny records.
- A mandatory `sys/capabilities-self` preflight or broad capability probing in `status` or `doctor`.
- Changes to human authentication, CredentialStore, `VAULT_TOKEN` precedence, administrative credentials, lifecycle, bootstrap, or Environment Context.
- Authorization for `start`, `login`, `logout`, environment selection, `init-project`, `status`, or `doctor`.

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Authorization source of truth | Vault policies enforced by the actual Vault operation | Avoids semantic drift and duplicate local RBAC. | yes |
| MVP enforcement model | Actual-operation server enforcement with semantic error mapping | A separate preflight adds a call, path complexity, and TOCTOU risk without replacing server enforcement. | yes |
| Authorization cache | None | Cached decisions can become stale when policy, token, or backend state changes. | yes |
| Authorization input | `ValidatedDeveloperSession` only | Ensures the authorized identity is exactly the authenticated developer identity. | yes |
| Policy administration | Deferred | Runtime consumption of existing policies is separate from policy lifecycle management. | yes |

Open questions: none.

## User Stories

### AUTHZ-US-001: Receive an actionable permission result

**As an authenticated developer**, I want a denied secret operation to report permission denial rather than a session error, so that I can request the appropriate Vault policy.

### AUTHZ-US-002: Preserve environment isolation

**As a developer**, I want authorization evaluated against the actual selected or one-shot overridden environment, so that development access does not silently reach production.

### AUTHZ-US-003: Avoid partial runtime execution

**As a developer**, I want `devvault run` to fail before process launch when any required secret is denied, so that an application never starts with a partial secret set.

## Existing Verified Boundaries

| Boundary | Normative relationship to Authorization |
| --- | --- |
| Environment Context | Resolves the configured target environment and keeps `--environment` one-shot and non-persistent. Authorization consumes that result and MUST NOT select, mutate, or fall back between environments. |
| Session/Auth | SessionResolver and SessionGuard establish `ValidatedDeveloperSession`. Authorization MUST NOT resolve credentials or reinterpret session state. |
| Administrative credentials | AdministrativeCredentialProvider remains isolated for explicit administrative/lifecycle work. It MUST NOT be a fallback for denied human operations. |
| Vault lifecycle | Lifecycle owns unavailable, sealed, uninitialized, and ready state. Authorization MUST NOT start, initialize, unseal, or repair Vault. |
| Consent | Protected-environment confirmation is a separate user-intent gate and MUST NOT grant permission. |

## Terminology

| Term | Meaning |
| --- | --- |
| Authenticated developer | The identity represented by a `ValidatedDeveloperSession`. |
| Authorization | The determination whether that authenticated developer may perform a specific operation on a specific resolved Vault resource. |
| Resource context | Immutable operation context containing developer identity, project, environment, logical secret path, canonical Vault path, and operation. |
| Final enforcement | Vault's response to the actual requested operation under the developer credential. |
| Protected mutation | `secret set` or `secret delete` in an environment requiring existing consent. |

## Authorization Model

Authentication answers **who** the developer is. Authorization answers whether that authenticated developer may perform an operation on the resolved resource. An ACTIVE or otherwise validated developer session SHALL NOT imply authorization.

Authorization SHALL receive a `ValidatedDeveloperSession` after SessionResolver and SessionGuard. The identity used for authorization SHALL equal the identity in that validated session. Authorization SHALL NOT read CredentialStore, `VAULT_TOKEN`, root tokens, bootstrap credentials, or AdministrativeCredentialProvider, and SHALL NOT independently authenticate or resolve a developer credential.

The MVP SHALL use server-enforced authorization during the actual Vault operation. Mandatory capability preflight (for example `sys/capabilities-self`) is NOT part of the MVP; DevVault SHALL NOT require it before any secret or `run` operation. A future, separately approved feature MAY add an optional, explicit permission-preview/check command using capability introspection, but such a feature SHALL NOT replace final server enforcement, SHALL NOT be cached as an allow decision, and SHALL NOT authorize a different resource context. No such feature is designed or authorized by this specification.

## Source of Truth and Policy Enforcement

Vault policies are the authorization source of truth. DevVault SHALL consume existing Vault policy enforcement and SHALL NOT introduce a local permission database, username-to-role mapping, role-to-environment mapping, path ACL table, or local policy evaluator.

The actual Vault response remains authoritative because policy, token, lease, and backend state can change after any local check. A successful operation is sufficient authorization evidence for that operation context; an explicit HTTP `403` while the developer identity remains authenticated SHALL produce `DENIED`.

## Resource and Operation Model

Authorization applies to the actual resolved project, environment, logical secret path, canonical Vault path, and operation. A conceptual project resource is:

```text
projects/<project>/<environment>/...
```

Authorization SHALL use the same canonical Vault path and operation as the subsequent actual operation. It SHALL NOT authorize only a project name where the operation accesses a more granular path, and it SHALL NOT authorize path A then operate on path B.

Vault KV v2 paths are distinct resources for authorization purposes. The eventual design SHALL map each operation to the canonical KV v2 endpoint/path that it calls; it SHALL NOT treat KV v2 as KV v1. At minimum, secret values use `data/<path>` and listing uses `metadata/<path>`. Version-specific deletion behavior MUST be mapped to its actual KV v2 endpoint before implementation.

| DevVault operation | Required Vault authorization meaning |
| --- | --- |
| `secret get` | Read the resolved secret data resource. |
| `secret list` | List the resolved secret metadata resource; read permission SHALL NOT imply list permission. |
| `secret set` | Create and/or update the resolved secret data resource according to the actual KV v2 request. |
| `secret delete` | Delete the resolved secret version or metadata resource according to the actual KV v2 deletion request. |
| `run` | Read every resolved secret data resource required for runtime injection. |

## Environment Isolation and Consent

Authorization SHALL evaluate the environment resolved for the current invocation, including a one-shot `--environment <name>` override. It SHALL NOT use a stale active context, mutate active context, fall back to `development`, or infer production permission from development permission. A policy MAY explicitly grant multiple environments, but an allow for one environment SHALL NOT imply another.

For a protected mutation, the normative order is:

```text
Environment validation -> Session validation -> canonical resource resolution -> protected-environment consent -> Vault mutation (Vault authorization enforcement occurs during this call)
```

Under the server-enforced MVP model, Vault authorization for a mutation is known only when the mutation is attempted; DevVault SHALL NOT perform a mandatory preflight to learn the decision earlier. Consent is not authorization, is not evidence of authorization, and is not privilege elevation. An authenticated developer MAY have an ACTIVE session, confirm a protected mutation, and then receive Vault `403`; this is valid MVP behavior. Consent SHALL NOT be treated as satisfying or overriding a subsequent Vault denial. Consent, confirmation, and the operation SHALL use the same immutable resource context. DevVault SHALL NOT attempt the Vault mutation before required consent succeeds; once consent succeeds, Vault's response to the actual mutation remains the sole authorization outcome for that operation.

## Secret Operation Semantics

`secret get`, `secret list`, `secret set`, and `secret delete` require a configured environment and a valid session before the associated actual Vault operation. `secret set` and `secret delete` additionally require existing protected-environment consent before the Vault mutation is attempted; Vault enforces authorization during that mutation, not before it. DevVault SHALL not retry a denied operation with `VAULT_TOKEN`, a root token, a bootstrap credential, or an administrative credential.

An authorization denial SHALL have zero mutation of DeveloperSessionStore and Environment Context. It SHALL NOT log the developer out, overwrite or remove session state, classify the session as expired, change environments, invoke lifecycle recovery, or perform a stronger-credential retry.

## Run Semantics

`devvault run -- <command>` SHALL authorize retrieval of every secret/path required by the resolved runtime mappings. If any required retrieval is denied, unknown, invalid, or unavailable, DevVault SHALL inject no partial secret set and SHALL spawn no child process. It SHALL NOT silently omit denied secrets.

## Error Semantics

Authorization results are conceptual operation outcomes: `AUTHORIZED`, `DENIED`, and `UNKNOWN`. They are not global developer state.

| Evidence | Required classification | Required behavior |
| --- | --- | --- |
| Actual Vault operation succeeds | `AUTHORIZED` | Complete the operation. |
| Vault returns `403` while identity is otherwise authenticated | `DENIED` | Return a permission-denied category; preserve session and environment. |
| Vault returns `401` | Session/Auth semantics | Delegate to the approved session/authentication mapping; do not call it authorization denial. |
| Vault is unavailable, sealed, not initialized, interrupted, or returns `503` | `UNKNOWN` / lifecycle semantics | Preserve infrastructure classification; never call it denial. |

JSON output for an authorization denial SHALL expose the stable semantic category `AUTHORIZATION_DENIED`. It SHALL NOT conflate this with `AUTHENTICATION_REQUIRED`, `SESSION_EXPIRED`, or `VAULT_UNAVAILABLE`. Numeric exit-code assignment remains a Design compatibility decision.

## Diagnostics and Observability

Authorization errors and safe logs MAY identify the requested operation, project, environment, configured logical path, canonical path when already user-configured, and HTTP classification. They SHALL NOT expose a secret value, token, password, Authorization header, raw Vault authentication response, root/bootstrap credential, unseal/recovery key, or unrelated hidden path.

User-facing denial guidance SHALL state that the session is valid but the Vault policy does not permit the requested action, and direct the developer to a Vault/project administrator. It SHALL NOT diagnose `403` as expiry, instruct `devvault start` for a denial, or auto-escalate credentials. `status` and `doctor` SHALL NOT claim global authorization health without an explicit operation and resource evaluation.

## Persistence, Caching, and Concurrency

Authorization decisions, capability lists, policy documents, and allow/deny results SHALL NOT be persisted in project files, CredentialStore, setup state, temporary files, logs, JSON output, or exceptions. The MVP SHALL not cache or reuse authorization decisions across operations.

Each operation SHALL hold immutable authorization context for its execution. No global mutable authorization state or session lock is required by this specification.

## Compatibility

Authorization integration SHALL preserve existing behavior for `devvault start`, `devvault login`, `devvault logout`, `devvault environment ...`, `devvault init-project`, `devvault status`, and `devvault doctor`; these commands SHALL NOT require Vault secret authorization. Existing Session/Auth, Environment Context, administrative credential, lifecycle, and bootstrap boundaries remain unchanged.

## Security Requirements

| ID | Requirement |
| --- | --- |
| AUTHZ-001 | Authentication and authorization SHALL remain separate; a validated session SHALL NOT imply permission. |
| AUTHZ-002 | Authorization SHALL consume `ValidatedDeveloperSession`, and its identity SHALL equal the identity used for the decision. |
| AUTHZ-003 | Authorization SHALL NOT resolve alternate developer credentials or read CredentialStore, `VAULT_TOKEN`, root, bootstrap, or administrative credentials. |
| AUTHZ-004 | Vault policy enforcement during the actual operation SHALL remain final authorization authority. |
| AUTHZ-005 | DevVault SHALL NOT implement local shadow RBAC, a policy database, or persisted authorization metadata. |
| AUTHZ-006 | Authorization SHALL use the resolved project, environment, operation, and canonical Vault resource path. |
| AUTHZ-007 | Authorization for one environment SHALL NOT imply authorization for another unless Vault policy explicitly grants both. |
| AUTHZ-008 | Vault `403` for an authenticated developer SHALL produce authorization denial, not session expiry. |
| AUTHZ-009 | Vault `401` SHALL use approved Session/Auth semantics, not authorization-denial semantics. |
| AUTHZ-010 | Vault `503`, unavailable, sealed, uninitialized, and interrupted states SHALL remain infrastructure/lifecycle semantics, not denial. |
| AUTHZ-011 | A denied human operation SHALL NOT retry or fall back to `VAULT_TOKEN`, root, bootstrap, or administrative credentials. |
| AUTHZ-012 | `secret get`, `secret list`, `secret set`, and `secret delete` SHALL require authorization for their actual KV v2 resources. |
| AUTHZ-013 | List authorization SHALL be independent from read authorization and SHALL use the actual KV v2 metadata resource. |
| AUTHZ-014 | Protected-environment consent SHALL remain distinct from authorization, SHALL be obtained before any Vault mutation request is attempted, and SHALL NOT be treated as satisfying or overriding Vault's authorization decision on that mutation. |
| AUTHZ-015 | A denial SHALL NOT mutate DeveloperSessionStore, session classification, or Environment Context. |
| AUTHZ-016 | Authorization, consent, and operation contexts SHALL use the same immutable developer, project, environment, path, and operation values. |
| AUTHZ-017 | A denied mutation SHALL have zero Vault mutation side effects. |
| AUTHZ-018 | A denied or unavailable runtime secret retrieval SHALL inject no partial secrets and SHALL spawn no child process. |
| AUTHZ-019 | Authorization diagnostics and observability SHALL not leak credentials, headers, raw Vault responses, secret values, or unrelated paths. |
| AUTHZ-020 | Authorization decisions SHALL not be cached or persisted unless a future approved specification changes this rule. |
| AUTHZ-021 | Policy lifecycle management and non-human authorization providers SHALL remain out of scope. |

## Failure Atomicity

When a session is invalid or consent is declined/cancelled, DevVault SHALL send zero Vault mutation request for `secret set` and `secret delete`. When consent succeeds and the subsequent Vault mutation returns `403`, `503`, or is otherwise unavailable, the mutation SHALL have no successful side effect, but DevVault MAY have sent one attempted Vault request; that attempted request SHALL trigger no alternate-credential retry, no administrative fallback, no environment fallback, and no session mutation. When any required runtime secret is not successfully retrievable, `run` SHALL have no environment injection or child-process side effect.

## Acceptance Criteria

1. When an ACTIVE developer session performs `secret get` on an allowed resolved KV v2 data path, DevVault SHALL return the operation result using Vault's actual-operation enforcement.
2. When an authenticated developer receives Vault `403` for `secret get`, DevVault SHALL return `AUTHORIZATION_DENIED`, preserve the session and environment, and SHALL not emit an expiry/login recovery result.
3. When Vault returns `401` during a protected operation, DevVault SHALL delegate classification to Session/Auth and SHALL not return `AUTHORIZATION_DENIED` solely from that response.
4. When Vault is unavailable, sealed, uninitialized, interrupted, or returns `503`, DevVault SHALL preserve infrastructure/lifecycle semantics and SHALL not classify the result as authorization denial.
5. When an authenticated developer has read permission but lacks list permission, `secret list` SHALL be independently denied according to the KV v2 metadata operation.
6. When `secret set` or `secret delete` receives Vault `403` after consent was already granted, DevVault SHALL perform no successful mutation and no stronger-credential retry; an authenticated developer MAY have already confirmed the protected-environment prompt before this denial.
7. When a protected mutation is requested, DevVault SHALL request existing protected-environment consent before attempting the Vault mutation, SHALL not treat a granted consent as permission, and SHALL not attempt the Vault mutation before consent succeeds.
8. When an invocation uses `--environment <name>`, DevVault SHALL authorize the resolved override's project/environment/path and SHALL not mutate the active environment.
9. When a developer is allowed in development but denied in production, DevVault SHALL deny the production operation unless Vault policy explicitly grants the production resource.
10. When a denied human operation occurs, DevVault SHALL not retry with `VAULT_TOKEN`, root, bootstrap, or administrative credentials.
11. When any secret required by `run` is denied, invalid, unknown, or unavailable, DevVault SHALL inject no partial secret set and SHALL spawn no child process.
12. When authorization evaluates an operation, DevVault SHALL use identical developer identity, project, environment, canonical path, and operation context for authorization and execution.
13. When authorization returns `DENIED`, DevVault SHALL not delete, overwrite, or reclassify the developer session and SHALL not mutate Environment Context.
14. When a denial is reported in human or JSON output, DevVault SHALL expose `AUTHORIZATION_DENIED` without a secret value, credential, Authorization header, raw Vault response, or unrelated hidden path.
15. When `status` or `doctor` runs without an explicit resource operation, DevVault SHALL not report a global authorization-granted result.
16. When authorization implementation is complete, tests SHALL detect mutations that map `403` to session expiry, map `503` to denial, or bypass the authorization boundary for a protected operation.

## Mutation / Discrimination Requirements

Future implementation verification SHALL kill mutations that:

- map `403` to session expiry or login required;
- map `503` or Vault unavailability to authorization denial;
- retry a denied human operation with `VAULT_TOKEN`, root, bootstrap, or administrative credentials;
- bypass authorization for any secret operation or runtime secret retrieval;
- treat read permission as list permission;
- authorize environment A or path A and operate on environment B or path B;
- allow consent to override `DENIED`;
- clear the developer session or switch active environment after denial;
- spawn `run` with a partial authorized secret set;
- send a `secret set`/`secret delete` Vault mutation request before required consent succeeds or when consent is declined/cancelled.

## Requirement Traceability

| ID | Requirement | Problem | Expected behavior | Security relevance | Future test category |
| --- | --- | --- | --- | --- | --- |
| AUTHZ-001 | Authentication is distinct from authorization. | Valid sessions could imply permission. | Session validity and permission remain separate. | Prevents identity/capability confusion. | Unit/E2E |
| AUTHZ-002 | Authorization consumes validated identity only. | Alternate identity resolution can drift. | Same identity enters and is evaluated. | Prevents credential substitution. | Architecture/security |
| AUTHZ-003 | No alternate credential source. | Admin material could mask denial. | No CredentialStore/admin/token fallback. | Prevents escalation. | Mutation/security |
| AUTHZ-004 | Vault is final authority. | Local checks can drift or race. | Actual operation decides permission. | Preserves policy authority. | Integration |
| AUTHZ-005 | No shadow RBAC or persistence. | Local policy duplicates Vault. | No local policy/capability state. | Avoids stale privilege. | Architecture/security |
| AUTHZ-006 | Actual resource context is used. | Authorize/operate mismatch. | Canonical operation path matches. | Prevents confused deputy. | Mutation/integration |
| AUTHZ-007 | Environment isolation is preserved. | Development permission can leak to production. | Resolve per invocation. | Least privilege. | Multi-environment E2E |
| AUTHZ-008 | `403` is denial. | Denial can be misreported as expiry. | Return authorization category. | Preserves session integrity. | Error mutation |
| AUTHZ-009 | `401` remains authentication. | Auth/authz conflation. | Delegate to Session/Auth. | Correct recovery. | Error mapping |
| AUTHZ-010 | `503` remains infrastructure. | Availability can look like denial. | Return lifecycle/unknown category. | Correct diagnosis. | Error mutation |
| AUTHZ-011 | No privilege fallback. | Denial could escalate. | Denied remains denied. | Least privilege. | Mutation/security |
| AUTHZ-012 | Secret operations use actual KV v2 resources. | KV v1 assumptions are unsafe. | Operation-specific enforcement. | Correct policy scope. | Adapter integration |
| AUTHZ-013 | List is independent from read. | Metadata capability differs. | List checks metadata resource. | Prevents metadata disclosure. | Integration |
| AUTHZ-014 | Consent is separate and ordered before mutation. | An unattempted mutation cannot yet carry a Vault decision. | Consent precedes the Vault mutation attempt; Vault decides during that mutation. | Prevents accidental mutation while preserving server-only enforcement. | CLI/E2E |
| AUTHZ-015 | Denial has no session/environment mutation. | 403 could cause side effects. | Preserve state. | Limits blast radius. | Security/mutation |
| AUTHZ-016 | Context continuity is enforced. | Target can change after check. | Same context through execution. | Prevents TOCTOU confusion. | Mutation |
| AUTHZ-017 | Denied mutations are atomic. | Writes/deletes can partially occur. | No mutation before gates pass. | Data integrity. | Integration |
| AUTHZ-018 | Runtime denial prevents spawn. | Partial injection can start unsafe process. | No injection or child process. | Runtime safety. | E2E/mutation |
| AUTHZ-019 | Diagnostics are sanitized. | Denials can leak credentials. | Safe human/JSON output. | Secret protection. | Security |
| AUTHZ-020 | No authorization cache. | Stale decisions can grant access. | Per-operation enforcement. | Revocation safety. | Architecture |
| AUTHZ-021 | Policy administration is deferred. | Scope can expand into RBAC product. | Existing policies only. | Boundary control. | Scope review |

## Validation

This artifact is Specification-only. Design, Tasks, implementation, tests, Session/Auth artifacts, Environment Context artifacts, and ADRs are intentionally unchanged.

Required validator target:

```text
validate_spec.py .specs/features/devvault-authorization-integration/spec.md -> 0 errors, 0 warnings
```