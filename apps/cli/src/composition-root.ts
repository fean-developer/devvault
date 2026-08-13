import { UserpassAuthenticationProvider } from '@devvault/auth';
import { CapabilityBackendSelector, DefaultDeveloperLifecycleService, ProfileSetupValidator } from '@devvault/core';
import { fileURLToPath } from 'node:url';
import { createProjectApplicationService } from './application-adapters.js';
import { readSecretFromProcess } from './input.js';
import {
  detectPlatform,
  DockerComposeManager,
  FileSetupStateStore,
  KeytarCredentialStore,
  LocalDockerVaultBackend,
  LocalVaultLifecycleAdapter,
  PlatformDependencyChecker,
  RemoteVaultBackend,
  defaultSetupStatePath,
} from '@devvault/platform';
import { HttpVaultClient } from '@devvault/vault-client';

export type ReturnTypeOfComposition = ReturnType<typeof createCompositionRoot>;

export function createCompositionRoot() {
  const credentialStore = new KeytarCredentialStore();
  const docker = new DockerComposeManager();
  const platform = detectPlatform();
  const setupStateStore = new FileSetupStateStore({ statePath: defaultSetupStatePath() });
  const setupDependencyChecker = new PlatformDependencyChecker();
  const setupConsent = { request: async () => process.env.DEVAULT_SETUP_YES === '1' ? 'approved' as const : 'denied' as const };
  const setupVault = new HttpVaultClient({
    address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
    token: process.env.VAULT_TOKEN,
  });
  const setupLocalBackend = new LocalDockerVaultBackend({ docker, vault: setupVault });
  const setupRemoteBackend = process.env.DEVAULT_REMOTE_ADDR
    ? new RemoteVaultBackend({ address: process.env.DEVAULT_REMOTE_ADDR, client: setupVault })
    : undefined;
  const setupBackendSelector = new CapabilityBackendSelector();
  const setupValidator = new ProfileSetupValidator({
    collect: async (context) => ({
      capabilities: {
        platform: context.metadata.platform !== 'unknown',
        backend: typeof context.metadata.backend === 'string',
        'vault-lifecycle': ['configured', 'ready'].includes(String(context.metadata.vaultLifecycle)),
        kv: context.metadata.kv === true,
        'setup-state': true,
      },
      blockers: [],
      warnings: [],
      metadata: context.metadata,
    }),
  });
  const setupComposeFile = process.env.DEVAULT_COMPOSE_FILE
    ?? fileURLToPath(new URL('../../../infra/vault/docker-compose.yml', import.meta.url));
  const localLifecycle = new LocalVaultLifecycleAdapter({
    docker,
    vault: setupVault,
    composeFile: setupComposeFile,
  });
  const lifecycleService = new DefaultDeveloperLifecycleService({
    backendSelector: setupBackendSelector,
    localBackend: setupLocalBackend,
    remoteBackend: setupRemoteBackend,
    localLifecycle,
    secretInput: { read: readSecretFromProcess },
    stateStore: setupStateStore,
    consent: setupConsent,
  });

  return {
    credentialStore,
    docker,
    platform,
    setupStateStore,
    setupDependencyChecker,
    setupConsent,
    setupBackendSelector,
    setupLocalBackend,
    setupRemoteBackend,
    setupValidator,
    lifecycleService,
    startLocalVault: () => docker.composeUp(setupComposeFile),
    createVaultClient: async () => {
      let session: string | null = null;
      try {
        session = await credentialStore.get('session');
      } catch {
        session = null;
      }
      return new HttpVaultClient({
        address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
        token: process.env.VAULT_TOKEN ?? session ?? undefined,
      });
    },
    createDeveloperAuthentication: () => {
      return new UserpassAuthenticationProvider(new HttpVaultClient({
        address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
        token: process.env.VAULT_TOKEN,
      }));
    },
    createProjectApplication: async () => {
      return createProjectApplicationService(await (async () => {
        let session: string | null = null;
        try {
          session = await credentialStore.get('session');
        } catch {
          session = null;
        }
        return new HttpVaultClient({
          address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
          token: process.env.VAULT_TOKEN ?? session ?? undefined,
        });
      })());
    },
  };
}