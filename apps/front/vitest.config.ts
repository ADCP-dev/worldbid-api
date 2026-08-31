// Vitest config for frontend unit tests.
// Plain object export on purpose: apps/front does not depend on vitest
// (it lives in apps/back's node_modules), so we avoid importing
// 'vitest/config' here. Run with:
//   apps/back/node_modules/.bin/vitest run --config apps/front/vitest.config.ts
export default {
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      // Stub Nuxt's virtual auto-import module for unit tests.
      '#imports': new URL('./tests/unit/imports-stub.ts', import.meta.url)
        .pathname,
    },
  },
};
