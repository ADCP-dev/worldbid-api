import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebController } from './web.controller';
import { WebService } from './web.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { MailModule } from '@comms/mail/mail.module';

// Extension `web` — public web app support (contact form, ISR webhook sender).
// Auto-discovered by ExtensionLoaderModule (NO app.module.ts edit needed).
// No DB tables (R-CS-03) — contact is email-only.
// WebhookDispatchService is exported so the CMS services can inject it (R-CMS-A-01..04).
@Module({
  imports: [ConfigModule, MailModule],
  controllers: [WebController],
  providers: [WebService, WebhookDispatchService],
  exports: [WebService, WebhookDispatchService],
})
export class WebExtensionModule {}