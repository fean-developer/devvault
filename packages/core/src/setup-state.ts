import type { ReadinessProfile, SetupResultStatus } from './setup-model.js';
import type { SetupMetadata } from './setup-steps.js';

export interface SetupPlatformMetadata {
  host: string;
  isWsl: boolean;
  shell: string;
}

export interface SetupState {
  schemaVersion: 1;
  status: SetupResultStatus;
  profile: ReadinessProfile;
  platform: SetupPlatformMetadata;
  backend: 'local-docker' | 'remote-vault' | null;
  vaultAddress: string | null;
  kvMount: string | null;
  completedSteps: string[];
  pendingSteps: string[];
  lastErrorCode?: string;
  updatedAt: string;
}

const allowedKeys = new Set([
  'schemaVersion',
  'status',
  'profile',
  'platform',
  'backend',
  'vaultAddress',
  'kvMount',
  'completedSteps',
  'pendingSteps',
  'lastErrorCode',
  'updatedAt',
]);

const forbiddenPattern = /(password|token|secret|secretid|authorization|unseal|recovery|rootcredential)/i;

export function validateSetupState(input: unknown): SetupState {
  if (!isRecord(input)) throw new Error('Setup state must be an object.');
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown setup state field: ${key}`);
    if (forbiddenPattern.test(key)) throw new Error(`Forbidden setup state field: ${key}`);
  }
  if (input.schemaVersion !== 1) throw new Error('Unsupported setup state schema version.');
  if (!isOneOf(input.status, ['READY', 'DEGRADED', 'BLOCKED', 'FAILED'])) throw new Error('Invalid setup state status.');
  if (!isOneOf(input.profile, ['local-bootstrap', 'developer-runtime', 'remote-check'])) throw new Error('Invalid setup state profile.');
  if (input.backend !== null && !isOneOf(input.backend, ['local-docker', 'remote-vault'])) throw new Error('Invalid setup state backend.');
  if (input.vaultAddress !== null && typeof input.vaultAddress !== 'string') throw new Error('Invalid Vault address.');
  if (typeof input.vaultAddress === 'string' && hasEmbeddedCredential(input.vaultAddress)) throw new Error('Vault address contains credentials.');
  if (input.kvMount !== null && typeof input.kvMount !== 'string') throw new Error('Invalid KV mount.');
  if (!isPlatformMetadata(input.platform)) throw new Error('Invalid platform metadata.');
  if (!isStringArray(input.completedSteps) || !isStringArray(input.pendingSteps)) throw new Error('Invalid setup step lists.');
  if (input.lastErrorCode !== undefined && typeof input.lastErrorCode !== 'string') throw new Error('Invalid setup error code.');
  if (typeof input.updatedAt !== 'string' || !input.updatedAt) throw new Error('Invalid setup state timestamp.');
  if (input.lastErrorCode !== undefined) rejectSensitiveValues(input.lastErrorCode);
  return input as unknown as SetupState;
}

export function sanitizeSetupMetadata(metadata: SetupMetadata): SetupMetadata {
  const sanitized: SetupMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenPattern.test(key) || (typeof value === 'string' && forbiddenPattern.test(value))) {
      throw new Error(`Sensitive setup metadata rejected: ${key}`);
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function rejectSensitiveValues(value: unknown): void {
  if (typeof value === 'string' && forbiddenPattern.test(value)) throw new Error('Sensitive setup state value rejected.');
  if (Array.isArray(value)) {
    value.forEach(rejectSensitiveValues);
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) => {
      if (forbiddenPattern.test(key)) throw new Error(`Sensitive setup state key rejected: ${key}`);
      rejectSensitiveValues(child);
    });
  }
}

function hasEmbeddedCredential(value: string): boolean {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.username || parsed.password || parsed.searchParams.toString());
  } catch {
    return false;
  }
}

function isPlatformMetadata(value: unknown): value is SetupPlatformMetadata {
  return isRecord(value)
    && typeof value.host === 'string'
    && typeof value.isWsl === 'boolean'
    && typeof value.shell === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}