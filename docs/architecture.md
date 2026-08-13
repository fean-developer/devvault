# Architecture

DevVault separates the CLI from application services, contracts, configuration and Vault transport.

```text
CLI -> application services -> ports
                         |- config loader
                         |- Vault client
                         |- credential store
                         `- process launcher
```

`@devvault/core` owns stable interfaces and error types. `@devvault/config` parses non-sensitive project configuration. `@devvault/vault-client` owns HTTP details and maps authentication, permission and availability failures to domain errors.

Project secret and runtime orchestration is exposed through `ProjectApplicationService`. The CLI composition root injects configuration, Vault and process adapters into this service; the Core package does not depend on the config or Vault adapter packages.

Vault lifecycle classification lives in `@devvault/core`. Docker Compose execution lives in `@devvault/platform` behind `DockerManager`; the CLI does not invoke Docker directly.

The CLI composition root in `apps/cli/src/composition-root.ts` is the only assembly boundary for concrete Vault, platform, authentication and application adapters. `CredentialStore` is a Core port; Keytar is a platform adapter.

CLI behavior is split into dedicated modules under `apps/cli/src/commands/`; `index.ts` does not own command business logic.