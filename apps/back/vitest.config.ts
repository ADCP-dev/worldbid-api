import { defineConfig } from 'vitest/config'
import path from 'node:path'

const root = process.cwd()

export default defineConfig({
  test: {
    include: [
      'src/core/spec-engine/__tests__/**/*.spec.ts',
      'src/core/realtime/__tests__/**/*.spec.ts',
      'src/extensions/tasks/__tests__/**/*.spec.ts',
      'src/extensions/affiliate/__tests__/**/*.spec.ts',
      'src/extensions/knowledge-agent/**/*.spec.ts',
      'src/modules/error-tracker/__tests__/**/*.spec.ts',
      'src/modules/communications/mail/__tests__/**/*.spec.ts',
      'src/modules/communications/email-queue/__tests__/**/*.spec.ts',
      'src/infrastructure/mailer/__tests__/**/*.spec.ts',
      'src/mcp/__tests__/**/*.spec.ts',
      '../../packages/emails/emails/__tests__/**/*.spec.ts',
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    watch: false,
    testTimeout: 15000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@src': path.resolve(root, 'src'),
      '@core': path.resolve(root, 'src/core'),
      '@ext': path.resolve(root, 'src/extensions'),
      '@iam': path.resolve(root, 'src/modules/iam'),
      '@users': path.resolve(root, 'src/modules/users'),
      '@infra': path.resolve(root, 'src/infrastructure'),
      '@comms': path.resolve(root, 'src/modules/communications'),
      '@storage': path.resolve(root, 'src/modules/storage'),
      '@settings': path.resolve(root, 'src/modules/settings'),
      '@billing': path.resolve(root, 'src/modules/billing'),
      '@social': path.resolve(root, 'src/modules/social'),
      '@emails': path.resolve(root, '../../packages/emails/emails'),
    },
  },
})