# NPM Binary Publish Fix - 2026-08-14

## Context

The package `@fean-developer/devvault-cli@0.1.12-alpha.1` was installed globally with:

```bash
npm i -g @fean-developer/devvault-cli@0.1.12-alpha.1
```

The installation completed, but the `devvault` command was not available.

## Diagnosis

The published `0.1.12-alpha.1` tarball contains the monorepo root manifest, not the generated `.npm-dist` manifest.

Evidence from the registry package:

- `package.json` has no `bin.devvault` entry.
- The tarball contains 136 files, matching a root publish instead of the small public package.
- The root manifest was publishable, so `npm publish` from the wrong directory could create a package that installs without exposing a CLI command.

Because npm package versions are immutable, `0.1.12-alpha.1` cannot be repaired in place.

## Decision

Release a corrected package as `0.1.12-alpha.2`.

Keep the monorepo root package private to block accidental root publishing. The public package remains generated under `.npm-dist` and published from that directory only.

## Implemented Safeguards

- Root `package.json` is `private: true`.
- `npm run package:npm` now builds `.npm-dist` and runs `scripts/verify-npm-package.mjs`.
- The verifier checks that `.npm-dist/package.json` exposes `bin.devvault` as `dist/index.js`.
- The verifier packs the generated package, installs it locally, and executes `devvault --version`.
- The verifier also installs the tarball globally using a temporary npm prefix and executes the global `devvault --version` command.

## Validation

Executed:

```bash
npm run package:npm
npm run pack:npm
tar -xOf .npm-dist/fean-developer-devvault-cli-0.1.12-alpha.2.tgz package/package.json
```

Result:

- Package verification passed for `@fean-developer/devvault-cli@0.1.12-alpha.2`.
- The generated tarball contains 11 files.
- The generated tarball manifest includes:
  - `bin.devvault = dist/index.js`
  - `dependencies.keytar`
  - `infra/vault/**`

## User Guidance

Do not use `0.1.12-alpha.1`.

After publishing `0.1.12-alpha.2`, install with:

```bash
npm uninstall -g @fean-developer/devvault-cli
npm i -g @fean-developer/devvault-cli@0.1.12-alpha.2
devvault --version
devvault doctor
```

If the command is still not found after a corrected package install, verify that the npm global bin directory is on `PATH`:

```bash
npm config get prefix
```