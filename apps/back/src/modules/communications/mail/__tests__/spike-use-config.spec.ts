import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * Spike T-004 — render test .vue with useConfig() (C-01 verification).
 *
 * Verifies that per-render data passed in the config object to render() is
 * accessible via useConfig() inside the SFC, and that the output HTML
 * contains the interpolated values with zero residual {{handlebars}} tokens.
 *
 * Plaintext is generated via `createPlaintext(html)` because
 * `createRenderer().render()` returns `plaintext` as the config object, not
 * the generated string (the top-level `render()` runs the full transformer
 * pipeline; the reusable renderer does not).
 *
 * Deps: T-003 (renderer performance baseline).
 */
describe('Spike T-004 — useConfig() data interpolation', () => {
  it(
    'should interpolate config values into html and emit no handlebars tokens',
    async () => {
      const { createRenderer, createPlaintext } = await import(
        '@maizzle/framework'
      );

      const renderer = await createRenderer();
      try {
        const templatePath = resolve(
          __dirname,
          'fixtures',
          'spike.vue',
        );
        const config = {
          subject: 'Welcome to Foundation',
          title: 'Verify Your Email',
          greeting: 'Hello Alex',
          bodyText: 'Please confirm your email address.',
          buttonText: 'Confirm',
          link: 'https://foundation.app/confirm?hash=abc',
        };

        const { html } = await renderer.render(templatePath, config);
        const plaintext = createPlaintext(html);

        // Config data flows via useConfig() into the rendered HTML.
        expect(html).toContain('Welcome to Foundation');
        expect(html).toContain('Hello Alex');
        expect(html).toContain('Please confirm your email address.');
        expect(html).toContain('Confirm');
        expect(html).toContain('https://foundation.app/confirm?hash=abc');
        // Zero residual Handlebars tokens — data flows via useConfig(), not {{hbs}}.
        expect(html).not.toMatch(/\{\{[^}]+\}\}/);
        // Plaintext is a non-empty string generated from the html.
        expect(typeof plaintext).toBe('string');
        expect(plaintext.length).toBeGreaterThan(0);
        expect(plaintext).toContain('Hello Alex');
      } finally {
        await renderer.close();
      }
    },
    90000,
  );
});