import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData } from '@comms/email-queue/email.processor';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@infra/mailer/mailer.service';

@Injectable()
export class QueuedMailerService {
  constructor(
    @Optional() @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(data: EmailJobData): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    const isRedisEnabled = this.configService.get('worker.enabled');

    if (isRedisEnabled && this.emailQueue) {
      // Add the email job to the queue
      await this.emailQueue.add('send-email', data, {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second delay
        },
        removeOnComplete: true, // Remove successful jobs after completion
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
        },
      });
    } else {
      // Fallback to synchronous sending if Redis is not enabled or queue is not available
      await this.mailerService.sendMail(data);
    }
  }
}
