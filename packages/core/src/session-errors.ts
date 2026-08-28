import { DevVaultError } from './errors.js';

export type SessionFailureEvidence =
  | { kind: 'LOGIN_REQUIRED' }
  | { kind: 'INVALID_SESSION' }
  | { kind: 'EXPIRED_SESSION' }
  | { kind: 'REVOKED_SESSION' }
  | { kind: 'PERMISSION_DENIED' }
  | { kind: 'VAULT_UNAVAILABLE' }
  | { kind: 'VAULT_SEALED' }
  | { kind: 'VAULT_NOT_READY' }
  | { kind: 'UNKNOWN' };

export class SessionFailureError extends DevVaultError {
  constructor(code: string, message: string) {
    super(message, code);
  }
}

export function classifySessionFailure(evidence: SessionFailureEvidence): SessionFailureError {
  switch (evidence.kind) {
    case 'LOGIN_REQUIRED': return new SessionFailureError('LOGIN_REQUIRED', 'Developer login required.');
    case 'INVALID_SESSION': return new SessionFailureError('SESSION_INVALID', 'Developer session is no longer valid.');
    case 'EXPIRED_SESSION': return new SessionFailureError('SESSION_EXPIRED', 'Developer session expired.');
    case 'REVOKED_SESSION': return new SessionFailureError('SESSION_REVOKED', 'Developer session was revoked.');
    case 'PERMISSION_DENIED': return new SessionFailureError('PERMISSION_DENIED', 'Permission denied for this operation.');
    case 'VAULT_UNAVAILABLE': return new SessionFailureError('VAULT_UNAVAILABLE', 'Vault is unavailable.');
    case 'VAULT_SEALED': return new SessionFailureError('VAULT_SEALED', 'Vault is sealed.');
    case 'VAULT_NOT_READY': return new SessionFailureError('VAULT_NOT_READY', 'Vault is not ready.');
    case 'UNKNOWN': return new SessionFailureError('SESSION_UNKNOWN', 'Developer session validity could not be determined.');
  }
}