import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const mutations = [
  ['lifecycle-state-word', 'apps/cli/src/commands/setup.ts', '(unseal(?:[ _-]key)?\\b)', '(unseal)'],
  ['human-output-sanitization', 'apps/cli/src/commands/setup.ts', 'const safeResult = sanitizeSetupResult(result);', 'const safeResult = result;'],
  ['mandatory-pending-degraded', 'packages/core/src/setup-orchestrator.ts', "status: blockers.length > 0 ? 'BLOCKED' : 'DEGRADED'", "status: 'DEGRADED'"],
  ['kv-static-flag', 'packages/platform/src/local-docker-vault-backend.ts', 'kvValid = await this.options.vault.validateKvV2(kvMount);', 'kvValid = capabilities.canValidateKv;'],
  ['policy-static-flag', 'packages/platform/src/local-docker-vault-backend.ts', "policyValid = effectiveCapabilities.includes('read');", 'policyValid = capabilities.canValidatePolicy;'],
  ['skip-kv-validation', 'packages/platform/src/local-docker-vault-backend.ts', 'kvValid = await this.options.vault.validateKvV2(kvMount);', 'kvValid = true;'],
  ['skip-policy-validation', 'packages/platform/src/local-docker-vault-backend.ts', "policyValid = effectiveCapabilities.includes('read');", 'policyValid = true;'],
  ['step-exception-leak', 'packages/core/src/setup-orchestrator.ts', 'return this.failedResult(`Setup step failed: ${step.id}`);', 'throw new Error(`token=mutation-secret`);'],
];
const report = [];

for (const [name, relative, needle, replacement] of mutations) {
  const scratch = mkdtempSync(join(tmpdir(), `devvault-mutation-${name}-`));
  try {
    execFileSync('git', ['worktree', 'add', '--detach', scratch, 'HEAD'], { cwd: root, stdio: 'ignore' });
    cpSync(join(root, 'apps'), join(scratch, 'apps'), { recursive: true });
    cpSync(join(root, 'packages'), join(scratch, 'packages'), { recursive: true });
    cpSync(join(root, 'tests'), join(scratch, 'tests'), { recursive: true });
    execFileSync('ln', ['-s', join(root, 'node_modules'), join(scratch, 'node_modules')], { stdio: 'ignore' });
    const sourcePath = join(root, relative);
    const scratchPath = join(scratch, relative);
    const original = readFileSync(sourcePath, 'utf8');
    writeFileSync(scratchPath, original.replace(new RegExp(needle), replacement));
    let killed = false;
    try {
      execFileSync('corepack', ['pnpm', 'exec', 'vitest', 'run', 'apps/cli/src/commands/setup.test.ts', '--runInBand'], {
        cwd: scratch,
        stdio: 'ignore',
      });
    } catch {
      killed = true;
    }
    report.push({ name, killed });
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', scratch], { cwd: root, stdio: 'ignore' });
    rmSync(scratch, { recursive: true, force: true });
  }
}

const output = join(root, 'docs/phase-0-mutation-report.json');
writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), command: 'node scripts/phase0-mutation-sensor.mjs', mutations: report }, null, 2)}\n`);
if (report.some((mutation) => !mutation.killed)) process.exitCode = 1;