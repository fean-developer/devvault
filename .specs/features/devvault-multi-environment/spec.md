# DevVault Multi-Environment Specification

**Feature:** `devvault-multi-environment`
**Status:** Proposed
**Scope:** Project-scoped environment context and isolated environment configuration
**Phase:** New feature after existing setup and local lifecycle foundations
**Authority:** Existing Architecture Authority and canonical invariants remain authoritative

## Problem Statement

DevVault currently resolves one project configuration from a single root `devvault.yaml`. This makes development and production configuration coexistence ambiguous and requires replacing the same file when switching environments.

The feature introduces independent environment configurations and a deterministic active-environment context so that the same project can safely use development, production and other environments without silent fallback or cross-environment access.

The primary configuration model is:

```text
project/
├── environments/
│   ├── development/
│   │   └── devvault.yaml
│   └── production/
│       └── devvault.yaml
└── .devvault/
    └── context.json
```

## Goals

1. Allow multiple environments in one project without requiring `--force` when creating different environments.
2. Resolve environments deterministically before any Vault access.
3. Provide a local active-environment context containing only non-sensitive metadata.
4. Support explicit, non-persistent environment overrides.
5. Preserve strict project, environment and Vault-path consistency.
6. Protect explicitly marked environments from accidental mutations.
7. Keep read-only operations available for protected environments.
8. Reuse one resolver across secrets, runtime, status, doctor, start and project commands.
9. Preserve backward compatibility with the legacy single-file project model.
10. Keep CLI commands thin and keep discovery/configuration logic outside command modules.

## Out of Scope

This feature does not include:

- AppRole, OIDC, CI/CD or dynamic secrets;
- Vault Agent or application authentication redesign;
- remote Vault provisioning or corporate policy administration;
- automatic migration of legacy configuration;
- automatic deletion or movement of legacy configuration;
- changing the local bootstrap boundary created by the lifecycle feature;
- changing Phase 0 or local lifecycle specifications, designs, tasks or validation artifacts;
- changing the canonical invariant matrix without a separate architecture decision;
- arbitrary fallback to `development`;
- merging multiple environment configuration files;
- storing secrets in context or configuration files.

## Architecture Baseline

The implementation SHALL preserve the existing layering:

```text
CLI
  -> Application services
  -> Ports / resolvers
  -> Config and platform adapters
  -> Vault client
```

The CLI SHALL NOT:

- derive Vault paths manually;
- read `.devvault/context.json` directly;
- discover environments independently;
- implement protected-environment rules;
- access Vault before environment resolution.

The feature SHALL introduce or reuse equivalent abstractions for:

- project root discovery;
- project context;
- environment context;
- environment resolution;
- active context persistence;
- environment configuration loading.

## Configuration Model

Each environment SHALL have an independent configuration file:

```text
environments/<environment>/devvault.yaml
```

A valid configuration SHALL contain:

```yaml
version: 1
project: my-api
environment: production
protected: true
vault:
  mount: secret
  path: projects/my-api/production
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
```

The `protected` field SHALL default to `false` when omitted and SHALL be metadata only. It SHALL NOT contain secrets.

The configuration SHALL be rejected when any of the following is inconsistent:

- YAML project and discovered project root;
- YAML environment and environment directory name;
- YAML environment and requested environment;
- Vault path project segment and YAML project;
- Vault path environment segment and YAML environment;
- Vault mount/path structure expected by the configuration schema.

## Project Root Discovery

The resolver SHALL discover a project root deterministically using the following recognized models:

1. a new-model `environments/` directory;
2. a `.devvault/` context directory;
3. a legacy root `devvault.yaml`.

The resolver SHALL walk parent directories using the existing project-discovery boundary. It SHALL NOT select an arbitrary nested `devvault.yaml` as the active configuration.

When multiple models coexist, the precedence rules in the Legacy Compatibility section SHALL apply.

## Environment Resolution

All environment-aware operations SHALL use one resolver.

Resolution precedence SHALL be:

```text
1. explicit --environment <name>
2. persisted active environment in .devvault/context.json
3. explicit error
```

The resolver SHALL NOT default silently to `development`.

## User Stories

### ENV-US-001: Configure multiple environments

As a developer, I want development and production configurations to coexist so that creating one environment does not overwrite another.

### ENV-US-002: Select the active environment

As a developer, I want to select an active environment so that normal secret and runtime commands use a deterministic context.

### ENV-US-003: Override safely for one command

As a developer, I want an explicit environment override that applies only to one command so that temporary production inspection cannot change my active context.

### ENV-US-004: Protect sensitive environments

As a developer, I want explicitly protected environments to require confirmation for mutations while keeping read-only inspection available.

### ENV-US-005: Preserve project isolation

As a security-conscious developer, I want project, environment and Vault paths validated together so that one project cannot access another project's secrets.

### ENV-US-006: Keep legacy projects usable

As an existing DevVault user, I want legacy single-environment projects to continue working while migration remains explicit and non-destructive.

### Explicit override

WHEN an explicit `--environment <name>` is supplied, THE SYSTEM SHALL resolve that environment for the current command and SHALL NOT modify the persisted active context.

### Active context

WHEN no explicit environment is supplied and a valid active context exists, THE SYSTEM SHALL resolve that environment.

### No environment

IF no explicit environment and no active context exist, THE SYSTEM SHALL fail before Vault access with an actionable message equivalent to:

```text
No environment selected.

Available environments:
  development
  production

Select one with:
  devvault environment set <name>
```

### Unknown environment

IF the requested or active environment does not have a valid configuration, THE SYSTEM SHALL fail before Vault access and list available environments when they can be discovered.

## Environment Context Persistence

The active environment SHALL be stored at:

```text
.devvault/context.json
```

The only supported persisted field in V1 SHALL be:

```json
{
  "environment": "development"
}
```

The context file SHALL:

- use a strict schema;
- allow only known metadata fields;
- reject unknown fields;
- reject path traversal and invalid environment names;
- contain no token, password, secret, root token, unseal key, authorization header or bootstrap material;
- be written atomically when modified;
- return a clear error when corrupt;
- never replace environment configuration files.

The `.devvault/` directory SHALL be local-only. The implementation SHALL add `.devvault/` to `.gitignore` idempotently when the project context feature initializes, without overwriting or deleting existing rules.

## Command Surface

The feature SHALL provide:

```bash
devvault environment set <name>
devvault environment current
devvault environment list
```

### `environment set`

WHEN `devvault environment set <name>` is executed, THE SYSTEM SHALL validate that the environment configuration exists and SHALL persist that name as active context without changing Vault secrets.

### `environment current`

The command SHALL print the active environment or an explicit no-environment-selected error. It SHALL not access Vault.

### `environment list`

The command SHALL list available environment names derived from configuration directories. It SHALL not print secret values or access secret data.

### `init-project`

The command SHALL support:

```bash
devvault init-project --environment development
devvault init-project --environment production
```

It SHALL create:

```text
environments/development/devvault.yaml
environments/production/devvault.yaml
```

Creating one environment SHALL NOT require `--force` because another environment exists.

IF the target environment already exists, THE SYSTEM SHALL fail without overwriting it and SHALL explain that `--force` is required only for that same environment.

WHEN `--force` is supplied, THE SYSTEM SHALL replace only the target environment file and SHALL preserve every other environment configuration.

### Environment-aware operations

The following commands SHALL resolve the environment before performing work:

```text
secret set
secret get
secret list
secret delete
run
status
doctor
start, when project context is applicable
```

Every command that accesses Vault SHALL use the resolved environment configuration rather than reconstructing paths independently.

## Secret and Runtime Isolation

The Vault path SHALL be derived only from validated project configuration:

```text
secret/data/projects/<project>/<environment>
```

The following scopes SHALL remain distinct:

```text
Project A / development
Project A / production
Project B / development
```

The system SHALL reject cross-project and cross-environment configuration before Vault access.

WHEN the active environment is `development`, `secret` and `run` SHALL use only the development configuration and Vault path.

WHEN the active environment is `production`, `secret` and `run` SHALL use only the production configuration and Vault path.

An explicit override SHALL apply only to the current command and SHALL NOT persist.

## Protected Environments

Protection SHALL be explicit through:

```yaml
protected: true
```

The system SHALL NOT infer protection solely from names such as `production` or `prod`.

### Read-only operations

The following operations SHALL remain available without additional mutation confirmation:

```bash
devvault secret get <key>
devvault secret list
devvault status
devvault doctor
```

### Mutating operations

For a protected environment, the system SHALL require explicit confirmation before:

```bash
devvault secret set <key>
devvault secret delete <key>
```

The human prompt SHALL identify the current protected environment and the mutation.

An explicit `--yes` MAY authorize automation. The system SHALL NOT infer authorization from `CI`, `NON_INTERACTIVE` or similar environment variables.

If confirmation is denied, THE SYSTEM SHALL not access or mutate the target secret.

## Status, Doctor and Start

`status` and `doctor` SHALL use the same environment resolver as secret and runtime commands.

Human output SHALL include, when a project context is applicable:

```text
Project: my-api
Environment: production
Protected: yes
Vault: READY
```

`doctor --json` SHALL include project, resolved environment and protected metadata without secret values or credentials.

`start` SHALL support two contexts:

- outside a project: prepare global local infrastructure without requiring project configuration;
- inside a project: resolve the project environment when project-aware validation is needed.

The lifecycle implementation SHALL remain centralized. Multi-environment support SHALL provide context to lifecycle services rather than duplicate lifecycle behavior.

## Legacy Compatibility

The legacy model is:

```text
project/devvault.yaml
```

When `environments/` does not exist, THE SYSTEM SHALL continue to load the legacy configuration temporarily.

The system SHALL emit a warning equivalent to:

```text
Legacy project configuration detected.
This project uses the legacy single-environment model.
```

The legacy configuration SHALL not be migrated automatically.

### Legacy and new model coexistence

When both a root `devvault.yaml` and `environments/` exist:

1. explicit environment uses the matching new-model file;
2. active context uses the matching new-model file;
3. legacy configuration is used only when no matching new-model environment is selected;
4. configuration files are never merged silently;
5. ambiguity or missing migration state produces a warning or explicit error before Vault access.

A future `devvault environment migrate` command MAY be proposed separately. Migration is out of scope here and SHALL not delete or move legacy files automatically.

## Security Requirements

- The system SHALL resolve an environment before any Vault access.
- An explicit environment SHALL override active context for that invocation.
- An explicit override SHALL NOT modify persisted context.
- One environment SHALL NOT overwrite another environment.
- Project, environment and Vault path SHALL remain mutually consistent.
- Context SHALL contain only non-sensitive metadata.
- Protected-environment mutation SHALL require explicit authorization.
- No command SHALL silently fall back to `development`.
- Status and doctor SHALL use the same resolver as secrets and runtime.
- Cross-project and cross-environment configuration SHALL be rejected.
- Vault paths SHALL be derived only from validated configuration.
- Secrets SHALL not appear in context, project files, logs, argv, JSON or exceptions.
- Existing security invariants `INV-001` through `INV-018` and applicable `INV-SETUP-*` invariants SHALL remain valid.

## Error Model

The feature SHALL use actionable errors for:

- no environment selected;
- environment not found;
- invalid context file;
- invalid project/environment/path consistency;
- legacy/new model ambiguity;
- protected mutation without confirmation;
- invalid `--force` target;
- missing environment configuration.

Environment resolution errors SHALL occur before Vault calls and SHALL not expose secret values or credentials.

## Requirement IDs

Requirements use feature-specific IDs and do not reuse Phase 0 or lifecycle IDs.

### ENV-001: Independent environment initialization

WHEN `init-project --environment <name>` is executed and the target environment does not exist, THE SYSTEM SHALL create only `environments/<name>/devvault.yaml` with a validated project, environment and Vault path.

### ENV-002: Environment coexistence

WHEN two distinct environment names are initialized, THE SYSTEM SHALL preserve both independent configuration files without requiring `--force`.

### ENV-003: Same-environment overwrite protection

IF the target environment already exists and `--force` is absent, THE SYSTEM SHALL fail without modifying that environment file.

### ENV-004: Scoped force

WHEN `--force` is supplied, THE SYSTEM SHALL replace only the named environment configuration and SHALL preserve all other environments.

### ENV-005: Active environment persistence

WHEN `environment set <name>` succeeds, THE SYSTEM SHALL atomically persist only the validated environment name in `.devvault/context.json`.

### ENV-006: Current environment

WHEN `environment current` is executed, THE SYSTEM SHALL report the active environment or a deterministic no-environment error without accessing Vault.

### ENV-007: Environment listing

WHEN `environment list` is executed, THE SYSTEM SHALL list available environment configurations without reading secret values.

### ENV-008: Explicit resolution precedence

WHEN `--environment <name>` is supplied, THE SYSTEM SHALL resolve that environment before active context and SHALL use it for only the current invocation.

### ENV-009: Override non-persistence

WHEN an explicit environment override is used, THE SYSTEM SHALL NOT modify `.devvault/context.json`.

### ENV-010: Active context resolution

WHEN no explicit override exists and a valid active context exists, THE SYSTEM SHALL resolve the active environment.

### ENV-011: Missing environment failure

IF no explicit or active environment exists, THE SYSTEM SHALL fail before Vault access with an actionable selection message.

### ENV-012: Unknown environment failure

IF the requested or active environment configuration does not exist, THE SYSTEM SHALL fail before Vault access and identify the missing environment.

### ENV-013: Configuration consistency

WHEN an environment configuration is loaded, THE SYSTEM SHALL reject project, directory, environment or Vault-path mismatches before Vault access.

### ENV-014: Secret environment isolation

WHEN a secret operation executes, THE SYSTEM SHALL use only the resolved environment's Vault path and SHALL not read or write another environment path.

### ENV-015: Runtime environment isolation

WHEN `run` executes, THE SYSTEM SHALL resolve one environment before resolving runtime mappings and SHALL inject only that environment's secrets.

### ENV-016: Protected metadata

WHEN `protected: true` is present, THE SYSTEM SHALL preserve that metadata in the resolved environment context and SHALL not infer it from the environment name alone.

### ENV-017: Protected read operations

WHEN a read-only operation targets a protected environment, THE SYSTEM SHALL allow it without mutation confirmation.

### ENV-018: Protected mutations

WHEN a mutation targets a protected environment, THE SYSTEM SHALL require explicit confirmation or explicit `--yes` authorization before Vault mutation.

### ENV-019: Context security

WHEN context metadata is written or loaded, THE SYSTEM SHALL reject credentials, secrets, unknown fields and unsafe environment names.

### ENV-020: Project-aware status

WHEN `status` runs in a project context, THE SYSTEM SHALL report the resolved project, environment and protected metadata without secret values.

### ENV-021: Project-aware doctor

WHEN `doctor` runs in a project context, THE SYSTEM SHALL use the shared resolver and include the resolved environment in human and JSON diagnostics.

### ENV-022: Start context boundary

WHEN `start` runs outside a project, THE SYSTEM SHALL prepare global infrastructure without requiring an environment; when project-aware checks run inside a project, it SHALL use the shared resolver.

### ENV-023: Legacy compatibility

WHEN no new-model `environments/` directory exists, THE SYSTEM SHALL load the legacy root `devvault.yaml` with a migration warning and SHALL not modify it automatically.

### ENV-024: Legacy/new precedence

WHEN legacy and new-model configuration coexist, THE SYSTEM SHALL apply the defined explicit/active/new-model precedence and SHALL never merge configurations silently.

### ENV-025: Gitignore context

WHEN the new project context is initialized, THE SYSTEM SHALL add `.devvault/` idempotently to `.gitignore` without removing existing rules or writing credentials.

### ENV-026: Resolver-before-Vault

WHEN any environment-aware command executes, THE SYSTEM SHALL resolve and validate project/environment configuration before invoking any Vault client operation.

### ENV-027: CLI boundary

WHEN environment-aware commands are registered, THE SYSTEM SHALL delegate discovery, resolution, protection and path derivation to application/config boundaries rather than implementing them in CLI modules.

### ENV-028: Environment override for runtime

WHEN `run --environment <name> -- <command>` is executed, THE SYSTEM SHALL use the named environment for that process without changing the persisted active context.

### ENV-029: Protected delete authorization

WHEN `secret delete` targets a protected environment, THE SYSTEM SHALL require explicit destructive confirmation and SHALL not infer authorization from non-interactive process variables.

### ENV-030: Context corruption handling

IF `.devvault/context.json` is missing, corrupt or invalid, THE SYSTEM SHALL return an actionable error and SHALL not guess an environment or access Vault.

## Edge Cases

- Development and production configurations coexist.
- The same environment is initialized twice without `--force`.
- `--force` targets development while production exists.
- No active environment exists.
- Active context names a deleted environment.
- Explicit override names a missing environment.
- Explicit override differs from active context.
- Context JSON contains an unknown field.
- Context JSON contains a credential-like key.
- Environment YAML has a cross-project path.
- Environment YAML has a cross-environment path.
- Environment directory and YAML environment differ.
- Legacy and new configuration coexist.
- Protected read operation.
- Protected mutation with denied confirmation.
- Protected mutation with explicit `--yes`.
- Project root is discovered from a nested working directory.
- `start` runs outside a project.
- `status` or `doctor` runs without an environment.
- Vault access is attempted before resolution.

## Traceability Expectations

Each requirement SHALL later map through:

```text
ENV requirement
    -> Design decision
    -> Atomic task
    -> Implementation
    -> Focused test
    -> Evidence artifact
    -> Gate result
```

The future test matrix SHALL cover all required scenarios in this Specification. Infrastructure-dependent evidence SHALL distinguish `IMPLEMENTED`, `TESTED`, `NOT_TESTED` and `BLOCKED`.

## Requirement Traceability

The future Design and Tasks phases SHALL maintain one traceability row for each `ENV-*` requirement:

| Requirement | Design | Task | Test | Evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| ENV-001 | Pending | Pending | Pending | Pending | Pending |
| ENV-002 | Pending | Pending | Pending | Pending | Pending |
| ENV-003 | Pending | Pending | Pending | Pending | Pending |
| ENV-004 | Pending | Pending | Pending | Pending | Pending |
| ENV-005 | Pending | Pending | Pending | Pending | Pending |
| ENV-006 | Pending | Pending | Pending | Pending | Pending |
| ENV-007 | Pending | Pending | Pending | Pending | Pending |
| ENV-008 | Pending | Pending | Pending | Pending | Pending |
| ENV-009 | Pending | Pending | Pending | Pending | Pending |
| ENV-010 | Pending | Pending | Pending | Pending | Pending |
| ENV-011 | Pending | Pending | Pending | Pending | Pending |
| ENV-012 | Pending | Pending | Pending | Pending | Pending |
| ENV-013 | Pending | Pending | Pending | Pending | Pending |
| ENV-014 | Pending | Pending | Pending | Pending | Pending |
| ENV-015 | Pending | Pending | Pending | Pending | Pending |
| ENV-016 | Pending | Pending | Pending | Pending | Pending |
| ENV-017 | Pending | Pending | Pending | Pending | Pending |
| ENV-018 | Pending | Pending | Pending | Pending | Pending |
| ENV-019 | Pending | Pending | Pending | Pending | Pending |
| ENV-020 | Pending | Pending | Pending | Pending | Pending |
| ENV-021 | Pending | Pending | Pending | Pending | Pending |
| ENV-022 | Pending | Pending | Pending | Pending | Pending |
| ENV-023 | Pending | Pending | Pending | Pending | Pending |
| ENV-024 | Pending | Pending | Pending | Pending | Pending |
| ENV-025 | Pending | Pending | Pending | Pending | Pending |
| ENV-026 | Pending | Pending | Pending | Pending | Pending |
| ENV-027 | Pending | Pending | Pending | Pending | Pending |
| ENV-028 | Pending | Pending | Pending | Pending | Pending |
| ENV-029 | Pending | Pending | Pending | Pending | Pending |
| ENV-030 | Pending | Pending | Pending | Pending | Pending |

## Success Criteria

The Specification is ready for Design when:

- all environment resolution precedence rules are explicit;
- no silent development fallback exists;
- configuration consistency is testable;
- active context is metadata-only and local-only;
- protected environment semantics distinguish reads and mutations;
- legacy compatibility and coexistence are deterministic;
- all affected commands use one resolver;
- `--force` is scoped to one environment;
- security requirements prevent cross-project and cross-environment access;
- all requirements have unique `ENV-*` IDs;
- traceability targets are defined;
- no existing feature artifact is modified.

## Assumptions & Open Questions

Assumptions:

| Assumption | Chosen default | Rationale |
| --- | --- | --- |
| Active context location | `.devvault/context.json` | Local-only metadata and clear project boundary |
| Environment command namespace | `devvault environment ...` | Explicit domain namespace and future extensibility |
| Resolution precedence | explicit override, active context, error | Prevents ambiguity and silent fallback |
| Protected environment marker | explicit `protected: true` | Avoids unsafe name-based inference |
| Legacy migration | read-compatible, explicit future migration | Prevents silent file movement or data loss |
| New model location | `environments/<name>/devvault.yaml` | Independent configuration per environment |
| Context gitignore | add `.devvault/` idempotently | Prevents local context commits without changing existing rules |
| Protected `--yes` | explicit only | Prevents implicit automation authorization |

Open questions:

1. Should `protected` be allowed in the YAML only, or also in a project-level environment registry?
2. Should `environment list` include legacy single-environment projects as a synthetic environment?
3. Should a new-model project without active context automatically select the only available environment, or must selection always be explicit? This Specification currently requires explicit selection when no context exists.
4. Should `start` set an active environment automatically when exactly one environment exists? This Specification currently says it must not silently select one.
5. Should `init-project` create `.devvault/context.json` automatically for the first environment? The implementation Design must decide while preserving no-fallback semantics.
6. Should protected mutation confirmation be implemented in Core consent services or a dedicated environment protection port?
7. Should legacy configuration be considered protected when its YAML has no `protected` field?

## Recommended TLC Feature Boundary

This feature is larger than an `init-project` change and SHALL be implemented as:

```text
.specs/features/devvault-multi-environment/
├── spec.md
├── design.md
├── tasks.md
└── validation.md
```

Only `spec.md` is created in the Specification phase. Design, Tasks and implementation require separate explicit authorization.

## Specification Gate Recommendation

**Recommendation:** PASS WITH CHANGES.

The feature boundary, requirements, resolution semantics, security model, compatibility strategy and traceability expectations are defined. Design must resolve the listed open questions before implementation, especially whether a single available environment may become active automatically and how `protected` metadata is represented beyond YAML.
