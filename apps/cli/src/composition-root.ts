import { UserpassAuthenticationProvider } from '@devvault/auth';
import { CapabilityBackendSelector, DefaultDeveloperLifecycleService, ProfileSetupValidator } from '@devvault/core';
import { loadProjectConfig, resolveEnvironmentContext } from '@devvault/config';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createProjectApplicationService } from './application-adapters.js';
import {
  detectPlatform,
  DockerComposeManager,
  FileSetupStateStore,
  KeytarCredentialStore,
  LocalDockerVaultBackend,
  LocalVaultLifecycleAdapter,
  LocalBootstrapMaterialFileStore,
  PlatformDependencyChecker,
  RemoteVaultBackend,
  defaultSetupStatePath,
} from '@devvault/platform';
import { HttpVaultClient } from '@devvault/vault-client';

export type ReturnTypeOfComposition = ReturnType<typeof createCompositionRoot>;

export async function loadProjectContext(
  directory = process.cwd(),
  resolver: typeof resolveEnvironmentContext = resolveEnvironmentContext,
): Promise<{ name: string; environment: string } | null> {
  try {
    const context = await resolver(directory, undefined, { mode: 'diagnostic', allowCandidateRoot: true });
    return context.config ? { name: context.config.project, environment: context.config.environment } : null;
  } catch {
    return null;
  }
}

export function createCompositionRoot() {
  const credentialStore = new KeytarCredentialStore();
  const docker = new DockerComposeManager();
  const platform = detectPlatform();
  const setupStateStore = new FileSetupStateStore({ statePath: defaultSetupStatePath() });
  const setupDependencyChecker = new PlatformDependencyChecker();
  const setupConsent = { request: async () => process.env.DEVAULT_SETUP_YES === '1' ? 'approved' as const : 'denied' as const };
  const lifecycleConsent = { request: async () => 'approved' as const };
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
  const composeCandidates = [
    process.env.DEVAULT_COMPOSE_FILE,
    fileURLToPath(new URL('../../../infra/vault/docker-compose.yml', import.meta.url)),
    fileURLToPath(new URL('../infra/vault/docker-compose.yml', import.meta.url)),
  ].filter((value): value is string => Boolean(value));
  const setupComposeFile = composeCandidates.find((value) => existsSync(value)) ?? composeCandidates[0];
  const localLifecycle = new LocalVaultLifecycleAdapter({
    docker,
    vault: setupVault,
    composeFile: setupComposeFile,
  });
  const bootstrapStore = new LocalBootstrapMaterialFileStore(docker);
  const lifecycleService = new DefaultDeveloperLifecycleService({
    backendSelector: setupBackendSelector,
    localBackend: setupLocalBackend,
    remoteBackend: setupRemoteBackend,
    localLifecycle,
    bootstrapStore,
    projectContext: { load: async () => loadProjectContext() },
    sessionStore: credentialStore,
    stateStore: setupStateStore,
    consent: lifecycleConsent,
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
    createLocalDeveloperUser: async (username: string, password: string) => {
      const material = await bootstrapStore.load();
      if (!material) throw new Error('Local DevVault bootstrap material is unavailable. Run devvault start first.');
      setupVault.setToken(material.rootToken);
      await setupVault.ensureUserpass();
      const config = await loadProjectConfig(process.cwd());
      await setupVault.createUserpassUser(username, password, [`devvault-${config.project}-${config.environment}-developer`]);
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