import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJobData } from '@comms/email-queue/email.processor';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    @Optional() @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async sendEmail(data: EmailJobData): Promise<void> {
    if (!this.emailQueue) {
      throw new Error('Email queue is not available. Please enable Redis.');
    }
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
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.emailQueue) return null;
    const counts = await this.emailQueue.getJobCounts();
    return counts;
  }

  /**
   * Get a list of waiting jobs
   */
  async getWaitingJobs(limit = 10) {
    if (!this.emailQueue) return [];
    const jobs = await this.emailQueue.getWaiting(0, limit - 1);
    return jobs.map((job) => ({
      id: job.id,
      data: job.data,
      timestamp: job.timestamp,
    }));
  }
}
