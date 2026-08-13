import type { ReadinessProfile, SetupResultStatus } from './setup-model.js';

export type SetupMode = 'setup' | 'check' | 'repair';

export type SetupMetadata = Record<string, string | number | boolean | null>;

export interface SetupContext {
  mode: SetupMode;
  profile: ReadinessProfile;
  metadata: SetupMetadata;
}

export interface SetupStepResult {
  status: 'completed' | 'pending' | 'blocked' | 'failed';
  metadata: SetupMetadata;
  nextAction?: string;
  errorCode?: string;
}

export interface SetupStep {
  id: string;
  mutating: boolean;
  requiresConsent: boolean;
  revalidateOnRepair?: boolean;
  run(context: SetupContext): Promise<SetupStepResult>;
}

export interface SetupExecutionResult {
  status: SetupResultStatus;
  completedSteps: string[];
  pendingSteps: string[];
  blockers: string[];
  warnings: string[];
  metadata: SetupMetadata;
}