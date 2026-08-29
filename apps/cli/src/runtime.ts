import type { ProjectConfig } from '@devvault/config';
import { spawn } from 'node:child_process';
import type { SecretData } from '@devvault/vault-client';
import { classifyVaultOperationError } from '@devvault/core';

export interface RuntimeSecretClient {
  readSecret(mount: string, path: string): Promise<SecretData>;
}

export async function resolveRuntimeEnvironment(
  config: ProjectConfig,
  client: RuntimeSecretClient,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  let data: SecretData;
  try {
    data = await client.readSecret(config.vault.mount, config.vault.path);
  } catch (error) {
    classifyVaultOperationError(error, { operation: 'run', project: config.project, environment: config.environment });
  }
  const environment = { ...baseEnvironment };

  for (const [environmentName, secretPath] of Object.entries(config.runtime.mappings)) {
    const value = readNestedValue(data, secretPath);
    if (value === undefined) {
      throw new Error(`Secret not found for environment mapping: ${environmentName}`);
    }
    environment[environmentName] = value;
  }

  return environment;
}

export function launchProcess(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: 'inherit',
    });

    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.once('SIGINT', forwardSignal);
    process.once('SIGTERM', forwardSignal);

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forwardSignal);
      process.removeListener('SIGTERM', forwardSignal);
      resolve(code ?? (signal ? 1 : 1));
    });
  });
}

function readNestedValue(data: SecretData, path: string): string | undefined {
  let current: unknown = data;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}