# DevVault Local Developer Lifecycle Validation

**Date**: 2026-08-13  
**Baseline**: `f037168` (`test(lifecycle): close recovery evidence`)  
**Reviewed**: `spec.md`, `design.md`, `tasks.md`, `AGENTS.md`, architecture invariants, lifecycle source and tests  
**Verifier**: independent final verification; source, spec, design and tasks were not modified

## Validation

**Verdict: PASS WITH WARNINGS**
**Result:** PASS WITH WARNINGS

Evidence: `packages/core/src/developer-lifecycle.ts:151` persists only validated allowlisted lifecycle state; `tests/e2e/devvault-local-lifecycle.test.ts:25` exercises the compiled production CLI entrypoint.

All implemented V1 requirements have executable evidence on `f037168`. Warnings are limited to out-of-scope or infrastructure-dependent checks recorded as `Evidence: ZERO`; they do not represent missing acceptance evidence for the implemented scope.

## Gates

| Command | Result | Evidence |
| --- | --- | --- |
| `corepack pnpm test` | **PASS** | 39 files, 165 tests |
| `corepack pnpm typecheck` | **PASS** | TypeScript completed with exit code 0 |
| `corepack pnpm lint` | **PASS** | ESLint completed with exit code 0 |
| `corepack pnpm build` | **PASS** | All workspace packages and compiled CLI completed successfully |

The production-path E2E test executed `apps/cli/dist/index.js --help` and observed the public `start` command.

## Requested Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Production start registration | **PASS** | `apps/cli/src/index.ts` registers `registerStartCommand`; compiled production E2E observes `start` |
| Consent denial | **PASS** | `packages/core/src/developer-lifecycle.test.ts` asserts `BLOCKED`, one consent request and zero local start calls |
| `SetupStateStore` persistence | **PASS** | Core test asserts `READY` state is saved with lifecycle metadata and excludes `token` and `unsealKey` |
| `NOT_INITIALIZED` remains `BLOCKED` | **PASS** | Core test asserts the blocked result and no initialization/persistence credential path exists |
| Recovery boundary | **PASS** | Commit adds local-start failure mapping to `BLOCKED` without save, and corrupt state returns `FAILED` before mutation |
| Security boundary | **PASS** | E2E tests sanitize human/JSON output and exclude ephemeral key material from output, argv and persisted project state |
| Status read-only | **PASS** | Core test asserts zero local start and unseal calls |
| Remote read-only sealed handling | **PASS** | Core test asserts remote sealed result is `BLOCKED` and does not invoke local unseal |

## Mutation Sensor

All mutations ran in detached temporary worktrees based on `f037168`; no mutation touched the real tree. Each changed file was verified as modified before its discriminating test ran. Temporary worktrees were removed after execution.

| Mutation | Detection | Result |
| --- | --- | --- |
| Remove production `registerStartCommand` from `apps/cli/src/index.ts` | Build plus production lifecycle E2E | **KILLED** |
| Approve local-start consent unconditionally | Core lifecycle tests | **KILLED** |
| Return `result` instead of persisting through `persistResult` | Core lifecycle tests | **KILLED** |
| Change `NOT_INITIALIZED` result from `BLOCKED` to `READY` | Core lifecycle tests | **KILLED** |
| Remove blocker sanitization from `start` output | CLI and lifecycle E2E tests | **KILLED** |

**Mutation result: 5/5 killed, 0 survived.**

## Evidence Or Zero

### Evidence

- Implemented V1 lifecycle branches exercised by the full suite: ready, stopped local backend, consent denial, sealed interactive and non-interactive handling, uninitialized blocking, unavailable start failure, corrupt state, remote sealed read-only behavior and mandatory capability blocking.
- Production command registration and composition path are exercised after build.
- Credential non-disclosure is tested for human output, JSON output, process arguments and persisted project state.
- State persistence uses the existing `SetupStateStore`; no second lifecycle state model or bootstrap credential persistence was introduced.
- `devvault stop`, automatic initialization, AppRole/OIDC, native Windows execution and live Docker/Vault restart persistence are outside the implemented V1 verification scope.

### Evidence: ZERO

- No live operator unseal was executed because unseal material is intentionally unavailable to this verification.
- No native Windows or Docker Desktop environment was available for execution.
- No live owned Vault data/policy preservation test was run after a real Docker/Vault restart.
- No dedicated aggregate scan covered stderr, logs, exceptions, filesystem temporary files and shell history in one lifecycle test; the implemented output/argv/project-state boundaries are covered individually.

## Architecture and Scope Review

The implementation preserves the CLI -> application service -> ports -> adapters boundary, keeps platform behavior outside Core, retains `SetupStateStore` as the sole lifecycle metadata store, keeps remote lifecycle read-only, and leaves `stop` deferred. No architecture invariant, spec, design or task artifact required modification.

## Real-Tree Integrity

Mutation cleanup completed with `TEMP_WORKTREE_REMOVED=yes`. The real-tree status after verification is:

```text
 M .github/prompts/alteracao-escopo.prompt.md
 M infra/vault/docker-compose.yml
 M packages/platform/src/index.test.ts
?? .specs/LESSONS.md
?? .specs/features/devvault-local-lifecycle/validation.md
?? .specs/lessons.json
```

The unrelated pre-existing changes remain untouched. The only file modified by this verification is `.specs/features/devvault-local-lifecycle/validation.md`; no source, `spec.md`, `design.md` or `tasks.md` modification is needed.

## Recommendation

**READY FOR NEXT PHASE**, subject to the warnings above remaining explicitly out of scope or environment-dependent.