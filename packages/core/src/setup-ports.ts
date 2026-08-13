import type { VaultBackend } from './vault-backend.js';
import type { ReadinessProfile } from './setup-model.js';
import type { SetupContext, SetupExecutionResult, SetupMetadata, SetupStep } from './setup-steps.js';

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

export interface ConsentRequest {
  actionId: string;
  summary: string;
  mutating: boolean;
  required: boolean;
}

export type ConsentDecision = 'approved' | 'denied' | 'unavailable';

export interface ConsentService {
  request(request: ConsentRequest): Promise<ConsentDecision>;
}

export interface InstallationRequest {
  actionId: string;
  summary: string;
  requiresConsent: true;
}

export interface InstallationResult {
  completed: boolean;
  metadata: SetupMetadata;
  errorCode?: string;
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