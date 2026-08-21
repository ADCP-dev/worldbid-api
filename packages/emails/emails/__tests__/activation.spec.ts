import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * T-008 — activation.vue (Maizzle v6 SFC replacing activation.hbs).
 *
 * The template must:
 *   - useConfig() to receive per-render data (C-01 — NOT defineProps)
 *   - use Maizzle components (<Html>, <Head>, <Body>, <Container>, <Text>,
 *     <Button>) — NOT raw <html>/<body> tags
 *   - import the shared Layout from @emails/Layout.vue
 *   - produce zero residual {{handlebars}} tokens
 *   - generate plaintext via createPlaintext(html) (DEVIATION 1 — the
 *     reusable renderer returns plaintext as a config object, not a string)
 */
describe('T-008 — activation.vue', () => {
  it(
    'should render activation email with interpolated config values and plaintext',
    async () => {
      const { createRenderer, createPlaintext } = await import(
        '@maizzle/framework'
      );

      const renderer = await createRenderer();
      try {
        const templatePath = resolve(__dirname, '../activation.vue');
        const config = {
          appName: 'Foundation',
          appUrl: 'https://foundation.app',
          subject: 'Confirm your email',
          title: 'Verify Your Email',
          greeting: 'Hello Alex',
          bodyText: 'Please confirm your email address.',
          buttonText: 'Confirm Email',
          link: 'https://foundation.app/confirm?hash=abc123',
          ignoreText: 'If you did not create an account, ignore this email.',
          lang: 'en',
        };

        const { html } = await renderer.render(templatePath, config);
        const plaintext = createPlaintext(html);

        // Config data flows via useConfig() into the rendered HTML.
        expect(html).toContain('Confirm your email');
        expect(html).toContain('Hello Alex');
        expect(html).toContain('Please confirm your email address.');
        expect(html).toContain('Confirm Email');
        expect(html).toContain('https://foundation.app/confirm?hash=abc123');
        expect(html).toContain('If you did not create an account');

        // Zero residual Handlebars tokens.
        expect(html).not.toMatch(/\{\{[^}]+\}\}/);

        // Maizzle components produce a full HTML document.
        expect(html).toMatch(/<html/i);
        expect(html).toMatch(/<body/i);

        // Plaintext is a non-empty string (DEVIATION 1).
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