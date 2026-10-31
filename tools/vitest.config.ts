import { defineConfig } from 'vitest/config';

// Separate from the unit tests: `npm run balance` runs only the balance timeline.
export default defineConfig({
  test: {
    include: ['tools/**/*.run.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
