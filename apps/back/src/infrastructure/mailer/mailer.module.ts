import { Module } from '@nestjs/common';
import { MailerService } from '@infra/mailer/mailer.service';
import { TemplateRenderer } from '@comms/mail/services/template-renderer.service';
import { EmailDiscoveryService } from '@comms/mail/services/email-discovery.service';

@Module({
  providers: [MailerService, TemplateRenderer, EmailDiscoveryService],
  exports: [MailerService, TemplateRenderer, EmailDiscoveryService],
})
export class MailerModule {}