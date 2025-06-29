import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // describe, it, expect などをグローバルに利用可能にする
    testTimeout: 5000, // グローバルなテストタイムアウトを5秒に設定
    setupFiles: [],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/index.ts', 'src/server.ts', 'src/types.ts'],
    },
  },
});
