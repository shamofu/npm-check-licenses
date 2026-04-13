import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      // Allow NodeNext-style .js imports to resolve to .ts source files
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1' },
    ],
  },
})
