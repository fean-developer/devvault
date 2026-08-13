import type { CredentialStore } from '@devvault/core';

export type { CredentialStore } from '@devvault/core';

export class MemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export interface UserpassClient {
  loginUserpass(mount: string, username: string, password: string): Promise<{
    token: string;
    leaseDuration: number;
  }>;
  revokeSelf(token: string): Promise<void>;
}

export interface AuthenticationProvider {
  login(username: string, password: string): Promise<string>;
  logout(token: string): Promise<void>;
}

export class UserpassAuthenticationProvider implements AuthenticationProvider {
  constructor(
    private readonly client: UserpassClient,
    private readonly mount = 'userpass',
  ) {}

  async login(username: string, password: string): Promise<string> {
    const session = await this.client.loginUserpass(this.mount, username, password);
    return session.token;
  }

  async logout(token: string): Promise<void> {
    await this.client.revokeSelf(token);
  }
}