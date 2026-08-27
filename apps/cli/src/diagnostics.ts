import type { ProjectConfig } from '@devvault/config';
import { loadProjectConfig, resolveEnvironmentContext, type EnvironmentContextState, type ResolvedEnvironmentContext } from '@devvault/config';
import type { VaultHealth } from '@devvault/vault-client';
import { classifyVaultLifecycle, type VaultLifecycleState } from '@devvault/core';
import type { DockerDiagnostics, PlatformInfo } from '@devvault/platform';

export interface DiagnosticClient {
  health(): Promise<VaultHealth>;
  checkCapabilities?(path: string): Promise<string[]>;
}

export interface DiagnosticCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface DoctorReport {
  checks: DiagnosticCheck[];
  project?: { name: string; environment: string; protected: boolean };
  environmentState?: EnvironmentContextState;
  lifecycle?: VaultLifecycleState;
  platform?: PlatformInfo;
  docker?: DockerDiagnostics;
}

export async function loadConfigForDiagnostics(
  directory: string,
  environment?: string,
): Promise<ProjectConfig> {
  return loadProjectConfig(directory, environment);
}

export async function createDoctorReport(
  directory: string,
  client: DiagnosticClient,
  configLoader: (directory: string, environment?: string) => Promise<ProjectConfig> = loadConfigForDiagnostics,
  context?: { platform?: PlatformInfo; docker?: DockerDiagnostics },
  environment?: string,
  contextLoader: (directory: string, environment?: string) => Promise<ResolvedEnvironmentContext> = (directory, selected) => resolveEnvironmentContext(directory, selected, { mode: 'diagnostic', allowCandidateRoot: true }),
): Promise<DoctorReport> {
  const checks: DiagnosticCheck[] = [
    { name: 'Node.js', ok: true, detail: process.version },
  ];
  let project: DoctorReport['project'];
  let health: VaultHealth | undefined;
  let authorized = false;
  let environmentState: EnvironmentContextState | undefined;

  try {
    const resolved = await contextLoader(directory, environment);
    environmentState = resolved.state;
    if (resolved.config) project = { name: resolved.config.project, environment: resolved.config.environment, protected: resolved.config.protected === true };
    if (resolved.state === 'SELECTED' && resolved.environment) {
      checks.push({ name: 'Environment configuration', ok: false, detail: `Environment '${resolved.environment}' is selected but not configured. Run: devvault init-project` });
    }
  } catch {
    environmentState = 'INVALID';
  }

  if (!project) try {
    const config = await configLoader(directory, environment);
    project = { name: config.project, environment: config.environment, protected: config.protected === true };
    checks.push({ name: 'Project configuration', ok: true });
  } catch (error) {
    checks.push({
      name: 'Project configuration',
      ok: false,
      detail: error instanceof Error ? error.message : 'Configuration is invalid.',
    });
  }

  if (project && client.checkCapabilities) {
    const capabilityPath = `secret/data/projects/${project.name}/${project.environment}/_doctor`;
    try {
      const capabilities = await client.checkCapabilities(capabilityPath);
      checks.push({
        name: 'Project policy',
        ok: capabilities.includes('read'),
        detail: capabilities.includes('read') ? undefined : 'The current identity cannot read the project path.',
      });
      authorized = capabilities.includes('read');
    } catch (error) {
      checks.push({
        name: 'Project policy',
        ok: false,
        detail: error instanceof Error ? error.message : 'Project policy could not be checked.',
      });
    }
  }

  try {
    health = await client.health();
    checks.push({ name: 'Vault reachable', ok: true });
    checks.push({ name: 'Vault initialized', ok: health.initialized });
    checks.push({ name: 'Vault unsealed', ok: !health.sealed });
  } catch (error) {
    checks.push({
      name: 'Vault reachable',
      ok: false,
      detail: error instanceof Error ? error.message : 'Vault is unavailable.',
    });
  }

  const lifecycle = classifyVaultLifecycle({
    reachable: checks.some((check) => check.name === 'Vault reachable' && check.ok),
    initialized: health?.initialized ?? false,
    sealed: health?.sealed ?? true,
    configured: checks.some((check) => check.name === 'Project configuration' && check.ok),
    authenticated: checks.some((check) => check.name === 'Vault reachable' && check.ok),
    authorized,
  });
  return {
    checks,
    lifecycle: lifecycle.state,
    ...(environmentState ? { environmentState } : {}),
    ...(project ? { project } : {}),
    ...(context?.platform ? { platform: context.platform } : {}),
    ...(context?.docker ? { docker: context.docker } : {}),
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['DevVault Doctor', ''];
  for (const check of report.checks) {
    lines.push(`${check.ok ? 'OK' : 'FAIL'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
  }
  if (report.project) {
    lines.push('', `Project: ${report.project.name}`, `Environment: ${report.project.environment}`, `Protected: ${report.project.protected ? 'yes' : 'no'}`);
  }
  if (report.environmentState) lines.push(`Environment state: ${report.environmentState}`);
  return `${lines.join('\n')}\n`;
}

export function reportHasFailures(report: DoctorReport): boolean {
  return report.checks.some((check) => !check.ok);
}