import type { SetupState } from './setup-state.js';

export type SetupStateLoadResult =
  | { status: 'missing' }
  | { status: 'valid'; state: SetupState }
  | { status: 'corrupt'; errorCode: 'SETUP_STATE_CORRUPT' };

export type SetupStateSaveResult =
  | { status: 'saved'; previousStateRetained: boolean }
  | { status: 'failed'; errorCode: 'SETUP_STATE_WRITE_FAILED' | 'SETUP_STATE_RENAME_FAILED' };

export interface SetupStateLock {
  release(): Promise<void>;
}

export interface SetupStateStore {
  acquireLock(): Promise<SetupStateLock>;
  load(): Promise<SetupStateLoadResult>;
  save(state: SetupState): Promise<SetupStateSaveResult>;
}

export interface SetupRepairPolicy {
  canRetryStep(stepId: string): boolean;
  allowsDestructiveBackendOperation(): false;
}