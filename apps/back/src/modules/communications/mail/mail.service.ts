import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { MailData } from '@comms/mail/interfaces/mail-data.interface';
import type { AllConfigType } from '@src/config/config.type';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { MailerService } from '@infra/mailer/mailer.service';
import { TemplateRenderer } from '@comms/mail/services/template-renderer.service';
import { EmailDiscoveryService } from '@comms/mail/services/email-discovery.service';
import {
  buildEmailProps,
} from '@comms/mail/services/build-email-props.helper';

/**
 * MailService — core email sending service.
 *
 * Refactored (T-020/T-021): uses buildEmailProps() for unified config
 * construction + TemplateRenderer for .vue template rendering. Eliminates
 * getMailTemplatePath, Handlebars, and inline HTML.
 *
 * The `async` flag (queue vs sync) is preserved per the spec.
 */
@Injectable()
export class MailService {
  constructor(
    private readonly queuedMailerService: QueuedMailerService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly i18nService: I18nService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly emailDiscoveryService: EmailDiscoveryService,
  ) {}

  async userSignUp(
    mailData: MailData<{
      hash: string;
      user?: { language?: string; firstName?: string };
    }>,
    async: boolean = true,
  ): Promise<void> {
    const lang = mailData.data?.user?.language ?? 'en';
    const name = mailData.data?.user?.firstName ?? '';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/confirm-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const props = buildEmailProps(this.configService, this.i18nService, {
      lang,
      subjectKey: 'common.confirmEmail',
      greetingKey: 'common.email.greeting',
      user: { name, email: mailData.to },
      bodyText: this.i18nService.t('common.email.activationBody', { lang }),
      buttonText: this.i18nService.t('common.email.confirmButton', { lang }),
      ignoreText: this.i18nService.t('common.email.ignoreIfNotYou', { lang }),
      title: this.i18nService.t('common.confirmEmail', { lang }),
      link: url.toString(),
    });

    const subject = props.subject || 'Confirm your email';
    const templatePath = await this.emailDiscoveryService.resolveByName(
      'activation',
    );

    const mailOptions = {
      to: mailData.to,
      subject,
      text: url.toString(),
      templatePath: templatePath ?? '',
      context: props as Record<string, unknown>,
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  async forgotPassword(
    mailData: MailData<{
      hash: string;
      tokenExpires: number;
      user?: { language?: string; firstName?: string };
    }>,
    async: boolean = true,
  ): Promise<void> {
    const lang = mailData.data?.user?.language ?? 'en';
    const name = mailData.data?.user?.firstName ?? '';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/password-change',
    );
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    const props = buildEmailProps(this.configService, this.i18nService, {
      lang,
      subjectKey: 'common.resetPassword',
      greetingKey: 'common.email.greeting',
      user: { name, email: mailData.to },
      bodyText: this.i18nService.t('common.email.resetBody', { lang }),
      buttonText: this.i18nService.t('common.email.resetButton', { lang }),
      ignoreText: this.i18nService.t('common.email.ignoreIfNotYou', { lang }),
      title: this.i18nService.t('common.resetPassword', { lang }),
      link: url.toString(),
    });

    const subject = props.subject || 'Reset your password';
    const templatePath = await this.emailDiscoveryService.resolveByName(
      'reset-password',
    );

    const mailOptions = {
      to: mailData.to,
      subject,
      text: url.toString(),
      templatePath: templatePath ?? '',
      context: props as Record<string, unknown>,
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  async confirmNewEmail(
    mailData: MailData<{
      hash: string;
      user?: { language?: string; firstName?: string };
    }>,
    async: boolean = true,
  ): Promise<void> {
    const lang = mailData.data?.user?.language ?? 'en';
    const name = mailData.data?.user?.firstName ?? '';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/confirm-new-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const props = buildEmailProps(this.configService, this.i18nService, {
      lang,
      subjectKey: 'common.confirmNewEmail',
      greetingKey: 'common.email.greeting',
      user: { name, email: mailData.to },
      bodyText: this.i18nService.t('common.email.newEmailBody', { lang }),
      buttonText: this.i18nService.t('common.email.newEmailButton', { lang }),
      title: this.i18nService.t('common.confirmNewEmail', { lang }),
      link: url.toString(),
    });

    const subject = props.subject || 'Confirm your new email';
    const templatePath = await this.emailDiscoveryService.resolveByName(
      'confirm-new-email',
    );

    const mailOptions = {
      to: mailData.to,
      subject,
      text: url.toString(),
      templatePath: templatePath ?? '',
      context: props as Record<string, unknown>,
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  /**
   * Send a contact form notification to the site owner (R-CS-06/07, GAP2).
   *
   * - Recipient: app.notificationEmail via getOrThrow (fails loudly if unset).
   * - Template: contact-notification.vue (Maizzle v6, via TemplateRenderer)
   * - Sends synchronously via mailerService.sendMail (NOT queued) — contact
   *   must surface SMTP failures immediately so the controller can return 500.
   * - Throws on any failure (render error, SMTP down, missing config).
   *
   * Config passed to the template via useConfig():
   *   subject, greeting, name, email, message, logoUrl, replyUrl, lang
   */
  async contactFormNotification(
    name: string,
    email: string,
    message: string,
    lang: string = 'es',
  ): Promise<void> {
    const to = this.configService.getOrThrow('app.notificationEmail', {
      infer: true,
    });

    const subject =
      lang === 'en'
        ? `New contact form message from ${name}`
        : `Nuevo mensaje de contacto de ${name}`;

    const greeting =
      lang === 'en'
        ? `You received a new message from the contact form:`
        : `Recibiste un nuevo mensaje del formulario de contacto:`;

    // Logo is synced to apps/back/public/assets/logo.svg by scripts/sync-assets.mjs.
    const backendDomain = this.configService.get<string>('app.backendDomain', {
      infer: true,
    });
    const logoUrl = backendDomain
      ? `${backendDomain.replace(/\/$/, '')}/assets/logo.svg`
      : undefined;

    const replyUrl = `mailto:${email}`;

    const props = buildEmailProps(this.configService, this.i18nService, {
      lang,
      subject,
      greeting,
      name,
      email,
      message,
      title: subject,
      logoUrl,
      replyUrl,
    });

    const templatePath = await this.emailDiscoveryService.resolveByName(
      'contact-notification',
    );

    await this.mailerService.sendMail({
      to,
      subject,
      text: `De: ${name} <${email}>\n\n${message}`,
      templatePath: templatePath ?? '',
      context: props as Record<string, unknown>,
    });
  }
}