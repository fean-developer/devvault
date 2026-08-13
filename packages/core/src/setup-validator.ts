import { evaluateSetupResult, type ReadinessProfile } from './setup-model.js';
import { sanitizeSetupMetadata } from './setup-state.js';
import type { SetupContext, SetupMetadata } from './setup-steps.js';
import type { SetupValidator, ValidationReport } from './setup-ports.js';

export interface SetupCapabilitySnapshot {
  capabilities: Readonly<Record<string, boolean>>;
  blockers: readonly string[];
  warnings: readonly string[];
  metadata: SetupMetadata;
}

export interface SetupCapabilityProvider {
  collect(context: SetupContext): Promise<SetupCapabilitySnapshot>;
}

export class ProfileSetupValidator implements SetupValidator {
  constructor(private readonly provider: SetupCapabilityProvider) {}

  async validate(context: SetupContext): Promise<ValidationReport> {
    let snapshot: SetupCapabilitySnapshot;
    try {
      snapshot = await this.provider.collect(context);
    } catch {
      return {
        status: 'FAILED',
        capabilities: {},
        blockers: ['Setup capability collection failed.'],
        warnings: [],
        metadata: {},
      };
    }

    let metadata: SetupMetadata;
    try {
      metadata = sanitizeSetupMetadata(snapshot.metadata);
    } catch {
      return {
        status: 'FAILED',
        capabilities: snapshot.capabilities,
        blockers: ['Setup metadata is invalid.'],
        warnings: [],
        metadata: {},
      };
    }

    const status = snapshot.blockers.length > 0
      ? 'BLOCKED'
      : evaluateSetupResult(context.profile as ReadinessProfile, snapshot.capabilities);
    return {
      status,
      capabilities: snapshot.capabilities,
      blockers: [...snapshot.blockers],
      warnings: [...snapshot.warnings],
      metadata,
    };
  }
}