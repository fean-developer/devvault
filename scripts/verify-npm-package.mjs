import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, URL } from 'node:url';

const execFileAsync = promisify(execFile);

const root = fileURLToPath(new URL('..', import.meta.url));
const packageDir = join(root, '.npm-dist');
const manifestPath = join(packageDir, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function fail(message) {
  throw new Error(`npm package verification failed: ${message}`);
}

if (manifest.private === true) {
  fail('.npm-dist/package.json must be publishable, but private is true');
}

if (!manifest.name || !manifest.version) {
  fail('.npm-dist/package.json must include name and version');
}

if (manifest.repository?.type !== 'git') {
  fail('.npm-dist/package.json must include repository.type=git');
}

if (manifest.repository?.url !== 'git+https://github.com/fean-developer/devvault.git') {
  fail('.npm-dist/package.json must include the public GitHub repository URL');
}

if (manifest.homepage !== 'https://github.com/fean-developer/devvault#readme') {
  fail('.npm-dist/package.json must include the public GitHub homepage');
}

if (manifest.bugs?.url !== 'https://github.com/fean-developer/devvault/issues') {
  fail('.npm-dist/package.json must include the public GitHub issues URL');
}

if (manifest.bin?.devvault !== 'dist/index.js') {
  fail('.npm-dist/package.json must expose bin.devvault as dist/index.js');
}

await access(join(packageDir, manifest.bin.devvault), constants.R_OK);
await access(join(packageDir, 'assets', 'images', 'devvault.png'), constants.R_OK);

const readmeContent = await readFile(join(packageDir, 'README.md'), 'utf8');
if (!readmeContent.includes('https://raw.githubusercontent.com/fean-developer/devvault/main/apps/cli/assets/images/devvault.png')) {
  fail('README.md must use the public absolute URL for the branding image');
}

if (!readmeContent.includes('https://github.com/fean-developer/devvault/blob/main/apps/cli/docs/GUIA-USO-PT-BR.md')) {
  fail('README.md must link to the Portuguese guide using a public absolute GitHub URL');
}

if (!readmeContent.includes('https://github.com/fean-developer/devvault/blob/main/apps/cli/RELEASE-NOTES.md')) {
  fail('README.md must link to release notes using a public absolute GitHub URL');
}

const binContent = await readFile(join(packageDir, manifest.bin.devvault), 'utf8');
if (!binContent.startsWith('#!/usr/bin/env node')) {
  fail('dist/index.js must start with a node shebang');
}

if (!Array.isArray(manifest.files) || !manifest.files.includes('infra/vault/**')) {
  fail('.npm-dist/package.json must include infra/vault/** in files');
}

const tempDir = await mkdtemp(join(tmpdir(), 'devvault-npm-verify-'));

try {
  await execFileAsync('npm', ['pack', packageDir, '--pack-destination', tempDir], { cwd: root });
  const tarballs = (await readdir(tempDir)).filter((file) => file.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    fail(`expected exactly one packed tarball, found ${tarballs.length}`);
  }

  const tarballPath = join(tempDir, tarballs[0]);
  const { stdout: packedManifestJson } = await execFileAsync('tar', [
    '-xOf',
    tarballPath,
    'package/package.json',
  ]);
  const packedManifest = JSON.parse(packedManifestJson);
  if (packedManifest.bin?.devvault !== 'dist/index.js') {
    fail('packed tarball does not expose bin.devvault');
  }

  const installDir = join(tempDir, 'install');
  await mkdir(installDir);
  await writeFile(join(installDir, 'package.json'), '{"private":true}\n');
  await execFileAsync('npm', ['install', tarballPath, '--no-audit', '--no-fund'], {
    cwd: installDir,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });

  const installedBin = join(
    installDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'devvault.cmd' : 'devvault',
  );
  await access(installedBin, constants.X_OK);

  const { stdout: versionOutput } = await execFileAsync(installedBin, ['--version'], {
    cwd: installDir,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });

  if (versionOutput.trim() !== manifest.version) {
    fail(`installed devvault --version returned ${versionOutput.trim()}, expected ${manifest.version}`);
  }

  const globalPrefix = join(tempDir, 'global');
  await mkdir(globalPrefix);
  await execFileAsync('npm', ['install', '--global', '--prefix', globalPrefix, tarballPath, '--no-audit', '--no-fund'], {
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });

  const globalBin =
    process.platform === 'win32'
      ? join(globalPrefix, 'devvault.cmd')
      : join(globalPrefix, 'bin', 'devvault');
  await access(globalBin, constants.X_OK);

  const { stdout: globalVersionOutput } = await execFileAsync(globalBin, ['--version'], {
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });

  if (globalVersionOutput.trim() !== manifest.version) {
    fail(
      `globally installed devvault --version returned ${globalVersionOutput.trim()}, expected ${manifest.version}`,
    );
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

process.stdout.write(`npm package verification passed for ${manifest.name}@${manifest.version}\n`);