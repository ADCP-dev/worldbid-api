import { Module } from '@nestjs/common';
import { MailerService } from '@infra/mailer/mailer.service';

@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
