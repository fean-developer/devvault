export class DevVaultError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class VaultUnavailableError extends DevVaultError {
  constructor(message = 'Vault is unavailable.') {
    super(message, 'VAULT_UNAVAILABLE');
  }
}

export class VaultAuthenticationError extends DevVaultError {
  constructor(message = 'Vault authentication failed.') {
    super(message, 'VAULT_AUTHENTICATION_FAILED');
  }
}

export class VaultPermissionDeniedError extends DevVaultError {
  constructor(message = 'Vault permission denied.') {
    super(message, 'VAULT_PERMISSION_DENIED');
  }
}

export class ProjectConfigError extends DevVaultError {
  constructor(message: string) {
    super(message, 'PROJECT_CONFIG_ERROR');
  }
}