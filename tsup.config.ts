import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['apps/cli/src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});