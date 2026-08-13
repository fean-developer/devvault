export type SetupResultStatus = 'READY' | 'DEGRADED' | 'BLOCKED' | 'FAILED';

export const setupExitCodes: Record<SetupResultStatus, number> = {
  READY: 0,
  DEGRADED: 3,
  BLOCKED: 4,
  FAILED: 5,
};

export type ReadinessProfile = 'local-bootstrap' | 'developer-runtime' | 'remote-check';

export interface ReadinessProfileDefinition {
  mandatory: readonly string[];
  optional: readonly string[];
}

export const readinessProfiles: Record<ReadinessProfile, ReadinessProfileDefinition> = {
  'local-bootstrap': {
    mandatory: ['platform', 'backend', 'vault-lifecycle', 'kv', 'setup-state'],
    optional: ['secondary-platform', 'presentation'],
  },
  'developer-runtime': {
    mandatory: [
      'platform',
      'backend',
      'vault-lifecycle',
      'kv',
      'setup-state',
      'developer-authentication',
      'project-configuration',
      'project-capability',
      'credential-store',
    ],
    optional: ['secondary-platform', 'presentation'],
  },
  'remote-check': {
    mandatory: ['platform', 'remote-endpoint', 'trust-configuration', 'vault-lifecycle', 'requested-capabilities', 'setup-state'],
    optional: ['local-docker'],
  },
};

export function evaluateSetupResult(
  profile: ReadinessProfile,
  capabilities: Readonly<Record<string, boolean>>,
): SetupResultStatus {
  const definition = readinessProfiles[profile];
  if (definition.mandatory.some((capability) => capabilities[capability] === false)) {
    return 'BLOCKED';
  }
  if (definition.mandatory.some((capability) => capabilities[capability] !== true)) {
    return 'FAILED';
  }
  if (definition.optional.some((capability) => capabilities[capability] === false)) {
    return 'DEGRADED';
  }
  return 'READY';
}

const validTransitions: Record<SetupResultStatus, readonly SetupResultStatus[]> = {
  READY: ['READY', 'DEGRADED', 'BLOCKED', 'FAILED'],
  DEGRADED: ['READY', 'DEGRADED', 'BLOCKED', 'FAILED'],
  BLOCKED: ['READY', 'DEGRADED', 'BLOCKED', 'FAILED'],
  FAILED: ['READY', 'DEGRADED', 'BLOCKED', 'FAILED'],
};

export function canTransitionSetupResult(
  current: SetupResultStatus,
  next: SetupResultStatus,
): boolean {
  return validTransitions[current].includes(next);
}