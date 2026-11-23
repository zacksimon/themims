import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/themims/',
  test: { include: ['tests/**/*.test.ts'] },
});
