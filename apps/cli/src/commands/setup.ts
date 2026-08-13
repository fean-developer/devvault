import { Command } from 'commander';
import {
  StepSetupOrchestrator,
  setupExitCodes,
  type ConsentService,
  type DependencyChecker,
  type SetupExecutionResult,
  type SetupMetadata,
  type SetupStateStore,
  type SetupStep,
} from '@devvault/core';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export interface SetupCommandDependencies {
  stateStore: SetupStateStore;
  dependencyChecker: DependencyChecker;
  consent: ConsentService;
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
  return [
    {
      id: 'dependencies',
      mutating: false,
      requiresConsent: false,
      run: async (context) => {
        const report = await dependencies.dependencyChecker.check({ profile: context.profile, metadata });
        return {
          status: report.blockers.length > 0 ? 'blocked' : 'completed',
          metadata: { ...report.metadata, ...metadata },
          nextAction: report.blockers.join(' '),
        };
      },
    },
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
  };
}