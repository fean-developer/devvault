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

export type AuthorizationOperation = 'secret.get' | 'secret.list' | 'secret.set' | 'secret.delete' | 'run';

export interface AuthorizationOperationContext {
  operation: AuthorizationOperation;
  project: string;
  environment: string;
}

export class AuthorizationDeniedError extends DevVaultError {
  readonly operation: AuthorizationOperation;
  readonly project: string;
  readonly environment: string;

  constructor(context: AuthorizationOperationContext) {
    super(
      `Permission denied for ${context.operation} on project '${context.project}' environment '${context.environment}'.`,
      'AUTHORIZATION_DENIED',
    );
    this.operation = context.operation;
    this.project = context.project;
    this.environment = context.environment;
  }
}