import type { LocalSessionRecord, SafeSessionSummary } from './session-model.js';

export interface DeveloperSessionWriter {
  replace(backendIdentity: string, record: LocalSessionRecord): Promise<void>;
}

export interface DeveloperAuthenticationResult {
  token: string;
  username: string;
  issuedAt: string;
  leaseDuration: number;
  authMount: string;
}

export interface DeveloperSessionAuthenticator {
  authenticate(username: string, password: string): Promise<DeveloperAuthenticationResult>;
}

export interface LoginServiceOptions {
  backendIdentity: string;
  authenticator: DeveloperSessionAuthenticator;
  sessionStore: DeveloperSessionWriter;
}

export class LoginApplicationService {
  constructor(private readonly options: LoginServiceOptions) {}

  async login(username: string, password: string): Promise<SafeSessionSummary> {
    const authenticated = await this.options.authenticator.authenticate(username, password);
    const issuedAt = new Date(authenticated.issuedAt);
    const expiresAt = authenticated.leaseDuration > 0 && !Number.isNaN(issuedAt.getTime())
      ? new Date(issuedAt.getTime() + authenticated.leaseDuration * 1000).toISOString()
      : undefined;
    await this.options.sessionStore.replace(this.options.backendIdentity, {
      token: authenticated.token,
      username: authenticated.username,
      issuedAt: authenticated.issuedAt,
      ...(expiresAt ? { expiresAt } : {}),
      leaseDuration: authenticated.leaseDuration,
      authMount: authenticated.authMount,
    });
    return {
      state: 'ACTIVE',
      username: authenticated.username,
      ...(expiresAt ? { expiresAt } : {}),
      validation: 'REMOTE_CONFIRMED',
    };
  }
}