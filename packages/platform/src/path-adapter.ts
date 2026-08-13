import { dirname, isAbsolute, join, normalize, win32, posix } from 'node:path';

export interface PathAdapter {
  join(...parts: string[]): string;
  normalize(path: string): string;
  dirname(path: string): string;
  isAbsolute(path: string): boolean;
}

export class HostPathAdapter implements PathAdapter {
  join(...parts: string[]): string {
    return join(...parts);
  }

  normalize(path: string): string {
    return normalize(path);
  }

  dirname(path: string): string {
    return dirname(path);
  }

  isAbsolute(path: string): boolean {
    return isAbsolute(path);
  }
}

export function normalizeWindowsPath(path: string): string {
  return win32.normalize(path);
}

export function normalizePosixPath(path: string): string {
  return posix.normalize(path);
}