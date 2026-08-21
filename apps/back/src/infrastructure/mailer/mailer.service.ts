import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { AllConfigType } from '@src/config/config.type';
import { TemplateRenderer } from '@comms/mail/services/template-renderer.service';

/**
 * MailerService — sends emails via nodemailer.
 *
 * Refactored (T-018): uses TemplateRenderer for .vue template rendering
 * instead of fs.readFile + Handlebars.compile. Eliminates Handlebars dep.
 *
 * The `templatePath` field now points to a .vue SFC (absolute path). The
 * `context` field is the Maizzle config object passed to
 * TemplateRenderer.render() — accessed via useConfig() in the SFC (C-01).
 *
 * Pre-rendered `html` is still supported (when templatePath is empty) for
 * callers that build HTML inline (e.g. fallback emails).
 *
 * Unified from address: mail.defaultName <mail.defaultEmail> (D-06).
 */
@Injectable()
export class MailerService {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly templateRenderer: TemplateRenderer,
  ) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('mail.host', { infer: true }),
      port: configService.get('mail.port', { infer: true }),
      ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
      secure: configService.get('mail.secure', { infer: true }),
      requireTLS: configService.get('mail.requireTLS', { infer: true }),
      auth: {
        user: configService.get('mail.user', { infer: true }),
        pass: configService.get('mail.password', { infer: true }),
      },
    });
  }

  async sendMail({
    templatePath,
    context,
    ...mailOptions
  }: nodemailer.SendMailOptions & {
    templatePath: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    let html: string | undefined = mailOptions.html;

    if (templatePath) {
      const result = await this.templateRenderer.render(
        templatePath,
        context ?? {},
      );
      html = result.html;
      // Use generated plaintext if no explicit text was provided.
      if (!mailOptions.text && result.plaintext) {
        mailOptions.text = result.plaintext;
      }
    }

    await this.transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from
        ? mailOptions.from
        : `"${this.configService.get('mail.defaultName', {
            infer: true,
          })}" <${this.configService.get('mail.defaultEmail', {
            infer: true,
          })}>`,
      html,
      attachments: mailOptions.attachments || [],
    });
  }
}