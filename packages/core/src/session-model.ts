export const SESSION_STATES = [
  'NOT_AUTHENTICATED',
  'ACTIVE',
  'INVALID',
  'EXPIRED',
  'REVOKED',
  'UNKNOWN',
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export interface LocalSessionRecord {
  token: string;
  username?: string;
  issuedAt?: string;
  expiresAt?: string;
  leaseDuration?: number;
  authMount: string;
}

export type RemoteSessionValidation =
  | { outcome: 'VALID'; identity?: { username?: string }; expiresAt?: string }
  | { outcome: 'INVALID' }
  | { outcome: 'EXPIRED' }
  | { outcome: 'REVOKED' }
  | { outcome: 'UNKNOWN'; reason: 'UNAVAILABLE' | 'SEALED' | 'NOT_READY' | 'INCONCLUSIVE' };

export interface SessionResolution {
  state: SessionState;
  identity?: { username?: string };
  expiresAt?: string;
  credentialSource: 'CREDENTIAL_STORE' | 'NONE';
  validation: 'NOT_ATTEMPTED' | 'REMOTE_CONFIRMED' | 'LOCAL_HINT' | 'UNAVAILABLE' | 'INCONCLUSIVE';
}

export interface ValidatedDeveloperSession {
  state: 'ACTIVE';
  username?: string;
  expiresAt?: string;
  credential: string;
  validation: 'REMOTE_CONFIRMED';
}

export interface SafeSessionSummary {
  state: SessionState;
  username?: string;
  expiresAt?: string;
  validation: SessionResolution['validation'];
}