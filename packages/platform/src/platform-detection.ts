import { release } from 'node:os';

export type HostPlatform = 'linux' | 'windows' | 'macos' | 'unknown';
export type ShellKind = 'bash' | 'zsh' | 'powershell' | 'cmd' | 'unknown';

export interface PlatformInfo {
  host: HostPlatform;
  isWsl: boolean;
  shell: ShellKind;
}

export interface PlatformSignals {
  platform?: NodeJS.Platform;
  kernelRelease?: string;
  env?: NodeJS.ProcessEnv;
}

export function detectPlatform(signals: PlatformSignals = {}): PlatformInfo {
  const platform = signals.platform ?? process.platform;
  const kernelRelease = signals.kernelRelease ?? release();
  const env = signals.env ?? process.env;
  const isWsl = platform === 'linux' && /microsoft|wsl/i.test(kernelRelease);

  return {
    host: platform === 'linux' ? 'linux' : platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'unknown',
    isWsl,
    shell: detectShell(env),
  };
}

function detectShell(env: NodeJS.ProcessEnv): ShellKind {
  const shell = `${env.SHELL ?? ''} ${env.ComSpec ?? ''} ${env.PSModulePath ?? ''}`.toLowerCase();
  if (shell.includes('powershell') || shell.includes('pwsh')) return 'powershell';
  if (shell.includes('cmd.exe')) return 'cmd';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  return 'unknown';
}