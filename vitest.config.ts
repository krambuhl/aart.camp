import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.?(c|m)[jt]s?(x)'],
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
