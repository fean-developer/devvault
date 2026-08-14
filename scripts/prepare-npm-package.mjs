import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'apps', 'cli');
const target = join(root, '.npm-dist');
const packageJson = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
const rootPackageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

await rm(target, { recursive: true, force: true });
await mkdir(join(target, 'dist'), { recursive: true });
await mkdir(join(target, 'docs'), { recursive: true });
await cp(join(source, 'dist', 'index.js'), join(target, 'dist', 'index.js'));
await cp(join(source, 'README.md'), join(target, 'README.md'));
await cp(join(source, 'RELEASE-NOTES.md'), join(target, 'RELEASE-NOTES.md'));
await cp(join(source, 'docs', 'GUIA-USO-PT-BR.md'), join(target, 'docs', 'GUIA-USO-PT-BR.md'));

const publishManifest = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  publisher: rootPackageJson.publisher,
  description: packageJson.description,
  license: packageJson.license,
  type: packageJson.type,
  bin: packageJson.bin,
  files: packageJson.files,
  publishConfig: packageJson.publishConfig,
  engines: { node: '>=20' },
  dependencies: {
    commander: packageJson.dependencies.commander,
    keytar: packageJson.dependencies.keytar,
    yaml: packageJson.dependencies.yaml,
    zod: packageJson.dependencies.zod,
  },
};

await writeFile(join(target, 'package.json'), `${JSON.stringify(publishManifest, null, 2)}\n`);
process.stdout.write(`npm package prepared at ${target}\n`);
