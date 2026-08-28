import type {
  LocalSessionRecord,
  RemoteSessionValidation,
  SafeSessionSummary,
  SessionResolution,
  ValidatedDeveloperSession,
} from './session-model.js';

export interface DeveloperSessionStorePort {
  read(backendIdentity: string): Promise<LocalSessionRecord | null>;
}

export interface DeveloperSessionValidatorPort {
  validate(token: string): Promise<RemoteSessionValidation>;
}

export interface SessionResolverOptions {
  backendIdentity: string;
}

export class SessionResolver {
  constructor(
    private readonly store: DeveloperSessionStorePort,
    private readonly validator: DeveloperSessionValidatorPort,
    private readonly options: SessionResolverOptions,
  ) {}

  async resolve(): Promise<SessionResolution> {
    const result = await this.resolveValidated();
    return {
      state: result.state,
      ...(result.username ? { identity: { username: result.username } } : {}),
      ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
      credentialSource: result.state === 'NOT_AUTHENTICATED' ? 'NONE' : 'CREDENTIAL_STORE',
      validation: result.validation,
    };
  }

  async resolveSummary(): Promise<SafeSessionSummary> {
    const result = await this.resolve();
    return {
      state: result.state,
      ...(result.identity?.username ? { username: result.identity.username } : {}),
      ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
      validation: result.validation,
    };
  }

  async resolveValidated(): Promise<ValidatedDeveloperSessionResult> {
    const record = await this.store.read(this.options.backendIdentity);
    if (!record) {
      return { state: 'NOT_AUTHENTICATED', validation: 'NOT_ATTEMPTED' };
    }

    const validation = await this.validator.validate(record.token);
    if (validation.outcome === 'VALID') {
      return {
        state: 'ACTIVE',
        username: record.username ?? validation.identity?.username,
        ...(validation.expiresAt ?? record.expiresAt ? { expiresAt: validation.expiresAt ?? record.expiresAt } : {}),
        credential: record.token,
        validation: 'REMOTE_CONFIRMED',
      };
    }
    if (validation.outcome === 'EXPIRED') return { state: 'EXPIRED', username: record.username, validation: 'REMOTE_CONFIRMED' };
    if (validation.outcome === 'REVOKED') return { state: 'REVOKED', username: record.username, validation: 'REMOTE_CONFIRMED' };
    if (validation.outcome === 'INVALID') return { state: 'INVALID', username: record.username, validation: 'REMOTE_CONFIRMED' };
    return {
      state: 'UNKNOWN',
      username: record.username,
      validation: validation.reason === 'UNAVAILABLE' || validation.reason === 'SEALED' || validation.reason === 'NOT_READY' ? 'UNAVAILABLE' : 'INCONCLUSIVE',
    };
  }
}

export type ValidatedDeveloperSessionResult =
  | { state: 'NOT_AUTHENTICATED'; username?: string; expiresAt?: string; validation: 'NOT_ATTEMPTED' }
  | { state: 'ACTIVE'; username?: string; expiresAt?: string; credential: string; validation: 'REMOTE_CONFIRMED' }
  | { state: 'INVALID' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN'; username?: string; expiresAt?: string; validation: 'REMOTE_CONFIRMED' | 'UNAVAILABLE' | 'INCONCLUSIVE' };

export function toValidatedDeveloperSession(result: ValidatedDeveloperSessionResult): ValidatedDeveloperSession {
  if (result.state !== 'ACTIVE') throw new Error(`Developer session is ${result.state}.`);
  return result;
}