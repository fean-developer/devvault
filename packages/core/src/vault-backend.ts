import type { VaultHealth, VaultLifecycleState } from './vault-lifecycle.js';

export type VaultBackendKind = 'local-docker' | 'remote-vault';

export interface BackendCapabilities {
  canStart: boolean;
  canConfigure: boolean;
  canValidateKv: boolean;
  canValidatePolicy: boolean;
}

export interface BackendDetection {
  kind: VaultBackendKind;
  available: boolean;
  capabilities: BackendCapabilities;
  detail?: string;
}

export interface BackendValidation {
  lifecycle: VaultLifecycleState;
  kvValid: boolean;
  policyValid: boolean;
  detail?: string;
}

export interface VaultBackend {
  kind(): VaultBackendKind;
  detect(): Promise<BackendDetection>;
  health(): Promise<VaultHealth>;
  validate(capabilities: BackendCapabilities): Promise<BackendValidation>;
}