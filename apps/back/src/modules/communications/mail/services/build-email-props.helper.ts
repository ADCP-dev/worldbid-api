import type { ConfigService } from '@nestjs/config';
import type { I18nService } from 'nestjs-i18n';

/**
 * Unified email props shape (D-05).
 *
 * This is the config object passed to TemplateRenderer.render() and accessed
 * via useConfig() inside .vue SFCs (C-01). Eliminates app_url vs app.url
 * naming divergence — all fields are camelCase.
 */
export interface EmailProps {
  appName: string;
  appUrl: string;
  notificationEmail: string;
  lang: string;
  subject?: string;
  greeting?: string;
  bodyText?: string;
  buttonText?: string;
  link?: string;
  title?: string;
  user?: { name: string; email: string };
  entity?: Record<string, unknown>;
  ignoreText?: string;
  [key: string]: unknown;
}

/**
 * Partial shape accepted by buildEmailProps — allows callers to pass either
 * direct values or i18n keys (pre-resolved by the helper).
 */
export interface PartialEmailProps {
  lang?: string;
  subject?: string;
  subjectKey?: string;
  greeting?: string;
  greetingKey?: string;
  bodyText?: string;
  buttonText?: string;
  link?: string;
  title?: string;
  user?: { name: string; email: string };
  entity?: Record<string, unknown>;
  ignoreText?: string;
  [key: string]: unknown;
}

/**
 * buildEmailProps — constructs the unified EmailProps config object.
 *
 * Pre-resolves i18n keys via I18nService.t(key, { lang }) so templates
 * receive plain strings, NOT {{t "key"}} helpers (D-08).
 *
 * Direct values (subject, greeting, bodyText) take precedence over i18n
 * keys (subjectKey, greetingKey) — callers can override when needed.
 *
 * Extension-specific data passes through via spread.
 */
export function buildEmailProps(
  config: ConfigService,
  i18n: I18nService,
  partial: PartialEmailProps,
): EmailProps {
  const lang = partial.lang ?? 'es';

  const subject =
    partial.subject ??
    (partial.subjectKey ? i18n.t(partial.subjectKey, { lang }) : undefined);

  const greeting =
    partial.greeting ??
    (partial.greetingKey
      ? i18n.t(partial.greetingKey, {
          lang,
          args: { name: partial.user?.name },
        })
      : undefined);

  return {
    appName: config.get<string>('mail.defaultName') ?? '',
    appUrl: config.get<string>('app.frontendDomain') ?? '',
    notificationEmail: config.get<string>('app.notificationEmail') ?? '',
    lang,
    subject,
    greeting,
    bodyText: partial.bodyText,
    buttonText: partial.buttonText,
    link: partial.link,
    title: partial.title,
    user: partial.user,
    entity: partial.entity,
    ignoreText: partial.ignoreText,
    ...partial,
  };
}