import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from '@comms/mail/mail.service';
import { MailerModule } from '@infra/mailer/mailer.module';
import { EmailQueueModule } from '@comms/email-queue/email-queue.module';

@Module({
  imports: [ConfigModule, MailerModule, EmailQueueModule.register()],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
