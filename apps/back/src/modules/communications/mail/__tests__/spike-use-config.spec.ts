import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * Spike T-004 — render test .vue with useConfig() (C-01 verification).
 *
 * Verifies that per-render data passed in the config object to render() is
 * accessible via useConfig() inside the SFC, and that the output HTML
 * contains the interpolated values with zero {{handlebars}} tokens.
 *
 * Deps: T-003 (renderer performance baseline).
 */
describe('Spike T-004 — useConfig() data interpolation', () => {
  it('should interpolate config values into html and emit no handlebars tokens', async () => {
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
        subject: 'Welcome to Foundation',
        title: 'Verify Your Email',
        greeting: 'Hello Alex',
        bodyText: 'Please confirm your email address.',
        buttonText: 'Confirm',
        link: 'https://foundation.app/confirm?hash=abc',
      };

      const { html, plaintext } = await renderer.render(templatePath, config);

      expect(html).toContain('Welcome to Foundation');
      expect(html).toContain('Hello Alex');
      expect(html).toContain('Please confirm your email address.');
      expect(html).toContain('Confirm');
      expect(html).toContain('https://foundation.app/confirm?hash=abc');
      // Zero residual Handlebars tokens — data flows via useConfig(), not {{hbs}}.
      expect(html).not.toMatch(/\{\{[^}]+\}\}/);
      expect(typeof plaintext).toBe('string');
    } finally {
      await renderer.close();
    }
  });
});