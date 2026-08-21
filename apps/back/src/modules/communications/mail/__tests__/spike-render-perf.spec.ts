import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * Spike T-003 — createRenderer() performance benchmark (NFR-001).
 *
 * First render must be < 500ms; cache hit (second call) must be < 5ms.
 * If first render > 2s, document and flag for a warm-up plan.
 *
 * Deps: T-002 (dynamic import works).
 */
describe('Spike T-003 — render performance benchmark', () => {
  it('should complete first render under 500ms and cache hit under 5ms', async () => {
    const { createRenderer } = (await import('@maizzle/framework')) as {
      createRenderer: () => Promise<{
        render: (
          path: string,
          config: Record<string, unknown>,
        ) => Promise<{ html: string; plaintext?: string }>;
        close: () => Promise<void>;
      }>;
    };

    const renderer = await createRenderer();
    try {
      const templatePath = resolve(
        __dirname,
        'fixtures',
        'spike.vue',
      );
      const config = {
        subject: 'Spike',
        title: 'Spike Title',
        greeting: 'Hi Alex',
        bodyText: 'Spike body.',
        buttonText: 'Click',
        link: 'https://example.com',
      };

      const startFirst = performance.now();
      const first = await renderer.render(templatePath, config);
      const firstMs = performance.now() - startFirst;

      const startSecond = performance.now();
      await renderer.render(templatePath, config);
      const secondMs = performance.now() - startSecond;

      expect(first.html).toContain('Spike');
      expect(typeof first.plaintext).toBe('string');
      expect(firstMs).toBeLessThan(500);
      expect(secondMs).toBeLessThan(5);
    } finally {
      await renderer.close();
    }
  });
});