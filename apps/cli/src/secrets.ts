import type { ProjectConfig } from '@devvault/config';
import type { SecretData } from '@devvault/vault-client';
import { classifyVaultOperationError } from '@devvault/core';

export interface SecretClient {
  readSecret(mount: string, path: string): Promise<SecretData>;
  writeSecret(mount: string, path: string, data: SecretData): Promise<void>;
  listSecrets(mount: string, path: string): Promise<string[]>;
  deleteSecret(mount: string, path: string): Promise<void>;
}

export function secretPath(config: ProjectConfig): { mount: string; path: string } {
  return { mount: config.vault.mount, path: config.vault.path };
}

export async function setSecret(
  config: ProjectConfig,
  client: SecretClient,
  key: string,
  value: string,
): Promise<void> {
  const location = secretPath(config);
  const data = await client.readSecret(location.mount, location.path);
  setNestedValue(data, key, value);
  await client.writeSecret(location.mount, location.path, data);
}

export async function getSecret(
  config: ProjectConfig,
  client: SecretClient,
  key: string,
): Promise<string | undefined> {
  const location = secretPath(config);
  let data: SecretData;
  try {
    data = await client.readSecret(location.mount, location.path);
  } catch (error) {
    classifyVaultOperationError(error, { operation: 'secret.get', project: config.project, environment: config.environment });
  }
  return getNestedValue(data, key);
}

export async function listSecretKeys(
  config: ProjectConfig,
  client: SecretClient,
): Promise<string[]> {
  const location = secretPath(config);
  try {
    return await client.listSecrets(location.mount, location.path);
  } catch (error) {
    classifyVaultOperationError(error, { operation: 'secret.list', project: config.project, environment: config.environment });
  }
}

export async function deleteSecret(
  config: ProjectConfig,
  client: SecretClient,
  key: string,
): Promise<boolean> {
  const location = secretPath(config);
  const data = await client.readSecret(location.mount, location.path);
  const deleted = deleteNestedValue(data, key);
  if (deleted) {
    await client.writeSecret(location.mount, location.path, data);
  }
  return deleted;
}

function setNestedValue(data: SecretData, key: string, value: string): void {
  const parts = key.split('.');
  let current: Record<string, unknown> = data;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) as string] = value;
}

function getNestedValue(data: SecretData, key: string): string | undefined {
  let current: unknown = data;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function deleteNestedValue(data: SecretData, key: string): boolean {
  const parts = key.split('.');
  let current: Record<string, unknown> = data;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return false;
    }
    current = next as Record<string, unknown>;
  }
  const leaf = parts.at(-1) as string;
  if (!(leaf in current)) {
    return false;
  }
  delete current[leaf];
  return true;
}