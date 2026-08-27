import { loadProjectConfig, resolveEnvironmentContext } from '@devvault/config';
import { deleteSecret, getSecret, listSecretKeys, setSecret } from './secrets.js';
import { launchProcess, resolveRuntimeEnvironment } from './runtime.js';
import { ProjectApplicationService } from '@devvault/core';
import type { ProjectConfig } from '@devvault/config';
import type { HttpVaultClient } from '@devvault/vault-client';

export function createProjectApplicationService(client: HttpVaultClient): ProjectApplicationService {
  return new ProjectApplicationService(
    {
      load: async (directory: string, environment?: string) => {
        const context = await resolveEnvironmentContext(directory, environment);
        if (context.state !== 'CONFIGURED' || !context.config) {
          throw new Error('Environment configuration is required.');
        }
        return context.config;
      },
    },
    {
      set: (config: ProjectConfig, key: string, value: string) => setSecret(config, client, key, value),
      get: (config: ProjectConfig, key: string) => getSecret(config, client, key),
      list: (config: ProjectConfig) => listSecretKeys(config, client),
      delete: (config: ProjectConfig, key: string) => deleteSecret(config, client, key),
    },
    {
      run: async (config: ProjectConfig, command: string, args: string[]) => {
        const environment = await resolveRuntimeEnvironment(config, client);
        return launchProcess(command, args, environment);
      },
    },
  );
}