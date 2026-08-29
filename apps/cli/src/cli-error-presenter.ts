import { AuthorizationDeniedError } from '@devvault/core';

/**
 * Pure CLI error presenter. Kept separate from index.ts so it can be unit
 * tested without executing the CLI entrypoint's top-level side effects.
 */
export function formatCliErrorMessage(error: unknown): string {
  if (error instanceof AuthorizationDeniedError) {
    return 'Permission denied for this secret operation. Your session is valid, but your Vault policy does not allow this action. Contact your Vault/project administrator.';
  }
  return `Error: ${error instanceof Error ? error.message : 'Command failed.'}`;
}
