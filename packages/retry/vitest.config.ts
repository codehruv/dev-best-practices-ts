import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Doc tests import the package by its published name, so rendered samples are
    // copy-pasteable. Must match `paths` in tsconfig.json.
    alias: { '@dbp/retry': fileURLToPath(new URL('src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
