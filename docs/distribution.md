# Standalone Distribution Evaluation

**Date:** 2026-08-13
**Scope:** Phase 0 design decision only
**Status:** Deferred implementation

DevVault currently runs as a Node.js/pnpm workspace application. Phase 0 does not produce binaries, change the package manager workflow, or add a compiler dependency. This document records the distribution options that should be revisited before user-facing packaging.

## Decision Summary

Node SEA (Single Executable Applications) is the recommended direction for a future first-party distribution, subject to a proof of concept on the supported release Node versions. It is closest to the current Node runtime, avoids adopting an abandoned or third-party runtime model, and can preserve the existing TypeScript-to-JavaScript build boundary.

The decision is deferred. No option is production-ready for DevVault until native keyring loading, Docker invocation, signing, update delivery and reproducible release artifacts are tested on the target platforms.

## Evaluation Criteria

| Criterion | Node SEA | pkg | nexe | Bun compiled |
|---|---|---|---|---|
| Target platforms | Strong alignment with Node-supported Linux, Windows and macOS releases; each target executable must be built/tested for its platform | Historically broad Node targets, but compatibility depends on the selected pkg base binary and project maintenance | Platform-specific builds and native compilation add release work | Linux, Windows and macOS are targets, but runtime compatibility differs from Node |
| Native keyring | Must verify `keytar` native module loading in the executable; likely requires explicit asset/native-module handling | Native modules commonly need explicit packaging and may require target-specific workarounds | Native modules require compilation and bundling rules per target | `keytar` and Node-API compatibility must be proven; not assumed from Node compatibility |
| Signing | Uses normal platform signing/notarization after the executable is produced | Same signing requirement, plus confidence in the chosen base binary | Same signing requirement, with an additional native build toolchain | Same signing requirement, with Bun-specific build output validation |
| Updates | Requires an application-level download, verification and replacement strategy | Requires the same update system and a pinned packaging toolchain | Requires the same update system and toolchain maintenance | Requires the same update system and Bun runtime compatibility policy |
| Reproducibility | Favourable if Node version, build inputs and post-processing are pinned; needs binary reproducibility tests | Depends on archived base binaries, tool version and asset ordering | Depends on compiler/toolchain versions and target environment | Depends on Bun version and compiler output stability |
| Docker integration | Best fit: continue invoking the host Docker CLI as today | Should work if child-process APIs and PATH behavior are preserved; must test packaged path handling | Same child-process and PATH tests required | Must verify Node API, subprocess behavior and Windows/WSL handling |
| Support cost | Lowest conceptual migration cost because the application remains Node-based; native modules remain the main risk | High risk from tool/base-binary lifecycle and native-module edge cases | High build and maintenance cost; requires a native toolchain | Medium to high cost from maintaining a second runtime compatibility matrix |

## Platform and Runtime Constraints

The standalone artifact must preserve these boundaries:

- Vault tokens and secret values must not be embedded in the executable or installer.
- `devvault.yaml` remains non-sensitive project configuration only.
- Setup state remains in the user configuration directory, never beside the project executable by default.
- Docker Desktop installation or modification remains blocked by policy; packaging must not add an installer shortcut.
- The executable must continue to support explicit Vault endpoints without credentials in URLs.
- WSL2 and PowerShell bridge behavior must be tested separately from native Windows execution.
- The release process must record the exact Node/Bun/compiler, OS, architecture and native dependency inputs.

## Candidate Assessments

### Node SEA

**Advantages:** Keeps the existing Node execution model, TypeScript output, child-process behavior and platform adapters. It is the most conservative path for a CLI whose important integrations are HTTP, Docker CLI and native keyring access.

**Risks:** Native `keytar` loading and asset inclusion must be proven. SEA artifacts are target-specific and still require platform signing, notarization where applicable, update verification and release hosting.

**Recommendation:** Preferred candidate for a future proof of concept.

### pkg

**Advantages:** Familiar CLI packaging model and historically simple single-file workflows.

**Risks:** The project must pin the tool and its base binary behavior. Native modules, dynamic imports and filesystem assets require explicit packaging tests. The maintenance and Node-version support outlook increases long-term support risk.

**Recommendation:** Keep as a compatibility benchmark only unless SEA cannot package the native keyring boundary.

### nexe

**Advantages:** Produces self-contained executables through a native-oriented build approach and can offer detailed control over the embedded runtime.

**Risks:** Higher compiler/toolchain cost, target-specific builds and native dependency complexity. It would add a second build system without reducing the need for signing, updates or platform validation.

**Recommendation:** Do not select for the first distribution experiment.

### Bun compiled

**Advantages:** Compact distribution workflow and a potentially simple compiled artifact.

**Risks:** DevVault is currently Node-based and depends on Node ecosystem behavior, native keyring support, Commander, child processes and WSL/Windows integration. Bun compatibility would be a separate runtime support commitment, not merely a packaging change.

**Recommendation:** Treat as a separate runtime port, not the default packaging path.

## Deferred Proof of Concept

Before selecting a production packaging path, create a disposable branch or experiment that validates:

1. Build the CLI for Linux x64, Windows x64 and macOS arm64/x64 as applicable.
2. Load and use the native keyring adapter without bundling credentials.
3. Execute Docker Compose discovery and child-process forwarding.
4. Resolve the packaged setup-state path correctly.
5. Run `setup --check --json` with sanitized output and correct exit codes.
6. Verify WSL2 and PowerShell bridge behavior separately from native Windows.
7. Sign artifacts and verify signatures in CI.
8. Rebuild from pinned inputs and compare release metadata/checksums.
9. Define a signed update manifest with rollback behavior.
10. Scan the executable, installer and update artifacts for secret material.

No production packaging decision should be marked complete until these checks have evidence for every supported platform. Native Windows remains untested in the current repository evidence.

## Final Decision

**Recommended future path:** Node SEA, after the proof of concept above.

**Deferred:** Production standalone binaries, installers, auto-update implementation, signing automation and any change to the current Node/pnpm development workflow.
