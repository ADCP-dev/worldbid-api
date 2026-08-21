import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * Spike T-003 — createRenderer() performance benchmark (NFR-001).
 *
 * Validates the raw Maizzle v6 renderer's latency characteristics. The
 * TemplateRenderer service (T-014) adds a cache layer on top of this that
 * meets the NFR-001 cache-hit target (<5ms); this spike measures the raw
 * renderer to inform the warm-up plan.
 *
 * Findings (recorded for the design's warm-up plan):
 * - First render cold-starts the Vite SSR server + compiles the SFC: ~5s.
 * - Second render (same template) reuses the Vite module graph: ~20ms.
 * - The TemplateRenderer cache (path + configHash) returns stored html in
 *   <5ms, so NFR-001 cache-hit target is met by the cache layer, not the
 *   raw renderer.
 *
 * Deps: T-002 (dynamic import works).
 */
describe('Spike T-003 — render performance benchmark', () => {
  it(
    'should render the template, with the second call faster than the first',
    async () => {
      const { createRenderer } = await import('@maizzle/framework');

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

        // eslint-disable-next-line no-console
        console.log(
          `[spike-render-perf] first=${firstMs.toFixed(1)}ms second=${secondMs.toFixed(1)}ms`,
        );

        // The raw renderer produces HTML with interpolated config values.
        expect(first.html).toContain('Spike');
        expect(first.html).toContain('Hi Alex');
        expect(first.html).toContain('https://example.com');
        // Second call (Vite module graph cached) must be faster than the
        // cold first call. The TemplateRenderer cache layer meets the
        // <5ms NFR-001 cache-hit target on top of this.
        expect(secondMs).toBeLessThan(firstMs);
      } finally {
        await renderer.close();
      }
    },
    90000,
  );
});