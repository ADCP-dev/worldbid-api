/* eslint-disable no-restricted-syntax */
import { Module, Global, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from '@comms/email-queue/email.processor';
import { EmailService } from '@comms/email-queue/email.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@infra/mailer/mailer.module';
import { ErrorTrackerModule } from '@src/modules/error-tracker/error-tracker.module';

@Global()
@Module({})
export class EmailQueueModule {
  static register(): DynamicModule {
    const workerHost = process.env.WORKER_HOST;
    // Strictly check if Redis connection string is provided and valid
    const isRedisEnabled =
      typeof workerHost === 'string' &&
      workerHost.length > 0 &&
      workerHost !== 'undefined' &&
      workerHost !== 'null';

    // eslint-disable-next-line no-console -- startup log
    console.log(
      `[EmailQueueModule] Redis enabled: ${isRedisEnabled}${isRedisEnabled ? ` (${workerHost})` : ''}`,
    );

    const imports: any[] = [MailerModule, ErrorTrackerModule];
    const providers: any[] = [EmailService, QueuedMailerService];
    const exports: any[] = [EmailService, QueuedMailerService];

    if (isRedisEnabled) {
      imports.push(
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
      );
      providers.push(EmailProcessor);
      exports.push(BullModule);
    }

    return {
      module: EmailQueueModule,
      imports,
      providers,
      exports,
      global: true,
    };
  }
}
