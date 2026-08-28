import type { DeveloperSessionStorePort } from './session-resolver.js';

export interface DeveloperSessionClearer extends DeveloperSessionStorePort {
  clear(backendIdentity: string): Promise<void>;
}

export interface DeveloperSessionRevoker {
  revoke(token: string): Promise<void>;
}

export interface LogoutResult {
  cleared: boolean;
  revokeAttempted: boolean;
  revokeFailed: boolean;
}

export class LogoutApplicationService {
  constructor(
    private readonly store: DeveloperSessionClearer,
    private readonly revoker: DeveloperSessionRevoker,
    private readonly backendIdentity: string,
  ) {}

  async logout(): Promise<LogoutResult> {
    const record = await this.store.read(this.backendIdentity);
    let revokeFailed = false;
    if (record) {
      try {
        await this.revoker.revoke(record.token);
      } catch {
        revokeFailed = true;
      }
    }
    await this.store.clear(this.backendIdentity);
    return { cleared: true, revokeAttempted: Boolean(record), revokeFailed };
  }
}