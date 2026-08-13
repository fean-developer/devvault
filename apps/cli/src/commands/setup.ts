import { Command } from 'commander';
import {
  StepSetupOrchestrator,
  setupExitCodes,
  type BackendSelector,
  type ConsentService,
  type SetupValidator,
  type DependencyChecker,
  type SetupExecutionResult,
  type SetupMetadata,
  type SetupStateStore,
  type SetupStep,
  type SetupStepResult,
  type VaultBackend,
} from '@devvault/core';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export interface SetupCommandDependencies {
  stateStore: SetupStateStore;
  dependencyChecker: DependencyChecker;
  consent: ConsentService;
  backendSelector?: BackendSelector;
  localBackend?: VaultBackend;
  remoteBackend?: VaultBackend;
  validator?: SetupValidator;
  startLocalVault?: () => Promise<void>;
  approveAllMutations?: boolean;
  steps?: readonly SetupStep[];
}

export interface SetupCommandOptions {
  check?: boolean;
  json?: boolean;
  repair?: boolean;
  nonInteractive?: boolean;
  yes?: boolean;
}

export function registerSetupCommand(
  program: Command,
  dependencies: SetupCommandDependencies,
): void {
  program
    .command('setup')
    .description('Prepare and validate the DevVault environment')
    .option('--check', 'Run read-only readiness checks')
    .option('--json', 'Print machine-readable JSON')
    .option('--repair', 'Resume incomplete setup steps')
    .option('--non-interactive', 'Never prompt for consent')
    .option('--yes', 'Approve described setup mutations')
    .action(async (options: SetupCommandOptions) => {
      const result = await runSetupCommand(dependencies, options);
      writeSetupResult(result, options.json === true);
      process.exitCode = setupExitCodes[result.status];
    });
}

export async function runSetupCommand(
  dependencies: SetupCommandDependencies,
  options: SetupCommandOptions,
): Promise<SetupExecutionResult> {
  const profile = 'local-bootstrap' as const;
  const metadata: SetupMetadata = {
    nonInteractive: options.nonInteractive === true,
    yes: options.yes === true,
  };
  const steps = dependencies.steps ?? createSetupSteps(dependencies, metadata);
  const consent: ConsentService = options.yes === true || dependencies.approveAllMutations === true
    ? { request: async () => 'approved' }
    : dependencies.consent;
  const orchestrator = new StepSetupOrchestrator(dependencies.stateStore, consent);
  const context = { profile, metadata };

  if (options.check) return orchestrator.check(context, steps);
  if (options.repair) return orchestrator.repair(context, steps);
  return orchestrator.setup({ ...context, mode: 'setup' }, steps);
}

function createSetupSteps(
  dependencies: SetupCommandDependencies,
  metadata: SetupMetadata,
): readonly SetupStep[] {
  let dependencyReport: Awaited<ReturnType<DependencyChecker['check']>> | undefined;
  let selectedBackend: VaultBackend | undefined;
  let backendDetection: Awaited<ReturnType<VaultBackend['detect']>> | undefined;
  let backendValidation: Awaited<ReturnType<VaultBackend['validate']>> | undefined;
  let requiresLocalStart = false;
  const startLocalVaultStep: SetupStep = {
    id: 'start-local-vault',
    mutating: false,
    requiresConsent: true,
    run: async (): Promise<SetupStepResult> => {
      if (!requiresLocalStart) return { status: 'completed', metadata: {} };
      if (!dependencies.startLocalVault) return { status: 'blocked', metadata: {}, nextAction: 'Local Vault start is unavailable.' };
      try {
        await dependencies.startLocalVault();
        return { status: 'completed', metadata: { vaultContainer: 'running' } };
      } catch {
        return { status: 'failed', metadata: {}, errorCode: 'LOCAL_VAULT_START_FAILED' };
      }
    },
  };

  const steps: SetupStep[] = [
    {
      id: 'dependencies',
      mutating: false,
      requiresConsent: false,
      run: async (context) => {
        dependencyReport = await dependencies.dependencyChecker.check({ profile: context.profile, metadata });
        const localOnlyBlockers = dependencyReport.blockers.filter((blocker) => !/docker|vault container/i.test(blocker));
        const canUseRemote = Boolean(dependencies.remoteBackend) && localOnlyBlockers.length === 0;
        requiresLocalStart = Boolean(dependencies.startLocalVault)
          && dependencyReport.metadata.dockerState === 'available'
          && dependencyReport.metadata.vaultContainer !== 'running'
          && !canUseRemote;
        startLocalVaultStep.mutating = requiresLocalStart;
        return localOnlyBlockers.length > 0 || (!canUseRemote && dependencyReport.blockers.length > 0)
          && !requiresLocalStart
          ? { status: 'blocked', metadata: { ...dependencyReport.metadata, ...metadata }, nextAction: dependencyReport.blockers.join(' ') }
          : { status: 'completed', metadata: { ...dependencyReport.metadata, ...metadata } };
      },
    },
    {
      id: 'backend-selection',
      mutating: false,
      requiresConsent: false,
      run: async () => {
        if (!dependencies.backendSelector || !dependencies.localBackend) {
          return { status: 'failed', metadata: {}, errorCode: 'SETUP_BACKEND_NOT_CONFIGURED' };
        }
        const selection = await dependencies.backendSelector.select({
          local: dependencies.localBackend,
          remote: dependencies.remoteBackend,
          preferred: metadata.preferredBackend === 'remote-vault' ? 'remote-vault' : undefined,
        });
        selectedBackend = selection.backend;
        return selection.backend
          ? { status: 'completed', metadata: { ...selection.metadata, backend: selection.backend.kind() } }
          : { status: 'blocked', metadata: selection.metadata, nextAction: selection.blockers.join(' ') };
      },
    },
    {
      id: 'backend-readiness',
      mutating: false,
      requiresConsent: false,
      revalidateOnRepair: true,
      run: async () => {
        if (!selectedBackend) return { status: 'blocked', metadata: {}, nextAction: 'No viable Vault backend was selected.' };
        backendDetection = await selectedBackend.detect();
        if (!backendDetection.available) return { status: 'blocked', metadata: {}, nextAction: backendDetection.detail ?? 'Selected Vault backend is unavailable.' };
        backendValidation = await selectedBackend.validate(backendDetection.capabilities);
        const readinessMetadata = {
          backend: selectedBackend.kind(),
          vaultLifecycle: backendValidation.lifecycle,
          kv: backendValidation.kvValid,
          policy: backendValidation.policyValid,
        };
        if (['unavailable', 'not-initialized', 'sealed'].includes(backendValidation.lifecycle)) {
          return { status: 'blocked', metadata: readinessMetadata, nextAction: `Vault lifecycle is ${backendValidation.lifecycle}.` };
        }
        if (!backendValidation.kvValid || !backendValidation.policyValid) {
          return { status: 'blocked', metadata: readinessMetadata, nextAction: 'Mandatory Vault capabilities are unavailable.' };
        }
        return { status: 'completed', metadata: readinessMetadata };
      },
    },
    {
      id: 'profile-validation',
      mutating: false,
      requiresConsent: false,
      revalidateOnRepair: true,
      run: async (context) => {
        if (!dependencies.validator || !dependencyReport || !backendDetection || !backendValidation) {
          return { status: 'failed', metadata: {}, errorCode: 'SETUP_VALIDATION_NOT_CONFIGURED' };
        }
        const report = await dependencies.validator.validate({
          ...context,
          metadata: {
            ...dependencyReport.metadata,
            ...metadata,
            backend: selectedBackend?.kind() ?? null,
            vaultLifecycle: backendValidation.lifecycle,
            kv: backendValidation.kvValid,
            policy: backendValidation.policyValid,
          },
        });
        if (report.status === 'FAILED') return { status: 'failed', metadata: report.metadata, errorCode: 'SETUP_VALIDATION_FAILED' };
        if (report.status === 'BLOCKED') return { status: 'blocked', metadata: report.metadata, nextAction: report.blockers.join(' ') || 'Profile validation blocked setup.' };
        if (report.status === 'DEGRADED') return { status: 'pending', metadata: report.metadata, nextAction: report.warnings.join(' ') };
        return { status: 'completed', metadata: report.metadata };
      },
    },
  ];
  startLocalVaultStep.mutating = requiresLocalStart;
  return [
    ...steps.slice(0, 1),
    startLocalVaultStep,
    ...steps.slice(1),
  ];
}

export function writeSetupResult(result: SetupExecutionResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(sanitizeSetupResult(result))}\n`);
    return;
  }

  process.stdout.write(`DevVault Setup: ${result.status}\n`);
  if (result.completedSteps.length > 0) process.stdout.write(`Completed: ${result.completedSteps.join(', ')}\n`);
  if (result.pendingSteps.length > 0) process.stdout.write(`Pending: ${result.pendingSteps.join(', ')}\n`);
  for (const blocker of result.blockers) process.stdout.write(`Blocker: ${blocker}\n`);
  for (const warning of result.warnings) process.stdout.write(`Warning: ${warning}\n`);
}

export function sanitizeSetupResult(result: SetupExecutionResult): SetupExecutionResult {
  return {
    ...result,
    metadata: Object.fromEntries(
      Object.entries(result.metadata).filter(([key]) => !/(password|token|secret|key|credential|authorization)/i.test(key)),
    ),
    blockers: result.blockers.map((value) => value.replace(/(password|token|secret|key|credential|authorization)[^\s]*/gi, '[redacted]')),
    warnings: result.warnings.map((value) => value.replace(/(password|token|secret|key|credential|authorization)[^\s]*/gi, '[redacted]')),
  };
}

export function createSetupDependencies(
  composition: ReturnTypeOfComposition,
): SetupCommandDependencies {
  return {
    stateStore: composition.setupStateStore,
    dependencyChecker: composition.setupDependencyChecker,
    consent: composition.setupConsent,
    backendSelector: composition.setupBackendSelector,
    localBackend: composition.setupLocalBackend,
    remoteBackend: composition.setupRemoteBackend,
    validator: composition.setupValidator,
    startLocalVault: composition.startLocalVault,
  };
}