import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * T-005 — Layout.vue shared wrapper.
 *
 * Layout.vue uses Maizzle components (<Html>, <Head>, <Body>, <Container>)
 * and exposes a <slot/> so child templates inject their content. Rendering a
 * template that imports Layout must produce HTML containing the slot content
 * plus Tailwind-inlined styles.
 */
describe('T-005 — Layout.vue', () => {
  it(
    'should render slot content inside the Maizzle Layout wrapper with inlined styles',
    async () => {
      const maizzle = (await import('@maizzle/framework')) as {
        createRenderer: () => Promise<{
          render: (
            path: string,
            config: Record<string, unknown>,
          ) => Promise<{ html: string }>;
          close: () => Promise<void>;
        }>;
      };
      const renderer = await maizzle.createRenderer();
      try {
        const fixturePath = resolve(__dirname, 'fixtures/layout-child.vue');
        const config = {
          appName: 'Foundation',
          appUrl: 'https://foundation.app',
          subject: 'Layout Test',
          slotText: 'Layout slot content here',
        };
        const { html } = await renderer.render(fixturePath, config);

        // Slot content appears in the rendered HTML.
        expect(html).toContain('Layout slot content here');
        // Maizzle components produce a full <html> document with inlined CSS.
        expect(html).toMatch(/<html/i);
        expect(html).toMatch(/<body/i);
        // Tailwind utilities are inlined (style attributes present).
        expect(html).toMatch(/style=/i);
      } finally {
        await renderer.close();
      }
    },
    90000,
  );
});