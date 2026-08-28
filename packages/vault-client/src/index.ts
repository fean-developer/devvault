import {
  VaultAuthenticationError,
  VaultPermissionDeniedError,
  VaultUnavailableError,
} from '@devvault/core';

export * from './policies.js';
export * from './session-validation.js';

export interface VaultClientOptions {
  address: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface VaultHealth {
  initialized: boolean;
  sealed: boolean;
}

export interface VaultInitializationResult {
  rootToken: string;
  unsealKey: string;
}

export type SecretData = Record<string, unknown>;

export class HttpVaultClient {
  private readonly address: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VaultClientOptions) {
    this.address = options.address.replace(/\/$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async health(): Promise<VaultHealth> {
    try {
      const response = await this.fetchImpl(`${this.address}/v1/sys/health?standbyok=true`);
      if (response.status === 401) throw new VaultAuthenticationError();
      if (response.status === 403) throw new VaultPermissionDeniedError();
      if (response.status !== 200 && response.status !== 501 && response.status !== 503) {
        throw new VaultUnavailableError(`Vault returned HTTP ${response.status}.`);
      }
      const body = await this.readJson<{ initialized: boolean; sealed: boolean }>(response);
      return { initialized: body.initialized, sealed: body.sealed };
    } catch (error) {
      if (error instanceof VaultAuthenticationError || error instanceof VaultPermissionDeniedError) throw error;
      if (error instanceof VaultUnavailableError) throw error;
      throw new VaultUnavailableError();
    }
  }

  async unseal(key: string): Promise<void> {
    await this.request('/v1/sys/unseal', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
  }

  async initialize(): Promise<VaultInitializationResult> {
    const response = await this.request('/v1/sys/init', {
      method: 'PUT',
      body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 }),
    });
    const body = await this.readJson<{ root_token?: string; keys?: string[] }>(response);
    const rootToken = body.root_token;
    const unsealKey = body.keys?.[0];
    if (!rootToken || !unsealKey) throw new VaultUnavailableError('Vault initialization returned incomplete bootstrap material.');
    return { rootToken, unsealKey };
  }

  setToken(token: string): void {
    (this as unknown as { token?: string }).token = token;
  }

  async loginUserpass(
    mount: string,
    username: string,
    password: string,
  ): Promise<{ token: string; leaseDuration: number }> {
    let response: Response;
    try {
      response = await this.request(`/v1/auth/${encodePath(mount)}/login/${encodePath(username)}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    } catch (error) {
      if (error instanceof VaultUnavailableError && /HTTP 400|HTTP 404/.test(error.message)) {
        throw new VaultAuthenticationError();
      }
      throw error;
    }
    const body = await this.readJson<{ auth?: { client_token?: string; lease_duration?: number } }>(response);
    const token = body.auth?.client_token;
    if (!token) {
      throw new VaultAuthenticationError();
    }
    return { token, leaseDuration: body.auth?.lease_duration ?? 0 };
  }

  async revokeSelf(token: string): Promise<void> {
    await this.request('/v1/auth/token/revoke-self', {
      method: 'POST',
      headers: { 'x-vault-token': token },
    });
  }

  async readSecret(mount: string, path: string): Promise<SecretData> {
    let response: Response;
    try {
      response = await this.request(`/v1/${encodePath(mount)}/data/${encodePath(path)}`);
    } catch (error) {
      if (error instanceof VaultUnavailableError && error.message === 'Vault returned HTTP 404.') {
        return {};
      }
      throw error;
    }
    const body = await this.readJson<{ data?: { data?: SecretData } }>(response);
    return body.data?.data ?? {};
  }

  async writeSecret(mount: string, path: string, data: SecretData): Promise<void> {
    await this.request(`/v1/${encodePath(mount)}/data/${encodePath(path)}`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async listSecrets(mount: string, path: string): Promise<string[]> {
    let response: Response;
    try {
      response = await this.request(`/v1/${encodePath(mount)}/metadata/${encodePath(path)}`, {
        method: 'LIST',
      });
    } catch (error) {
      if (error instanceof VaultUnavailableError && error.message === 'Vault returned HTTP 404.') {
        return [];
      }
      throw error;
    }
    const body = await this.readJson<{ data?: { keys?: string[] } }>(response);
    return body.data?.keys ?? [];
  }

  async deleteSecret(mount: string, path: string): Promise<void> {
    await this.request(`/v1/${encodePath(mount)}/metadata/${encodePath(path)}`, {
      method: 'DELETE',
    });
  }

  async ensureKvV2(mount: string): Promise<void> {
    const mountsResponse = await this.request('/v1/sys/mounts');
    const mounts = await this.readJson<Record<string, unknown>>(mountsResponse);
    if (mounts[`${mount}/`]) {
      return;
    }
    await this.request(`/v1/sys/mounts/${encodePath(mount)}`, {
      method: 'POST',
      body: JSON.stringify({ type: 'kv', options: { version: '2' } }),
    });
  }

  async validateKvV2(mount: string): Promise<boolean> {
    const response = await this.request('/v1/sys/mounts');
    const mounts = await this.readJson<Record<string, { type?: string; options?: { version?: string } }>>(response);
    const configured = mounts[`${mount}/`];
    return configured?.type === 'kv' && configured.options?.version === '2';
  }

  async putPolicy(name: string, policy: string): Promise<void> {
    await this.request(`/v1/sys/policies/acl/${encodePath(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ policy }),
    });
  }

  async ensureUserpass(): Promise<void> {
    const response = await this.request('/v1/sys/auth');
    const mounts = await this.readJson<Record<string, unknown>>(response);
    if (mounts['userpass/']) {
      return;
    }
    await this.request('/v1/sys/auth/userpass', {
      method: 'POST',
      body: JSON.stringify({ type: 'userpass', description: 'DevVault human authentication' }),
    });
  }

  async createUserpassUser(
    username: string,
    password: string,
    policies: string[],
    ttl = '1h',
  ): Promise<void> {
    await this.request(`/v1/auth/userpass/users/${encodePath(username)}`, {
      method: 'POST',
      body: JSON.stringify({ password, token_policies: policies, token_ttl: ttl }),
    });
  }

  async checkCapabilities(path: string): Promise<string[]> {
    const response = await this.request('/v1/sys/capabilities-self', {
      method: 'POST',
      body: JSON.stringify({ paths: [path] }),
    });
    const body = await this.readJson<{ capabilities?: string[] | Record<string, string[]>; [key: string]: unknown }>(response);
    if (Array.isArray(body.capabilities)) return body.capabilities;
    if (body.capabilities && typeof body.capabilities === 'object') return body.capabilities[path] ?? [];
    const direct = body[path];
    return Array.isArray(direct) ? direct as string[] : [];
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      const response = await this.fetchImpl(`${this.address}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(this.token ? { 'x-vault-token': this.token } : {}),
          ...init.headers,
        },
      });

      if (response.ok) {
        return response;
      }
      if (response.status === 401) {
        throw new VaultAuthenticationError();
      }
      if (response.status === 403) {
        throw new VaultPermissionDeniedError();
      }
      throw new VaultUnavailableError(`Vault returned HTTP ${response.status}.`);
    } catch (error) {
      if (
        error instanceof VaultAuthenticationError ||
        error instanceof VaultPermissionDeniedError ||
        error instanceof VaultUnavailableError
      ) {
        throw error;
      }
      throw new VaultUnavailableError();
    }
  }

  private async readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new VaultUnavailableError('Vault returned an invalid response.');
    }
  }
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}