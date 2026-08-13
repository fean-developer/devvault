import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CredentialStore } from '@devvault/core';
import { diagnoseDocker, type DockerDiagnostics } from './docker-diagnostics.js';

export * from './platform-detection.js';
export * from './path-adapter.js';
export * from './docker-diagnostics.js';
export * from './setup-dependencies.js';
export * from './local-docker-vault-backend.js';
export * from './remote-vault-backend.js';
export * from './setup-state-store.js';
export * from './local-vault-lifecycle.js';

const execFileAsync = promisify(execFile);

export interface DockerManager {
  composeUp(composeFile: string): Promise<void>;
  isAvailable(): Promise<boolean>;
  diagnose(): Promise<DockerDiagnostics>;
}

export class DockerComposeManager implements DockerManager {
  async composeUp(composeFile: string): Promise<void> {
    await execFileAsync('docker', ['compose', '-f', composeFile, 'up', '-d']);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('docker', ['compose', 'version']);
      return true;
    } catch {
      return false;
    }
  }

  async diagnose(): Promise<DockerDiagnostics> {
    return diagnoseDocker({
      run: async (command, args) => {
        const result = await execFileAsync(command, args);
        return { stdout: result.stdout, stderr: result.stderr };
      },
    });
  }
}

interface KeytarApi {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export function resolveKeytarModule(module: KeytarApi | { default: KeytarApi }): KeytarApi {
  return 'default' in module ? module.default : module;
}

export class KeytarCredentialStore implements CredentialStore {
  constructor(private readonly service = 'devvault') {}

  async get(key: string): Promise<string | null> {
    const keytar = resolveKeytarModule(await import('keytar'));
    return keytar.getPassword(this.service, key);
  }

  async set(key: string, value: string): Promise<void> {
    const keytar = resolveKeytarModule(await import('keytar'));
    await keytar.setPassword(this.service, key, value);
  }

  async delete(key: string): Promise<void> {
    const keytar = resolveKeytarModule(await import('keytar'));
    await keytar.deletePassword(this.service, key);
  }
}