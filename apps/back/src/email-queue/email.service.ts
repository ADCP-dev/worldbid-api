import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData } from './email.processor';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(data: EmailJobData): Promise<void> {
    // Add the job to the queue
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

  /**
   * Send email directly without queue (useful for urgent/transactional emails)
   * Note: This method is not implemented as it depends on a mailer service that is not injected.
   * Use sendEmail() which queues the email for processing by the EmailProcessor.
   */
  async sendEmailDirect(data: EmailJobData): Promise<void> {
    // This method is not implemented in this service
    // Email sending is performed via the queue and EmailProcessor
    throw new Error(
      'sendEmailDirect is not implemented in EmailService. Use sendEmail() method which uses the queue instead.',
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const counts = await this.emailQueue.getJobCounts();
    return counts;
  }

  /**
   * Get a list of waiting jobs
   */
  async getWaitingJobs(limit = 10) {
    const jobs = await this.emailQueue.getWaiting(0, limit - 1);
    return jobs.map((job) => ({
      id: job.id,
      data: job.data,
      timestamp: job.timestamp,
    }));
  }
}
