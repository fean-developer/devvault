import { validateSetupState, type SetupState } from './setup-state.js';
import type { ConsentService, SetupOrchestrator as SetupOrchestratorPort } from './setup-ports.js';
import type { SetupStateStore } from './setup-state-store.js';
import type { SetupContext, SetupExecutionResult, SetupMetadata, SetupStep } from './setup-steps.js';

export class StepSetupOrchestrator implements SetupOrchestratorPort {
  constructor(
    private readonly stateStore: SetupStateStore,
    private readonly consent: ConsentService,
  ) {}

  setup(context: SetupContext, steps: readonly SetupStep[]): Promise<SetupExecutionResult> {
    return this.execute({ ...context, mode: 'setup' }, steps, false);
  }

  check(context: Omit<SetupContext, 'mode'>, steps: readonly SetupStep[]): Promise<SetupExecutionResult> {
    return this.execute({ ...context, mode: 'check' }, steps, true);
  }

  repair(context: Omit<SetupContext, 'mode'>, steps: readonly SetupStep[]): Promise<SetupExecutionResult> {
    return this.execute({ ...context, mode: 'repair' }, steps, false);
  }

  private async execute(
    context: SetupContext,
    steps: readonly SetupStep[],
    readOnly: boolean,
  ): Promise<SetupExecutionResult> {
    let completed: string[] = [];
    const pending: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];
    let metadata: SetupMetadata = { ...context.metadata };
    let lock;
    let stateCorrupt = false;
    try {
      lock = readOnly ? undefined : await this.stateStore.acquireLock();
      const loaded = await this.stateStore.load();
      stateCorrupt = loaded.status === 'corrupt';
      completed = loaded.status === 'valid' ? [...loaded.state.completedSteps] : [];
    } catch (error) {
      return this.failedResult(error instanceof Error ? error.message : 'Setup state lock failed.');
    }

    try {
      if (stateCorrupt) return this.failedResult('Setup state is corrupt.');
      for (const step of steps) {
        if (completed.includes(step.id)) continue;
        if (readOnly && step.mutating) {
          pending.push(step.id);
          continue;
        }
        if (step.mutating) {
          const decision = await this.consent.request({
            actionId: step.id,
            summary: `Execute setup step: ${step.id}`,
            mutating: true,
            required: true,
          });
          if (decision !== 'approved') {
            blockers.push(`Consent was not granted for setup step: ${step.id}`);
            pending.push(step.id);
            break;
          }
        }

        const result = await step.run(context);
        metadata = { ...metadata, ...result.metadata };
        if (result.status === 'completed') {
          completed.push(step.id);
          if (!readOnly) {
            const save = await this.stateStore.save(this.createState(context, 'READY', completed, pending, metadata));
            if (save.status === 'failed') return this.failedResult(save.errorCode);
          }
        } else if (result.status === 'blocked') {
          blockers.push(result.nextAction ?? `Setup step blocked: ${step.id}`);
          pending.push(step.id);
          break;
        } else if (result.status === 'failed') {
          return this.failedResult(result.errorCode ?? `Setup step failed: ${step.id}`);
        } else {
          pending.push(step.id);
        }
      }

      if (pending.length > 0 || completed.length < steps.length) {
        return {
          status: blockers.length > 0 ? 'BLOCKED' : 'DEGRADED',
          completedSteps: completed,
          pendingSteps: pending,
          blockers,
          warnings,
          metadata,
        };
      }
      return { status: 'READY', completedSteps: completed, pendingSteps: [], blockers, warnings, metadata };
    } finally {
      await lock?.release();
    }
  }

  private createState(
    context: SetupContext,
    status: SetupState['status'],
    completedSteps: string[],
    pendingSteps: string[],
    metadata: SetupMetadata,
  ): SetupState {
    return validateSetupState({
      schemaVersion: 1,
      status,
      profile: context.profile,
      platform: {
        host: String(metadata.platform ?? 'unknown'),
        isWsl: metadata.isWsl === true,
        shell: String(metadata.shell ?? 'unknown'),
      },
      backend: metadata.backend === 'remote-vault' ? 'remote-vault' : metadata.backend === 'local-docker' ? 'local-docker' : null,
      vaultAddress: typeof metadata.vaultAddress === 'string' ? metadata.vaultAddress : null,
      kvMount: typeof metadata.kvMount === 'string' ? metadata.kvMount : null,
      completedSteps,
      pendingSteps,
      updatedAt: new Date().toISOString(),
    });
  }

  private failedResult(detail: string): SetupExecutionResult {
    return { status: 'FAILED', completedSteps: [], pendingSteps: [], blockers: [detail], warnings: [], metadata: {} };
  }
}