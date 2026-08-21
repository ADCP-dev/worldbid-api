import { describe, it, expect, vi } from 'vitest';

/**
 * T-015 — buildEmailProps() helper.
 *
 * Produces a unified EmailProps shape for both email pipelines (core
 * MailService + NotificationDispatcher). Eliminates app_url vs app.url
 * naming divergence (D-05). i18n keys are pre-resolved via I18nService.t()
 * so templates receive plain strings, NOT {{t "key"}} helpers (D-08).
 */
describe('T-015 — buildEmailProps()', () => {
  it('should produce the unified EmailProps shape with camelCase app fields', async () => {
    const { buildEmailProps } = await import(
      '@comms/mail/services/build-email-props.helper'
    );

    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'mail.defaultName') return 'Foundation';
        if (key === 'app.frontendDomain') return 'https://foundation.app';
        if (key === 'app.notificationEmail') return 'notify@test.com';
        return undefined;
      }),
    };
    const i18nService = {
      t: vi.fn((key: string) => `translated:${key}`),
    };

    const props = buildEmailProps(
      configService as never,
      i18nService as never,
      { lang: 'en' },
    );

    // D-05: camelCase, not app_url / app_name.
    expect(props.appName).toBe('Foundation');
    expect(props.appUrl).toBe('https://foundation.app');
    expect(props.notificationEmail).toBe('notify@test.com');
    expect(props.lang).toBe('en');
  });

  it('should default lang to "es" when not provided', async () => {
    const { buildEmailProps } = await import(
      '@comms/mail/services/build-email-props.helper'
    );

    const configService = {
      get: vi.fn(() => ''),
    };
    const i18nService = { t: vi.fn() };

    const props = buildEmailProps(
      configService as never,
      i18nService as never,
      {},
    );

    expect(props.lang).toBe('es');
  });

  it('should pre-resolve i18n keys via I18nService.t() when subjectKey/greetingKey provided', async () => {
    const { buildEmailProps } = await import(
      '@comms/mail/services/build-email-props.helper'
    );

    const configService = { get: vi.fn(() => 'val') };
    const i18nService = {
      t: vi.fn((key: string, opts?: { lang?: string; args?: unknown }) => {
        if (opts?.args && typeof opts.args === 'object') {
          return `translated:${key}:${JSON.stringify(opts.args)}`;
        }
        return `translated:${key}`;
      }),
    };

    const props = buildEmailProps(
      configService as never,
      i18nService as never,
      {
        lang: 'en',
        subjectKey: 'common.confirmEmail',
        greetingKey: 'common.email.greeting',
        user: { name: 'Alex', email: 'alex@test.com' },
      },
    );

    // i18n was called with the key + lang.
    expect(i18nService.t).toHaveBeenCalledWith('common.confirmEmail', {
      lang: 'en',
    });
    expect(i18nService.t).toHaveBeenCalledWith('common.email.greeting', {
      lang: 'en',
      args: { name: 'Alex' },
    });
    // Pre-resolved strings are in the props.
    expect(props.subject).toBe('translated:common.confirmEmail');
    expect(props.greeting).toContain('translated:common.email.greeting');
  });

  it('should use provided subject/greeting/bodyText over i18n keys', async () => {
    const { buildEmailProps } = await import(
      '@comms/mail/services/build-email-props.helper'
    );

    const configService = { get: vi.fn(() => 'val') };
    const i18nService = { t: vi.fn() };

    const props = buildEmailProps(
      configService as never,
      i18nService as never,
      {
        lang: 'en',
        subject: 'Direct Subject',
        subjectKey: 'common.confirmEmail',
      },
    );

    // Direct value wins over key.
    expect(props.subject).toBe('Direct Subject');
    expect(i18nService.t).not.toHaveBeenCalled();
  });

  it('should pass through extension-specific data via spread', async () => {
    const { buildEmailProps } = await import(
      '@comms/mail/services/build-email-props.helper'
    );

    const configService = { get: vi.fn(() => 'val') };
    const i18nService = { t: vi.fn() };

    const props = buildEmailProps(
      configService as never,
      i18nService as never,
      {
        lang: 'en',
        invoiceNumber: 'INV-001',
        amount: '99.00',
        customField: { nested: true },
      },
    );

    // Extension-specific data passes through.
    expect(props.invoiceNumber).toBe('INV-001');
    expect(props.amount).toBe('99.00');
    expect(props.customField).toEqual({ nested: true });
  });
});