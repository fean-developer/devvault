import { describe, expect, it } from 'vitest';
import {
  lifecycleResultStatuses,
  type EphemeralSecretInput,
  type LifecycleResult,
  type LocalLifecyclePort,
} from './developer-lifecycle-ports.js';

describe('developer lifecycle ports', () => {
  it('keeps lifecycle result statuses aligned with setup semantics', () => {
    expect(lifecycleResultStatuses).toEqual(['READY', 'DEGRADED', 'BLOCKED', 'FAILED']);
  });

  it('defines local lifecycle operations without an initialization or persistence operation', () => {
    const localLifecyclePort: LocalLifecyclePort = {
      start: async () => undefined,
      health: async () => ({ initialized: true, sealed: false, reachable: true }),
      unseal: async () => undefined,
    };
    const ephemeralSecretInput: EphemeralSecretInput = {
      read: async () => 'ephemeral-only',
    };

    expect(Object.keys(localLifecyclePort)).toEqual(['start', 'health', 'unseal']);
    expect(Object.keys(ephemeralSecretInput)).toEqual(['read']);
  });

  it('keeps lifecycle result metadata separate from credential material', () => {
    const result: LifecycleResult = {
      status: 'BLOCKED',
      lifecycle: 'sealed',
      backend: 'local-docker',
      blockers: ['An operator action is required.'],
      warnings: [],
      metadata: { backend: 'local-docker', vaultLifecycle: 'sealed' },
    };

    expect(result.status).toBe('BLOCKED');
    expect(result.lifecycle).toBe('sealed');
    expect(result.metadata).not.toHaveProperty('token');
    expect(result.metadata).not.toHaveProperty('unsealKey');
  });
});