import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { QueuedMailerService } from './queued-mailer.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('worker.host'),
          port: configService.get('worker.port'),
          db: configService.get('worker.db'),
          username: configService.get('worker.username'),
          password: configService.get('worker.password'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailProcessor, EmailService, MailerService, QueuedMailerService],
  exports: [EmailService, QueuedMailerService, BullModule],
})
export class EmailQueueModule {}
