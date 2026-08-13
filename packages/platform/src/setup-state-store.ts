import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { SetupState, SetupStateLoadResult, SetupStateSaveResult, SetupStateStore, SetupStateLock } from '@devvault/core';
import { validateSetupState } from '@devvault/core';

export interface FileSetupStateStoreOptions {
  statePath: string;
  lockPath?: string;
}

export class SetupStateLockError extends Error {
  readonly code = 'SETUP_STATE_LOCKED';

  constructor() {
    super('DevVault setup state is locked by another process.');
    this.name = 'SetupStateLockError';
  }
}

export class FileSetupStateStore implements SetupStateStore {
  private readonly statePath: string;
  private readonly lockPath: string;

  constructor(options: FileSetupStateStoreOptions) {
    this.statePath = options.statePath;
    this.lockPath = options.lockPath ?? `${options.statePath}.lock`;
  }

  async acquireLock(): Promise<SetupStateLock> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    let handle;
    try {
      handle = await open(this.lockPath, 'wx');
      await handle.writeFile(`${process.pid}\n`, 'utf8');
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new SetupStateLockError();
      throw error;
    }

    return {
      release: async () => {
        await handle.close();
        await unlink(this.lockPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        });
      },
    };
  }

  async load(): Promise<SetupStateLoadResult> {
    let source: string;
    try {
      source = await readFile(this.statePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' };
      return { status: 'corrupt', errorCode: 'SETUP_STATE_CORRUPT' };
    }
    try {
      return { status: 'valid', state: validateSetupState(JSON.parse(source)) };
    } catch {
      return { status: 'corrupt', errorCode: 'SETUP_STATE_CORRUPT' };
    }
  }

  async save(state: SetupState): Promise<SetupStateSaveResult> {
    let validated: SetupState;
    try {
      validated = validateSetupState(state);
    } catch {
      return { status: 'failed', errorCode: 'SETUP_STATE_WRITE_FAILED' };
    }

    await mkdir(dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    let previousStateRetained = true;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
      await rename(temporaryPath, this.statePath);
      previousStateRetained = false;
      return { status: 'saved', previousStateRetained };
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      return {
        status: 'failed',
        errorCode: error instanceof Error && (error as NodeJS.ErrnoException).code === 'EXDEV'
          ? 'SETUP_STATE_RENAME_FAILED'
          : 'SETUP_STATE_WRITE_FAILED',
      };
    }
  }
}

export function defaultSetupStatePath(environment: NodeJS.ProcessEnv = process.env): string {
  const configDirectory = environment.APPDATA
    ?? environment.XDG_CONFIG_HOME
    ?? join(homedir(), '.config');
  return join(configDirectory, 'devvault', 'setup-state.json');
}