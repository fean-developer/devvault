export * from './errors.js';
export * from './application.js';
export * from './lifecycle.js';
export * from './setup-model.js';
export * from './vault-backend.js';
export * from './vault-lifecycle.js';

export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface VaultClient {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
}

export interface ProcessLauncher {
  run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<number>;
}