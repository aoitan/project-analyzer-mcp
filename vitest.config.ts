import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // describe, it, expect などをグローバルに利用可能にする
    testTimeout: 60000, // グローバルなテストタイムアウトを60秒に設定
    singleThread: true,
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
