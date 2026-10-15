import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    fileParallelism: false,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/api.test.ts',
      'tests/integration/advanced-invariants.test.ts',
      'tests/integration/audit-completion.test.ts',
    ],
  },
});
