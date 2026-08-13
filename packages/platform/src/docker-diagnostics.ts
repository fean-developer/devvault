export type DockerState =
  | 'cli-unavailable'
  | 'daemon-unavailable'
  | 'compose-unavailable'
  | 'available';

export interface DockerDiagnostics {
  state: DockerState;
  vaultContainer: 'running' | 'stopped' | 'missing' | 'unknown';
  detail?: string;
}

export interface DockerCommandExecutor {
  run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
}

export async function diagnoseDocker(
  executor: DockerCommandExecutor,
): Promise<DockerDiagnostics> {
  try {
    await executor.run('docker', ['--version']);
  } catch {
    return { state: 'cli-unavailable', vaultContainer: 'unknown', detail: 'Docker CLI is unavailable.' };
  }

  try {
    await executor.run('docker', ['info']);
  } catch {
    return { state: 'daemon-unavailable', vaultContainer: 'unknown', detail: 'Docker daemon is unavailable.' };
  }

  try {
    await executor.run('docker', ['compose', 'version']);
  } catch {
    return { state: 'compose-unavailable', vaultContainer: 'unknown', detail: 'Docker Compose is unavailable.' };
  }

  let vaultContainer: DockerDiagnostics['vaultContainer'] = 'unknown';
  try {
    const result = await executor.run('docker', ['inspect', '--format', '{{.State.Status}}', 'devvault-vault']);
    vaultContainer = result.stdout.trim() === 'running' ? 'running' : 'stopped';
  } catch {
    vaultContainer = 'missing';
  }
  return { state: 'available', vaultContainer };
}