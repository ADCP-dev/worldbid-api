import { Module } from '@nestjs/common';
import { MailModule } from '@comms/mail/mail.module';
import { HomeModule } from '@comms/home/home.module';

@Module({
  imports: [MailModule, HomeModule],
  exports: [MailModule, HomeModule],
})
export class CommsModule {}
