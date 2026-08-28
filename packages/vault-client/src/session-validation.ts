export type RemoteSessionValidation =
  | { outcome: 'VALID'; expiresAt?: string }
  | { outcome: 'INVALID' }
  | { outcome: 'EXPIRED' }
  | { outcome: 'REVOKED' }
  | { outcome: 'UNKNOWN'; reason: 'UNAVAILABLE' | 'SEALED' | 'NOT_READY' | 'INCONCLUSIVE' };

export interface DeveloperSessionValidator {
  validate(token: string): Promise<RemoteSessionValidation>;
}

export interface VaultSessionValidatorOptions {
  address: string;
  fetchImpl?: typeof fetch;
}

export class VaultSessionValidator implements DeveloperSessionValidator {
  private readonly address: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VaultSessionValidatorOptions) {
    this.address = options.address.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async validate(token: string): Promise<RemoteSessionValidation> {
    try {
      const response = await this.fetchImpl(`${this.address}/v1/auth/token/lookup-self`, {
        method: 'GET',
        headers: { 'x-vault-token': token },
      });
      const body = await readJson(response);
      if (response.ok) {
        const auth = body.auth as { expire_time?: string } | undefined;
        return { outcome: 'VALID', ...(auth?.expire_time ? { expiresAt: auth.expire_time } : {}) };
      }
      if (response.status === 401) return classifyRejectedSession(body);
      if (response.status === 403) return { outcome: 'UNKNOWN', reason: 'INCONCLUSIVE' };
      if (response.status === 503) return { outcome: 'UNKNOWN', reason: 'UNAVAILABLE' };
      return { outcome: 'UNKNOWN', reason: 'INCONCLUSIVE' };
    } catch {
      return { outcome: 'UNKNOWN', reason: 'UNAVAILABLE' };
    }
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function classifyRejectedSession(body: Record<string, unknown>): RemoteSessionValidation {
  const errors = Array.isArray(body.errors) ? body.errors.filter((value): value is string => typeof value === 'string') : [];
  const detail = errors.join(' ').toLowerCase();
  if (detail.includes('expired')) return { outcome: 'EXPIRED' };
  if (detail.includes('revoked')) return { outcome: 'REVOKED' };
  return { outcome: 'INVALID' };
}