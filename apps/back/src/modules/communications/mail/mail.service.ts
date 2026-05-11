import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { MailData } from '@comms/mail/interfaces/mail-data.interface';
import { AllConfigType } from '@src/config/config.type';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { MailerService } from '@infra/mailer/mailer.service';
import { getMailTemplatePath } from './helpers/mail-template-path.helper';

@Injectable()
export class MailService {
  constructor(
    private readonly queuedMailerService: QueuedMailerService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Merge global context (app_name, app_url) into email template context.
   * So each method doesn't have to repeat these fields.
   */
  private buildContext(
    custom: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      app_name: this.configService.get('app.name', { infer: true }),
      app_url: this.configService.getOrThrow('app.backendDomain', {
        infer: true,
      }),
      ...custom,
    };
  }

  async userSignUp(
    mailData: MailData<{
      hash: string;
      user?: { language?: string; firstName?: string };
    }>,
    async: boolean = true,
  ): Promise<void> {
    const lang = mailData.data?.user?.language ?? 'en';
    const name = mailData.data?.user?.firstName ?? '';

    const subject = this.i18nService.t('common.confirmEmail', { lang });
    const greeting = this.i18nService.t('common.email.greeting', {
      lang,
      args: { name },
    });
    const bodyText = this.i18nService.t('common.email.activationBody', {
      lang,
    });
    const buttonText = this.i18nService.t('common.email.confirmButton', {
      lang,
    });
    const ignoreText = this.i18nService.t('common.email.ignoreIfNotYou', {
      lang,
    });

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/confirm-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const mailOptions = {
      to: mailData.to,
      subject: subject || 'Confirm your email',
      text: url.toString(),
      templatePath: getMailTemplatePath('activation.hbs'),
      context: this.buildContext({
        title: subject,
        subject,
        link: url.toString(),
        greeting,
        body_text: bodyText,
        button_text: buttonText,
        ignore_text: ignoreText,
      }),
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

    const subject = this.i18nService.t('common.resetPassword', { lang });
    const greeting = this.i18nService.t('common.email.greeting', {
      lang,
      args: { name },
    });
    const bodyText = this.i18nService.t('common.email.resetBody', { lang });
    const buttonText = this.i18nService.t('common.email.resetButton', { lang });
    const ignoreText = this.i18nService.t('common.email.ignoreIfNotYou', {
      lang,
    });

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/password-change',
    );
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    const mailOptions = {
      to: mailData.to,
      subject: subject || 'Reset your password',
      text: url.toString(),
      templatePath: getMailTemplatePath('reset-password.hbs'),
      context: this.buildContext({
        title: subject,
        subject,
        link: url.toString(),
        greeting,
        body_text: bodyText,
        button_text: buttonText,
        ignore_text: ignoreText,
      }),
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

    const subject = this.i18nService.t('common.confirmNewEmail', { lang });
    const greeting = this.i18nService.t('common.email.greeting', {
      lang,
      args: { name },
    });
    const bodyText = this.i18nService.t('common.email.newEmailBody', { lang });
    const buttonText = this.i18nService.t('common.email.newEmailButton', {
      lang,
    });

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', { infer: true }) +
        '/confirm-new-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const mailOptions = {
      to: mailData.to,
      subject: subject || 'Confirm your new email',
      text: url.toString(),
      templatePath: getMailTemplatePath('confirm-new-email.hbs'),
      context: this.buildContext({
        title: subject,
        subject,
        link: url.toString(),
        greeting,
        body_text: bodyText,
        button_text: buttonText,
      }),
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  async invoicePaymentConfirmed(
    mailData: MailData<{
      invoiceNumber: string;
      amount: string;
      currency: string;
      attachment?: {
        filename: string;
        content: string;
        contentType: string;
      };
    }>,
  ): Promise<void> {
    const emailData = mailData.data;
    const attachments = emailData.attachment
      ? [
          {
            filename: emailData.attachment.filename,
            content: Buffer.from(emailData.attachment.content, 'base64'),
            contentType: emailData.attachment.contentType,
          },
        ]
      : [];

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: `Factura ${emailData.invoiceNumber} - ${emailData.amount} ${emailData.currency}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#1f2937">Factura ${emailData.invoiceNumber}</h2>
          <p>Adjuntamos tu factura por importe de <strong>${emailData.amount} ${emailData.currency}</strong>.</p>
          <p>Gracias por tu confianza.</p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">Ikiraisolutions - Facturación automática</p>
        </div>
      `,
      attachments,
      templatePath: '',
      context: {},
    });
  }
}
