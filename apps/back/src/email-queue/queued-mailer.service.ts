import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData } from './email.processor';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueuedMailerService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(data: EmailJobData): Promise<void> {
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
  }
}
