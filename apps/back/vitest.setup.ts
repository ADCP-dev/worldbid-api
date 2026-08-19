// vitest.setup.ts — bridge Jest API to Vitest for existing tests.
// This allows `jest.fn()`, `jest.mock()`, etc. to work with Vitest globals.
import { vi } from 'vitest'

// Expose jest as an alias of vi for backward compatibility with existing
// Jest-style tests. Vitest's vi.fn() has the same API as jest.fn().
const jest = vi

// Make it global so `jest.fn()` works without imports
;(globalThis as Record<string, unknown>).jest = jest