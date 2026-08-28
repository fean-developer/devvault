export * from './errors.js';
export * from './application.js';
export * from './lifecycle.js';
export * from './setup-model.js';
export * from './vault-backend.js';
export * from './vault-lifecycle.js';
export * from './setup-steps.js';
export * from './setup-ports.js';
export * from './setup-state.js';
export * from './setup-state-store.js';
export * from './consent.js';
export * from './backend-selector.js';
export * from './setup-validator.js';
export * from './setup-orchestrator.js';
export * from './developer-lifecycle-ports.js';
export * from './developer-lifecycle.js';
export * from './session-model.js';
export * from './session-errors.js';
export * from './session-resolver.js';
export * from './login-service.js';
export * from './logout-service.js';

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