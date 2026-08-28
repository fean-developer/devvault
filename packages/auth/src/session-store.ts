import type { CredentialStore, LocalSessionRecord } from '@devvault/core';

export interface DeveloperSessionStore {
  read(backendIdentity: string): Promise<LocalSessionRecord | null>;
  replace(backendIdentity: string, record: LocalSessionRecord): Promise<void>;
  clear(backendIdentity: string): Promise<void>;
}

export class CredentialStoreDeveloperSessionStore implements DeveloperSessionStore {
  constructor(
    private readonly store: CredentialStore,
    private readonly legacyKey = 'session',
    private readonly legacyBackendIdentity = 'http://127.0.0.1:8200',
  ) {}

  async read(backendIdentity: string): Promise<LocalSessionRecord | null> {
    const scoped = await this.store.get(this.keyFor(backendIdentity));
    if (scoped !== null) return parseSessionRecord(scoped);

    if (backendIdentity !== this.legacyBackendIdentity) return null;
    const legacy = await this.store.get(this.legacyKey);
    return legacy === null ? null : parseSessionRecord(legacy);
  }

  async replace(backendIdentity: string, record: LocalSessionRecord): Promise<void> {
    await this.store.set(this.keyFor(backendIdentity), JSON.stringify(record));
  }

  async clear(backendIdentity: string): Promise<void> {
    await this.store.delete(this.keyFor(backendIdentity));
    await this.store.delete(this.legacyKey);
  }

  private keyFor(backendIdentity: string): string {
    return `session:${encodeURIComponent(backendIdentity)}`;
  }
}

function parseSessionRecord(value: string): LocalSessionRecord {
  try {
    const parsed: unknown = JSON.parse(value);
    if (isSessionRecord(parsed)) return parsed;
  } catch {
    return { token: value, authMount: 'userpass' };
  }
  return { token: value, authMount: 'userpass' };
}

function isSessionRecord(value: unknown): value is LocalSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LocalSessionRecord>;
  return typeof record.token === 'string' && typeof record.authMount === 'string';
}