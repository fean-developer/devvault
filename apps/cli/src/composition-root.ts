import { UserpassAuthenticationProvider } from '@devvault/auth';
import { createProjectApplicationService } from './application-adapters.js';
import {
  detectPlatform,
  DockerComposeManager,
  FileSetupStateStore,
  KeytarCredentialStore,
  PlatformDependencyChecker,
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

  return {
    credentialStore,
    docker,
    platform,
    setupStateStore,
    setupDependencyChecker,
    setupConsent,
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