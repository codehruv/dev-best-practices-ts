import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
    benchmark: {
      include: ['tests/bench/**/*.bench.ts'],
      // Read by `slo check`, which maps these results to the objectives in slo/.
      outputJson: '.slo/bench.json',
    },
  },
});
