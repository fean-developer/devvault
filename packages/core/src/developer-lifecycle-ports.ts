import type { SetupResultStatus } from './setup-model.js';
import type { SetupMetadata } from './setup-steps.js';
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
  initialize?(): Promise<LocalBootstrapMaterial>;
  useBootstrapMaterial?(material: LocalBootstrapMaterial): void;
  unseal(material: LocalBootstrapMaterial): Promise<void>;
  configure?(project: { name: string; environment: string }): Promise<void>;
}

export interface ProjectContextProvider {
  load(): Promise<{ name: string; environment: string }>;
}

export interface LocalBootstrapMaterial {
  rootToken: string;
  unsealKey: string;
}

export interface LocalBootstrapMaterialStore {
  load(): Promise<LocalBootstrapMaterial | null>;
  save(material: LocalBootstrapMaterial): Promise<void>;
}

/** @deprecated V1 no longer asks developers for bootstrap material. */
export interface EphemeralSecretInput {
  read(prompt: string): Promise<string>;
}

export interface DeveloperLifecycleService {
  start(input: StartInput): Promise<LifecycleResult>;
  status(input: StatusInput): Promise<LifecycleResult>;
}