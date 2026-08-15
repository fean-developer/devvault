import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const rootPackage = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  define: { __DEVVAULT_VERSION__: JSON.stringify(rootPackage.version) },
  noExternal: [/^@devvault\//],
  external: ['yaml', 'zod', 'commander', 'keytar'],
});