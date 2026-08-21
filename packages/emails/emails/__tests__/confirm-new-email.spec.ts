import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * T-010 — confirm-new-email.vue (Maizzle v6 SFC replacing confirm-new-email.hbs).
 */
describe('T-010 — confirm-new-email.vue', () => {
  it(
    'should render confirm new email with interpolated config values and plaintext',
    async () => {
      const { createRenderer, createPlaintext } = await import(
        '@maizzle/framework'
      );

      const renderer = await createRenderer();
      try {
        const templatePath = resolve(__dirname, '../confirm-new-email.vue');
        const config = {
          appName: 'Foundation',
          appUrl: 'https://foundation.app',
          subject: 'Confirm your new email',
          title: 'Confirm New Email',
          greeting: 'Hello Alex',
          bodyText: 'Please confirm your new email address.',
          buttonText: 'Confirm New Email',
          link: 'https://foundation.app/confirm-new-email?hash=def456',
          lang: 'en',
        };

        const { html } = await renderer.render(templatePath, config);
        const plaintext = createPlaintext(html);

        expect(html).toContain('Confirm your new email');
        expect(html).toContain('Hello Alex');
        expect(html).toContain('Please confirm your new email address.');
        expect(html).toContain('Confirm New Email');
        expect(html).toContain('https://foundation.app/confirm-new-email');

        expect(html).not.toMatch(/\{\{[^}]+\}\}/);
        expect(html).toMatch(/<html/i);
        expect(html).toMatch(/<body/i);

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