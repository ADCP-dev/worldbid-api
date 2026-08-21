import { describe, it, expect } from 'vitest';

/**
 * Spike T-002 — Dynamic import from CJS (Q-009).
 *
 * apps/back is CommonJS (no "type":"module" in its package.json).
 * @maizzle/framework v6 is ESM-only ("type":"module").
 *
 * This spike verifies that `await import('@maizzle/framework')` from a CJS
 * context resolves and exposes `createRenderer` as a function. If the import
 * throws ERR_REQUIRE_ESM, the design's fallback (packages/exports compiled
 * ESM API boundary) must be adopted instead.
 *
 * Deps: T-001 (packages/emails workspace declares @maizzle/framework ^6.x).
 */
describe('Spike T-002 — dynamic import from CJS', () => {
<<<<<<< HEAD
  it('should expose createRenderer as a function via dynamic import', async () => {
    const mod =
      (await import('@maizzle/framework')) as Record<string, unknown>;
    expect(typeof mod.createRenderer).toBe('function');
  });
=======
  it(
    'should expose createRenderer as a function via dynamic import',
    async () => {
      const mod = await import('@maizzle/framework');
      expect(typeof mod.createRenderer).toBe('function');
    },
    60000,
  );
>>>>>>> c025fe7 (chore: ignore prds/agent-native from git tracking)
});