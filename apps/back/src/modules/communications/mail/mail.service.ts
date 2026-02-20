import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from '@comms/mail/interfaces/mail-data.interface';

import { MaybeType } from '@infra/utils/types/maybe.type';
import path from 'path';
import { AllConfigType } from '@src/config/config.type';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { MailerService } from '@infra/mailer/mailer.service';

@Injectable()
export class MailService {
  constructor(
    private readonly queuedMailerService: QueuedMailerService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(
    mailData: MailData<{ hash: string }>,
    async: boolean = true,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-email.text1'),
        i18n.t('confirm-email.text2'),
        i18n.t('confirm-email.text3'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const mailOptions = {
      to: mailData.to,
      subject: emailConfirmTitle || 'Confirm your email',
      text: `${url.toString()} ${emailConfirmTitle || 'Confirm your email'}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'modules',
        'communications',
        'mail',
        'mail-templates',
        'build',
        'activation.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
    async: boolean = true,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let resetPasswordTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;
    let text4: MaybeType<string>;

    if (i18n) {
      [resetPasswordTitle, text1, text2, text3, text4] = await Promise.all([
        i18n.t('common.resetPassword'),
        i18n.t('reset-password.text1'),
        i18n.t('reset-password.text2'),
        i18n.t('reset-password.text3'),
        i18n.t('reset-password.text4'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/password-change',
    );
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    const mailOptions = {
      to: mailData.to,
      subject: resetPasswordTitle || 'Reset your password',
      text: `${url.toString()} ${resetPasswordTitle || 'Reset your password'}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'modules',
        'communications',
        'mail',
        'mail-templates',
        'build',
        'reset-password.hbs',
      ),
      context: {
        title: resetPasswordTitle,
        url: url.toString(),
        actionTitle: resetPasswordTitle,
        app_name: this.configService.get('app.name', {
          infer: true,
        }),
        text1,
        text2,
        text3,
        text4,
      },
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }

  async confirmNewEmail(
    mailData: MailData<{ hash: string }>,
    async: boolean = true,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-new-email.text1'),
        i18n.t('confirm-new-email.text2'),
        i18n.t('confirm-new-email.text3'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-new-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    const mailOptions = {
      to: mailData.to,
      subject: emailConfirmTitle || 'Confirm your email',
      text: `${url.toString()} ${emailConfirmTitle || 'Confirm your email'}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'modules',
        'communications',
        'mail',
        'mail-templates',
        'build',
        'confirm-new-email.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    };

    if (async) {
      await this.queuedMailerService.sendMail(mailOptions);
    } else {
      await this.mailerService.sendMail(mailOptions);
    }
  }
}
