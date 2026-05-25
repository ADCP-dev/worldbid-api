import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from '@comms/mail/mail.service';
import { MailerModule } from '@infra/mailer/mailer.module';
import { EmailQueueModule } from '@comms/email-queue/email-queue.module';
import { initMailTemplatePath } from './helpers/mail-template-path.helper';
import type { AllConfigType } from '@src/config/config.type';

@Module({
  imports: [ConfigModule, MailerModule, EmailQueueModule.register()],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {
  constructor(configService: ConfigService<AllConfigType>) {
    initMailTemplatePath(configService);
  }
}
