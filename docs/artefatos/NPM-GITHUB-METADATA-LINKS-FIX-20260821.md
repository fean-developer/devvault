# NPM GitHub Metadata and Documentation Links Fix

Date: 2026-08-21

## Context

The npm package page did not show GitHub repository information even though the repository was present in the source `package.json`. Documentation links from the npm README also opened npm scoped-package routes and returned 404.

## Decision

Keep the generated `.npm-dist/package.json` as the publish source, but propagate public GitHub metadata into it:

- `repository`
- `homepage`
- `bugs`

Use absolute GitHub URLs for documentation links in the README published to npm.

## Validation Strategy

The npm package verification now checks that `.npm-dist/package.json` contains the GitHub metadata and that the published README contains public documentation links. The normal package command still builds, packs, installs and executes the CLI from the generated artifact.

## Security Impact

No secret, authentication, Vault lifecycle or runtime process behavior was changed. The change is limited to public package metadata and public documentation links.

## Architecture Impact

No architecture invariant is changed. CLI, application, ports, adapters and Vault boundaries remain untouched.