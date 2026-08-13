import type { SetupMetadata, SetupResultStatus } from './setup-model.js';
import type { VaultHealth, VaultLifecycleState } from './vault-lifecycle.js';

export type LifecycleBackendKind = 'local-docker' | 'remote-vault';
export type LifecycleResultStatus = SetupResultStatus;

export const lifecycleResultStatuses: readonly LifecycleResultStatus[] = [
  'READY',
  'DEGRADED',
  'BLOCKED',
  'FAILED',
];

export interface StartInput {
  mode: 'interactive' | 'non-interactive';
  preferredBackend?: LifecycleBackendKind;
}

export interface StatusInput {
  preferredBackend?: LifecycleBackendKind;
}

export interface LifecycleResult {
  status: LifecycleResultStatus;
  lifecycle: VaultLifecycleState;
  backend: LifecycleBackendKind | null;
  blockers: string[];
  warnings: string[];
  metadata: SetupMetadata;
}

export interface LocalLifecyclePort {
  start(): Promise<void>;
  health(): Promise<VaultHealth>;
  unseal(key: string): Promise<void>;
}

export interface EphemeralSecretInput {
  read(prompt: string): Promise<string>;
}

export interface DeveloperLifecycleService {
  start(input: StartInput): Promise<LifecycleResult>;
  status(input: StatusInput): Promise<LifecycleResult>;
}