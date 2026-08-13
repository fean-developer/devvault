import type { VaultBackend } from './vault-backend.js';
import type { ReadinessProfile } from './setup-model.js';
import type { SetupContext, SetupExecutionResult, SetupMetadata, SetupStep } from './setup-steps.js';
import type { ConsentRequest, ConsentDecision, InstallationRequest, InstallationResult } from './consent.js';
import type { SetupResultStatus } from './setup-model.js';

export type { ConsentRequest, ConsentDecision, InstallationRequest, InstallationResult } from './consent.js';

export interface DependencyCheckInput {
  profile: ReadinessProfile;
  metadata?: SetupMetadata;
}

export interface DependencyReport {
  capabilities: Record<string, boolean>;
  blockers: string[];
  warnings: string[];
  metadata: SetupMetadata;
}

export interface DependencyChecker {
  check(input: DependencyCheckInput): Promise<DependencyReport>;
}

export interface ConsentService {
  request(request: ConsentRequest): Promise<ConsentDecision>;
}

export interface InstallationManager {
  install(request: InstallationRequest): Promise<InstallationResult>;
}

export interface BackendSelectionInput {
  preferred?: 'local-docker' | 'remote-vault';
  local: VaultBackend;
  remote?: VaultBackend;
}

export interface BackendSelectionResult {
  backend?: VaultBackend;
  blockers: string[];
  metadata: SetupMetadata;
}

export interface BackendSelector {
  select(input: BackendSelectionInput): Promise<BackendSelectionResult>;
}

export interface ValidationReport {
  status: SetupResultStatus;
  capabilities: Record<string, boolean>;
  blockers: string[];
  warnings: string[];
  metadata: SetupMetadata;
}

export interface SetupValidator {
  validate(context: SetupContext): Promise<ValidationReport>;
}

export interface SetupOrchestrator {
  setup(context: SetupContext, steps: readonly SetupStep[]): Promise<SetupExecutionResult>;
  check(context: Omit<SetupContext, 'mode'>, steps: readonly SetupStep[]): Promise<SetupExecutionResult>;
  repair(context: Omit<SetupContext, 'mode'>, steps: readonly SetupStep[]): Promise<SetupExecutionResult>;
}