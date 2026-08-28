import { classifySessionFailure } from './session-errors.js';
import type { ValidatedDeveloperSession } from './session-model.js';
import { toValidatedDeveloperSession, type ValidatedDeveloperSessionResult } from './session-resolver.js';

export interface SessionResolverPort {
  resolveValidated(): Promise<ValidatedDeveloperSessionResult>;
}

export class SessionGuard {
  constructor(private readonly resolver: SessionResolverPort) {}

  async requireValidSession(): Promise<ValidatedDeveloperSession> {
    const result = await this.resolver.resolveValidated();
    if (result.state !== 'ACTIVE') {
      throw classifySessionFailure({
        kind: result.state === 'NOT_AUTHENTICATED' ? 'LOGIN_REQUIRED' : result.state === 'EXPIRED' ? 'EXPIRED_SESSION' : result.state === 'REVOKED' ? 'REVOKED_SESSION' : result.state === 'INVALID' ? 'INVALID_SESSION' : 'UNKNOWN',
      });
    }
    return toValidatedDeveloperSession(result);
  }
}