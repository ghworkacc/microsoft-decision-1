import { defineConfig } from 'vitest/config';

// Live contract tests against the deployed Foundry endpoint
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.int.test.js'],
        globalSetup: ['./src/test/integrationSetup.js'],
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
