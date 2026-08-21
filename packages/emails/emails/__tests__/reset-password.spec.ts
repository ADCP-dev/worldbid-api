import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

/**
 * T-009 — reset-password.vue (Maizzle v6 SFC replacing reset-password.hbs).
 */
describe('T-009 — reset-password.vue', () => {
  it(
    'should render reset password email with interpolated config values and plaintext',
    async () => {
      const { createRenderer, createPlaintext } = await import(
        '@maizzle/framework'
      );

      const renderer = await createRenderer();
      try {
        const templatePath = resolve(__dirname, '../reset-password.vue');
        const config = {
          appName: 'Foundation',
          appUrl: 'https://foundation.app',
          subject: 'Reset your password',
          title: 'Password Reset',
          greeting: 'Hello Alex',
          bodyText: 'We received a request to reset your password.',
          buttonText: 'Reset Password',
          link: 'https://foundation.app/password-change?hash=xyz&expires=123',
          ignoreText: 'If you did not request a password reset, ignore this email.',
          lang: 'en',
        };

        const { html } = await renderer.render(templatePath, config);
        const plaintext = createPlaintext(html);

        expect(html).toContain('Reset your password');
        expect(html).toContain('Hello Alex');
        expect(html).toContain('We received a request to reset your password.');
        expect(html).toContain('Reset Password');
        expect(html).toContain('https://foundation.app/password-change');
        expect(html).toContain('If you did not request a password reset');

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