import { defineConfig } from 'vitest/config';
import path from 'path';

// 순수 로직(lib) 단위 테스트 — 컴포넌트 렌더 없이 node 환경에서 실행
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
