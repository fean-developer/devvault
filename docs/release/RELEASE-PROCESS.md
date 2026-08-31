# Release Process

Use this process to publish `@fean-developer/devvault-cli` from a reviewed
release commit.

1. Confirm the version in the root and CLI package manifests is identical.
2. Add the matching top entry to `CHANGELOG.md` and update `RELEASE-NOTES.md`.
3. Run `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm typecheck`,
   and `corepack pnpm build`.
4. Run `corepack pnpm audit --prod` and investigate production dependency
   findings before publishing.
5. Run `corepack pnpm package:npm`; it builds, stages, packs, verifies a clean
   install, and validates the installed CLI version.
6. Inspect the generated tarball in `.npm-dist/` with `tar -tf <tarball>`.
   Confirm it contains `LICENSE`, `README.md`, `RELEASE-NOTES.md`,
   `dist/index.js`, and no `.env`, credential store data, or bootstrap material.
7. Authenticate to the intended npm account, then run `npm publish .npm-dist
   --access public --tag <tag>`.
8. Create and push an annotated Git tag matching the package version only after
   the publish result is confirmed.

## Rollback

Do not unpublish a released version except when required by npm policy or a
security incident. Deprecate the affected version with npm and publish a fixed
version. Revoke exposed credentials and communicate the remediation through
the package release notes and repository security process.