# DevVault Authorization Integration Design

**Feature:** `devvault-authorization-integration`
**Status:** Design (Phase 2, resumed after Specification remediation)
**Authority:** [Authorization Specification](./spec.md) (remediated), verified Session/Auth architecture, verified Environment Context architecture, existing lifecycle/bootstrap architecture

This Design implements the remediated Authorization Specification. It does not redefine any approved requirement. Where a genuine contradiction would have been required, this document stops and reports it instead (none was found).

## 1. Specification Baseline

- Requirement count: 21 (`AUTHZ-001` through `AUTHZ-021`).
- Latest remediation incorporated: yes — `AUTHZ-014`, "Environment Isolation and Consent", "Secret Operation Semantics", "Failure Atomicity", Acceptance Criteria 6/7, and the mutation register were re-read from the current `spec.md` (post `AUTHORIZATION SPECIFICATION REMEDIATION: PASS`) and match the canonical flow below.
- Result: **SPECIFICATION CONSISTENCY: PASS**

## 2. Enforcement Model

- **DD-AUTHZ-001 — Server-Enforced Authorization.** The actual Vault operation (the real HTTP request performed with the developer's validated credential) is the sole authorization enforcement point. DevVault does not compute or predict an allow/deny decision locally.
- **DD-AUTHZ-002 — No Mandatory Capability Preflight.** `sys/capabilities-self` or any other preflight is not called before `secret get`, `secret list`, `secret set`, `secret delete`, or `run`. No new preflight is introduced by this Design.
- **DD-AUTHZ-003 — Vault as Sole Final Authorization Authority.** No local decision (consent, prior success, cached result) may substitute for or override the response of the actual Vault operation.
- Local RBAC: none.
- Cache: none.

## 3. Verified Human Identity Boundary (preserved, not modified)

```text
EnvironmentResolver -> CONFIGURED -> SessionResolver -> SessionGuard -> ValidatedDeveloperSession
```

Authorization consumes `ValidatedDeveloperSession` only. It does not read `CredentialStore`, `process.env.VAULT_TOKEN`, or `AdministrativeCredentialProvider`, does not re-authenticate, and does not modify `SessionResolver`, `SessionGuard`, Environment Context, or lifecycle/bootstrap. This is verified against current production wiring in [composition-root.ts](../../../apps/cli/src/composition-root.ts): `requireValidSession` calls `sessionGuard.requireValidSession()` exclusively, and `createProjectApplication(session?)` builds the human Vault client from `session.credential` only — it never reads `process.env.VAULT_TOKEN` for this path (that variable is read only in the separate `setupVault` administrative client and the default-token branch of `createVaultClient`, both outside the human secret/run path when a session is supplied).

## 4. Component Model

| Component | Existing/New | Responsibility | Dependencies | Forbidden dependencies |
| --- | --- | --- | --- | --- |
| `EnvironmentResolver` (`resolveEnvironmentContext`) | Existing | Resolve project/environment configuration for the invocation. | Filesystem, project config | Vault, session |
| `SessionResolver` / `SessionGuard` | Existing | Produce `ValidatedDeveloperSession` or throw `SessionFailureError`. | `DeveloperSessionStore`, `VaultSessionValidator` | Authorization logic |
| `ValidatedDeveloperSession` | Existing | Carry the single validated credential used for the Vault operation. | none | none |
| `ProjectConfig` (canonical resource) | Existing | Canonical project/environment/`vault.mount`/`vault.path` used identically for consent and for the Vault call. | Environment Context | none |
| `HttpVaultClient` (human instance) | Existing | Perform the actual Vault HTTP operation using the session credential; raise `VaultAuthenticationError` (401), `VaultPermissionDeniedError` (403), `VaultUnavailableError` (503/other). | `fetch`, session credential | `AdministrativeCredentialProvider` |
| Consent (`confirmMutation` / `--yes`) | Existing | Local safety confirmation for a protected-environment mutation. | none | Vault, authorization decision |
| `classifyVaultOperationError` | **New** | Single authoritative translation of a caught Vault operation error into the correct semantic owner for a given operation/project/environment context. | `VaultPermissionDeniedError`, `AuthorizationDeniedError` | `VaultAuthenticationError` handling (rethrows unchanged), CredentialStore, `VAULT_TOKEN` |
| `AuthorizationDeniedError` | **New** | Stable, safe, operation-scoped semantic type for a Vault `403` while the session is otherwise valid. | `DevVaultError` | credential/token fields |

**AuthorizationService: NOT INTRODUCED.** Under server-enforced authorization, there is no local decision to compute, cache, or orchestrate; the Vault operation itself is the decision. Introducing a service class here would only wrap a try/catch with no independent responsibility, risking a God Object that duplicates `SessionGuard` + `HttpVaultClient` + an error mapper. The two responsibilities that genuinely need a home — safe semantic error identity, and the single place that performs the catch — are covered by `AuthorizationDeniedError` (a data type) and `classifyVaultOperationError` (a pure translation function), both minimal and single-purpose.

## 5. Authorization Context

Authorization is operation-scoped, not a stored/global state. For each protected call, the context is:

| Field | Source | Notes |
| --- | --- | --- |
| identity | `ValidatedDeveloperSession.credential` | Used only as the Vault request credential; never placed in `AuthorizationDeniedError` or logs. |
| project | `ProjectConfig.project` | Same object instance used for consent and the Vault call. |
| environment | `ProjectConfig.environment` | Same object instance; honors a one-shot `--environment` override already resolved by `EnvironmentResolver`. |
| logical resource | `ProjectConfig.vault.mount` / `ProjectConfig.vault.path` | Canonical KV v2 location; identical between consent and the Vault call because both read from the same resolved `config`. |
| operation | Literal per call site (`secret.get`, `secret.list`, `secret.set`, `secret.delete`, `run`) | Assigned once per command action, not re-derived. |

Continuity guarantee: `config` is loaded exactly once per command invocation (`composition.createProjectApplication().load(...)`) and passed unchanged into consent and into the operation call, so the resolved resource is structurally identical to the operated resource — no second resolution occurs.

## 6. KV v2 Mapping (verified against current production source)

| Operation | Vault call in [`packages/vault-client/src/index.ts`](../../../packages/vault-client/src/index.ts) | Actual KV v2 resource | Authorization authority |
| --- | --- | --- | --- |
| `secret get` | `readSecret` → `GET /v1/<mount>/data/<path>` | `data/<path>` | Vault |
| `secret list` | `listSecrets` → `LIST /v1/<mount>/metadata/<path>` | `metadata/<path>` | Vault |
| `secret set` | `writeSecret` → `POST /v1/<mount>/data/<path>` | `data/<path>` | Vault |
| `secret delete` | reads via `readSecret`, removes the nested key, then `writeSecret` → `POST /v1/<mount>/data/<path>` (see note) | `data/<path>` | Vault |
| `run` | single `readSecret` → `GET /v1/<mount>/data/<path>` for the whole project document; local mappings read nested fields from that one document | `data/<path>` | Vault |

**Verified note on delete:** [`apps/cli/src/secrets.ts`](../../../apps/cli/src/secrets.ts) `deleteSecret()` does not call `HttpVaultClient.deleteSecret` (which performs `DELETE /v1/<mount>/metadata/<path>`, a full-metadata delete). It reads the current data document, removes the requested nested key, and writes the remaining document back with the same `data`-path `writeSecret` call used by `secret set`. Consequently, **the current `secret delete` operation requires the same Vault capability as `secret set` (create/update on `data/<path>`), not a metadata-delete capability.** `HttpVaultClient.deleteSecret` exists but is currently unused by any command. This Design documents the mapping as verified; it does not add new delete behavior.

Read never implies list (`AUTHZ-013`): `secret get`/`secret set`/`secret delete` all authorize against `data/<path>`; `secret list` authorizes independently against `metadata/<path>`. No local inference is made between them — each is a distinct Vault request with its own response.

## 7. Secret Get Flow

```text
CLI secret get
    -> EnvironmentResolver -> CONFIGURED (config)
    -> SessionGuard.requireValidSession() -> ValidatedDeveloperSession
    -> createProjectApplication(session) [human HttpVaultClient bound to session.credential]
    -> application.getSecret(config, key)
         -> HttpVaultClient.readSecret(config.vault.mount, config.vault.path)  [GET data/<path>]
    -> classifyVaultOperationError on failure
         success           -> return value (undefined if key absent, unchanged existing behavior)
         VaultAuthenticationError (401) -> rethrown unchanged -> Session/Auth presentation
         VaultPermissionDeniedError (403) -> AuthorizationDeniedError('secret.get', project, environment)
         VaultUnavailableError (503/other) -> rethrown unchanged -> infrastructure/lifecycle presentation
```

No retry with `VAULT_TOKEN`, root, bootstrap, or administrative credential at any outcome.

## 8. Secret List Flow

```text
CLI secret list
    -> EnvironmentResolver -> CONFIGURED (config)
    -> SessionGuard.requireValidSession() -> ValidatedDeveloperSession
    -> createProjectApplication(session)
    -> application.listSecrets(config)
         -> HttpVaultClient.listSecrets(config.vault.mount, config.vault.path)  [LIST metadata/<path>]
    -> classifyVaultOperationError on failure (same 401/403/503 mapping as Get, operation = 'secret.list')
```

A prior successful `secret get` for the same project/environment does not change this outcome; list authorization is independently determined by Vault's response to the `metadata/<path>` request.

## 9. Secret Set Flow (remediated ordering)

```text
CLI secret set
    -> EnvironmentResolver -> CONFIGURED (config)
    -> SessionGuard.requireValidSession() -> ValidatedDeveloperSession
    -> createProjectApplication(session)
    -> IF config.protected AND NOT --yes:
           consent.confirm(...)  [same config instance; declined/cancelled -> throw, ZERO Vault request]
    -> application.setSecret(config, key, value)
         -> HttpVaultClient.readSecret then writeSecret(config.vault.mount, config.vault.path)  [data/<path>]
    -> classifyVaultOperationError on failure
         success -> "Secret stored: <key>"
         401 -> Session/Auth presentation (session unchanged, environment unchanged)
         403 -> AuthorizationDeniedError('secret.set', project, environment); no successful mutation; no retry; session/environment unchanged
         503 -> infrastructure/lifecycle presentation
```

This flow already exists in [`apps/cli/src/commands/secret.ts`](../../../apps/cli/src/commands/secret.ts) `runSecretSet` in the required order (environment → session → resource → consent → mutation); only the error-translation step (`classifyVaultOperationError`) is new.

## 10. Secret Delete Flow

```text
CLI secret delete
    -> EnvironmentResolver -> CONFIGURED (config)
    -> SessionGuard.requireValidSession() -> ValidatedDeveloperSession
    -> createProjectApplication(session)
    -> [protected-environment consent gap — see Existing Component Impact]
    -> application.deleteSecret(config, key)
         -> HttpVaultClient.readSecret then writeSecret(config.vault.mount, config.vault.path)  [data/<path>, per Section 6]
    -> classifyVaultOperationError on failure (operation = 'secret.delete', same 401/403/503 mapping)
```

Delete uses the same `data/<path>` write capability as `secret set` (Section 6); this Design does not introduce metadata-delete semantics.

## 11. Run Flow

```text
CLI run -- <command>
    -> EnvironmentResolver -> CONFIGURED (config)
    -> SessionGuard.requireValidSession() -> ValidatedDeveloperSession
    -> createProjectApplication(session)
    -> application.run(config, command, args)
         -> resolveRuntimeEnvironment(config, client)
              -> HttpVaultClient.readSecret(config.vault.mount, config.vault.path)  [GET data/<path>, ONE call]
              -> classifyVaultOperationError on failure -> throw before any mapping/injection/spawn
              -> map each runtime.mappings entry from the single fetched document
                   -> missing nested key -> throw (existing "Secret not found for environment mapping" error), no injection, no spawn
         -> ONLY IF the above resolves fully -> launchProcess(command, args, environment)
```

- Secret aggregation: a single Vault read per invocation (the whole project document), not N calls per mapped secret; there is exactly one authorization outcome to observe.
- Partial failure: `resolveRuntimeEnvironment` is awaited to completion before `launchProcess` is ever called; a 401/403/503/missing-key failure throws out of `application.run(...)` before any child process exists — this is already structurally all-or-nothing in the current code and requires no new gating logic.
- Spawn behavior: unchanged; only reached after full successful resolution.
- Fetched values remain in the in-memory `environment` object for the duration of the call; they are not logged or persisted, matching current behavior.

## 12. Consent Architecture

- Consent timing: for `secret set`, consent (`confirmMutation` or `--yes`) occurs after session/resource resolution and **before** the Vault mutation request is sent — matching `AUTHZ-014`.
- Consent is not authorization; it never inspects or infers Vault policy.
- Pre-consent mutation: forbidden; if consent is declined/cancelled, `application.setSecret`/`deleteSecret` is never called, so zero Vault requests occur.
- Post-consent `403`: valid outcome. An authenticated developer may confirm and still receive `AuthorizationDeniedError`. This is not classified as expired, not retried, and does not clear consent-adjacent state (there is none to clear).
- `--yes` behavior: bypasses only the local confirmation prompt; it has no effect on Vault's authorization decision and cannot convert `DENIED` into `AUTHORIZED`.

## 13. Error Architecture

| HTTP evidence | Raw/infra type (existing) | Semantic owner | Design action |
| --- | --- | --- | --- |
| 401 | `VaultAuthenticationError` (`@devvault/core`) | Session/Auth | Rethrown unchanged by `classifyVaultOperationError`; Authorization never reclassifies it. |
| 403 | `VaultPermissionDeniedError` (`@devvault/core`) | Authorization | Translated to `AuthorizationDeniedError` (new), carrying `operation`, `project`, `environment` only. |
| 503 / other | `VaultUnavailableError` (`@devvault/core`) | Infrastructure/lifecycle | Rethrown unchanged. |

Raw Vault mapping owner: `HttpVaultClient` (`packages/vault-client/src/index.ts`) — unchanged. Semantic mapping owner: the new `classifyVaultOperationError` (`packages/core/src/authorization-errors.ts`), invoked from the existing operation call sites in `apps/cli/src/secrets.ts` and `apps/cli/src/runtime.ts` (the same layer that already special-cases a 404 in `readSecret`/`listSecrets`). This avoids duplicating a status-code switch per command.

## 14. Identity Isolation

- `CredentialStore`: not read by Authorization; only `SessionResolver`/`SessionGuard` read it, as today.
- `VAULT_TOKEN`: not read anywhere in the human secret/`run` path once a session exists; verified in `createProjectApplication(session)`, which only conditionally includes `session.credential` as the token.
- `AdministrativeCredentialProvider`: not referenced by any secret/run/authorization code path; remains isolated in the lifecycle/bootstrap wiring.
- Second credential resolution: none — the same `session.credential` bound at `createProjectApplication(session)` construction is the only credential used for the entire operation.
- Result: **PASS**

## 15. Session / Environment Side Effects

- On `403`: `classifyVaultOperationError` only constructs and throws `AuthorizationDeniedError`; it does not call `DeveloperSessionStore`, `CredentialStore`, or any environment-context write path.
- On `403`: no call to `resolveEnvironmentContext` occurs again; the already-resolved `config` is reused for error reporting only.
- Result: **PASS** (zero session mutation, zero environment mutation)

## 16. Composition Root

- Construction requires session: **NO** — `createProjectApplication(session?: ValidatedDeveloperSession)` in [composition-root.ts](../../../apps/cli/src/composition-root.ts) accepts an optional session; the config-loading call (`createProjectApplication().load(...)`) already runs without one.
- Construction requires authorization: **NO** — no authorization check exists at composition time; it occurs only inside `SecretOperations`/`RuntimeOperations` calls at the operation boundary.
- Operation-boundary behavior: authorization is only observable when `application.getSecret/listSecrets/setSecret/deleteSecret/run` is actually invoked.
- Human/admin separation: preserved — `createProjectApplication` never receives `AdministrativeCredentialProvider`/bootstrap material; those remain confined to `lifecycleService`, `createLocalDeveloperUser`, and `setupVault` in the composition root.
- Required regression invariant restated: `createCompositionRoot().createProjectApplication()` (no session) MUST continue to construct and load configuration successfully; this Design adds no check that would break it.

## 17. Persistence / Cache

- Authorization state persisted: none.
- Capabilities persisted: none (no capability check is introduced).
- Policy persisted: none.
- New state: none — `AuthorizationDeniedError` is a transient thrown value, never written to disk, `CredentialStore`, or `context.json`.
- Result: **PASS**

## 18. Diagnostics

- `status`: unchanged; continues to report `session` (via `SafeSessionSummary`) without any secret-path probe. No global `authorization: AUTHORIZED` field is added.
- `doctor`: unchanged by this Design. Note (pre-existing, out of this feature's scope): `apps/cli/src/diagnostics.ts` already calls `client.checkCapabilities` against a synthetic `secret/data/projects/<project>/<environment>/_doctor` path to compute a `authorized` boolean fed into `classifyVaultLifecycle`. This predates Authorization Integration, targets a synthetic diagnostic path rather than a real secret resource, and is left untouched; it must not be extended to claim authorization for real secret operations.
- Human error: "Permission denied for this secret operation. Your session is valid, but your Vault policy does not allow this action. Contact your Vault/project administrator." Never suggests `devvault start` or "login again" for a plain `AuthorizationDeniedError`.
- JSON error: reserves `code: "AUTHORIZATION_DENIED"` on `AuthorizationDeniedError` (via existing `DevVaultError.code`), distinct from `LOGIN_REQUIRED`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `SESSION_INVALID`, `SESSION_UNKNOWN`, and `VAULT_UNAVAILABLE`. No CLI-wide `--json` error contract currently exists (today `index.ts` prints `Error: <message>` uniformly with `process.exitCode = 1`); this Design does not invent one, per the Specification's deferral of numeric exit-code assignment to a future compatibility decision.
- Leakage controls: `AuthorizationDeniedError` fields are limited to `operation`, `project`, `environment` — no token, header, secret value, or raw Vault response body.

## 19. Design Decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| DD-AUTHZ-001 | Server-Enforced Authorization | Vault already enforces policy on the actual operation; avoids duplicate/stale local decisions. |
| DD-AUTHZ-002 | No Mandatory Capability Preflight | Avoids TOCTOU, extra calls, and a second authorization surface; matches Specification's remediated model. |
| DD-AUTHZ-003 | Vault as Sole Final Authorization Authority | No local state may override the real operation's outcome. |
| DD-AUTHZ-004 | No Local Shadow RBAC | Prevents drift from Vault policy; keeps DevVault a thin DX layer. |
| DD-AUTHZ-005 | Operation-Scoped Authorization Context | Prevents a durable/global "authorized" flag from being introduced. |
| DD-AUTHZ-006 | Protected Consent Before Mutation Attempt | Matches remediated `AUTHZ-014`; consent is a safety gate, not a permission check, and Vault may still deny after consent. |
| DD-AUTHZ-007 | Run All-or-Nothing | Already structural (single sequential await chain before spawn); Design preserves it rather than re-implementing it. |
| DD-AUTHZ-008 | No Authorization Cache/Persistence | `AuthorizationDeniedError` is transient; nothing is written to `CredentialStore`, `context.json`, or project files. |
| DD-AUTHZ-009 | Human/Admin Credential Isolation | `AdministrativeCredentialProvider`/`VAULT_TOKEN` remain absent from the human secret/run/authorization path. |
| DD-AUTHZ-010 | Central Semantic Vault Error Mapping | One `classifyVaultOperationError` function is the single translation point instead of duplicated status-code switches per command. |

## 20. Security Invariants (restated, all preserved)

`AUTHENTICATED != AUTHORIZED` · Vault is final authority · authorization is operation-scoped · validated identity == Vault operation identity · resolved resource == operated resource · no `VAULT_TOKEN` fallback · no admin/root/bootstrap fallback · `403 != expired` · `503 != denied` · `consent != authorization` · no Vault mutation before required consent · consent cannot override 403 · denial does not mutate session · denial does not mutate environment · unauthorized `run` => zero spawn · no authorization cache · no shadow RBAC.

## 21. Requirement Traceability

| Requirement | Design Section | Component/Flow | Test Seam |
| --- | --- | --- | --- |
| AUTHZ-001 | §2, §5 | Operation-scoped context vs. `ValidatedDeveloperSession` | AZM15 |
| AUTHZ-002 | §3, §5 | `createProjectApplication(session)` uses `session.credential` only | AZM14 |
| AUTHZ-003 | §3, §14 | Composition root credential wiring | AZM3, AZM4, AZM14 |
| AUTHZ-004 | §2, §13 | `classifyVaultOperationError` rethrows on success/failure per Vault response | AZM1, AZM2 |
| AUTHZ-005 | §2, §17 | No RBAC/persistence component introduced | (architecture review) |
| AUTHZ-006 | §5, §7–§11 | Shared `config` for consent/operation | AZM8, AZM9 |
| AUTHZ-007 | §5 | Per-invocation environment resolution, no fallback | AZM9 |
| AUTHZ-008 | §13 | `VaultPermissionDeniedError` -> `AuthorizationDeniedError`, not `SESSION_EXPIRED` | AZM1 |
| AUTHZ-009 | §13 | `VaultAuthenticationError` rethrown unchanged | AZM1 (inverse), classifier unit test |
| AUTHZ-010 | §13 | `VaultUnavailableError` rethrown unchanged | AZM2 |
| AUTHZ-011 | §3, §7–§11, §14 | No credential fallback in any flow | AZM3, AZM4 |
| AUTHZ-012 | §6 | KV v2 mapping table | integration tests per operation |
| AUTHZ-013 | §6, §8 | List uses `metadata/<path>`, independent from `data/<path>` | AZM13 |
| AUTHZ-014 | §9, §10, §12 | Consent before mutation attempt; 403 valid after consent | AZM10, AZM16, AZM17 |
| AUTHZ-015 | §15 | No session/environment write on 403 | AZM11, AZM12 |
| AUTHZ-016 | §5 | Single shared context object through consent + operation | AZM8, AZM9 |
| AUTHZ-017 | §9, §10 | No successful mutation on 403; zero request pre-consent | AZM16, AZM17 |
| AUTHZ-018 | §11 | Sequential await before `launchProcess` | AZM6, AZM7 |
| AUTHZ-019 | §18 | `AuthorizationDeniedError` field allowlist | (security review / unit test) |
| AUTHZ-020 | §17 | No persisted authorization state | (architecture review) |
| AUTHZ-021 | Out of scope (unchanged) | No policy admin component | (scope review) |

Coverage: 21/21 (100%). No orphan requirements.

## 22. Mutation Sensor Register

| Mutation | Test Seam | Expected |
| --- | --- | --- |
| AZM1 | `classifyVaultOperationError` unit test: feed `VaultPermissionDeniedError`, assert `AuthorizationDeniedError` (not `SessionFailureError`/`SESSION_EXPIRED`) | KILLED |
| AZM2 | `classifyVaultOperationError` unit test: feed `VaultUnavailableError`, assert rethrown unchanged (not `AuthorizationDeniedError`) | KILLED |
| AZM3 | `RecordingVaultClient` on 403: assert no subsequent call carries `process.env.VAULT_TOKEN` | KILLED |
| AZM4 | `RecordingVaultClient` on 403: assert no subsequent call uses `AdministrativeCredentialProvider`/bootstrap material | KILLED |
| AZM5 | Integration test on `secret get/set/delete`: assert a raw `VaultPermissionDeniedError` never reaches the CLI unclassified | KILLED |
| AZM6 | `run` integration test: assert `RecordingProcessSpawner` recorded zero spawns on any 401/403/503 | KILLED |
| AZM7 | `run` integration test with a multi-key mapping document where the single read is denied: assert zero spawn, zero injection | KILLED |
| AZM8 | Assert consent/error context and the Vault call use identical `config.vault.path` | KILLED |
| AZM9 | Assert consent/error context and the Vault call use identical `config.environment` (including `--environment` override) | KILLED |
| AZM10 | `RecordingConsentProvider` + `RecordingVaultClient` on 403 after consent: assert no forced success / no override of the thrown error | KILLED |
| AZM11 | `RecordingSessionStore`: assert zero writes/clears after `AuthorizationDeniedError` | KILLED |
| AZM12 | `RecordingEnvironmentContext`: assert zero writes/selection changes after `AuthorizationDeniedError` | KILLED |
| AZM13 | Assert a successful `secret get` does not make `secret list` skip its own Vault call/authorization outcome | KILLED |
| AZM14 | Assert no second `CredentialStore`/session resolution occurs between `SessionGuard.requireValidSession()` and the Vault call | KILLED |
| AZM15 | Assert `createCompositionRoot()` and `createProjectApplication()` (no session) succeed with zero authorization/session calls | KILLED |
| AZM16 | `RecordingVaultClient` with consent declined/cancelled: assert zero mutation requests recorded | KILLED |
| AZM17 | `RecordingConsentProvider` returning cancelled: assert zero `writeSecret`/mutation calls, mirroring AZM16 from the consent side | KILLED |

Recording adapters (`RecordingVaultClient`, `RecordingConsentProvider`, `RecordingSessionStore`, `RecordingEnvironmentContext`, `RecordingProcessSpawner`) follow the existing test-double style already used in this repository's suites (e.g., fake `SecretClient`/`RuntimeSecretClient` implementations in current `*.test.ts` files); no new test framework is introduced.

## 23. Diagram Integrity

Symbols used across all diagrams in this document: `CLI`, `EnvironmentResolver`, `SessionResolver`, `SessionGuard`, `ValidatedDeveloperSession`, `createProjectApplication`, `HttpVaultClient`, `Vault`, `classifyVaultOperationError`, `AuthorizationDeniedError`, `VaultAuthenticationError`, `VaultPermissionDeniedError`, `VaultUnavailableError`, `resolveRuntimeEnvironment`, `launchProcess`, consent (`confirmMutation`/`--yes`). Every symbol maps to an existing component (Section 4/13) or a newly justified one (`classifyVaultOperationError`, `AuthorizationDeniedError`). No alias is introduced for an existing concept (e.g., no `AuthorizationGuard`/`PermissionGuard`/`VaultPolicyGuard`).

    undefined symbols: 0
    stale aliases: 0
    result: PASS

## 24. Existing Component Impact

| Component | Current responsibility | Required Authorization integration change | Preserved boundary |
| --- | --- | --- | --- |
| `apps/cli/src/secrets.ts` | Implements `get/list/set/delete` against `HttpVaultClient` | Wrap each Vault call with `classifyVaultOperationError(operation, config)` | Still implements `SecretOperations`; no new dependency on session/credential |
| `apps/cli/src/runtime.ts` | Resolves runtime environment and spawns process | Wrap `readSecret` with `classifyVaultOperationError('run', config)` | Sequential await ordering unchanged |
| `apps/cli/src/commands/secret.ts` | CLI command wiring, consent for `set` | None required for ordering (already correct); presentation layer will render `AuthorizationDeniedError` safely once implemented | Consent logic unchanged |
| `apps/cli/src/commands/secret.ts` (`delete`) | Requires `--yes` unconditionally | **Gap, not fixed by this Design:** unlike `set`, `delete` does not check `config.protected` before mutating. Implementation phase should decide whether to align `delete` consent with `set`'s protected-environment check; this is a product/UX decision, not an authorization-model decision, and does not block this Design. | Out of Design scope; flagged for Tasks |
| `packages/core/src/errors.ts` | Hosts `DevVaultError` hierarchy | Add `AuthorizationDeniedError` | Existing hierarchy/pattern reused |
| `packages/core/src/session-errors.ts` | Session failure classification | None — pattern reused, not modified | Stays session-only |
| `apps/cli/src/composition-root.ts` | Wires human/admin credentials | None — already satisfies isolation and no-session-required construction | Preserved |
| `apps/cli/src/diagnostics.ts` (`doctor`) | Pre-existing synthetic-path capability check | None | Out of scope; documented in §18 |

## 25. New Component Justification

- `AuthorizationDeniedError` (new): existing `VaultPermissionDeniedError` is raw/infra-owned and untyped for operation/project/environment context; a distinct, minimal semantic type is required to (a) carry safe diagnostic fields, (b) expose a stable `AUTHORIZATION_DENIED` code distinct from session/infra codes, and (c) be independently testable/killable. Dependencies: `DevVaultError`. Forbidden dependencies: credential/token fields, Vault HTTP internals.
- `classifyVaultOperationError` (new): a single pure function (mirrors the existing `classifySessionFailure` pattern) that rethrows 401/503 unchanged and translates 403 into `AuthorizationDeniedError`. Dependencies: the three existing Vault error types, `AuthorizationDeniedError`. Forbidden dependencies: `CredentialStore`, `process.env.VAULT_TOKEN`, `AdministrativeCredentialProvider`, HTTP client internals.

No other new production component is introduced.

## 26. Open Decisions

    blocking: 0
    non-blocking: 1 — whether `secret delete` should gain a `config.protected` consent check like `secret set` (Section 24); deferred to Tasks/product decision, does not affect the authorization model.

## 27. Validation

    validate_spec: PASS (0 errors, 0 warnings) — re-run against the current remediated .specs/features/devvault-authorization-integration/spec.md
    validate_design: not available in this repository's tooling; explicit Design integrity checks performed instead (diagram symbol cross-check §23, requirement coverage §21, scope review §28)
    Design integrity: PASS

## 28. Scope Review

    Specification changed: NO
    Design changed: YES (this file, created)
    tasks changed: NO
    production changed: NO
    tests changed: NO
    Session/Auth artifacts changed: NO
    Environment Context artifacts changed: NO
    unrelated changes: pre-existing unstaged/untracked workspace changes preserved, not touched by this Design
