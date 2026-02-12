import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerModule } from '../mailer/mailer.module';
import { EmailQueueModule } from '../email-queue/email-queue.module';

@Module({
  imports: [ConfigModule, MailerModule, EmailQueueModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
