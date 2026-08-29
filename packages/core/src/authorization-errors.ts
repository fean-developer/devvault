import { AuthorizationDeniedError, VaultAuthenticationError, VaultPermissionDeniedError, VaultUnavailableError } from './errors.js';
import type { AuthorizationOperationContext } from './errors.js';

/**
 * Single authoritative translation of a caught Vault operation error into its
 * correct semantic owner. Vault remains the authorization decision point:
 * this function only classifies an already-received response.
 */
export function classifyVaultOperationError(error: unknown, context: AuthorizationOperationContext): never {
  if (error instanceof VaultPermissionDeniedError) {
    throw new AuthorizationDeniedError(context);
  }
  if (error instanceof VaultAuthenticationError || error instanceof VaultUnavailableError) {
    throw error;
  }
  throw error;
}
