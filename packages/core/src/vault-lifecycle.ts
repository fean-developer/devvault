export type VaultLifecycleState =
  | 'unavailable'
  | 'not-initialized'
  | 'sealed'
  | 'unsealed'
  | 'configured'
  | 'ready';

export interface VaultHealth {
  reachable: boolean;
  initialized: boolean;
  sealed: boolean;
}

export interface VaultLifecycle {
  state: VaultLifecycleState;
  initialized: boolean;
  sealed: boolean;
}

export function classifyVaultLifecycle(input: VaultHealth & {
  configured?: boolean;
  authenticated?: boolean;
  authorized?: boolean;
}): VaultLifecycle {
  if (!input.reachable) return { state: 'unavailable', initialized: false, sealed: true };
  if (!input.initialized) return { state: 'not-initialized', initialized: false, sealed: true };
  if (input.sealed) return { state: 'sealed', initialized: true, sealed: true };
  if (!input.configured) return { state: 'unsealed', initialized: true, sealed: false };
  if (!input.authenticated || !input.authorized) {
    return { state: 'configured', initialized: true, sealed: false };
  }
  return { state: 'ready', initialized: true, sealed: false };
}