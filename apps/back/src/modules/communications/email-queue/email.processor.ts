import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@infra/mailer/mailer.service';
import { Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { ErrorTrackerService } from '@src/modules/error-tracker/error-tracker.service';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templatePath?: string;
  context?: Record<string, unknown>;
  attachments?: any[];
  from?: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly errorTrackerService: ErrorTrackerService,
  ) {
    super();
    // Create a transporter for direct email sending
    this.transporter = nodemailer.createTransport({
      host: configService.get('mail.host', { infer: true }),
      port: configService.get('mail.port', { infer: true }),
      ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
      secure: configService.get('mail.secure', { infer: true }),
      requireTLS: configService.get('mail.requireTLS', { infer: true }),
      auth: {
        user: configService.get('mail.user', { infer: true }),
        pass: configService.get('mail.password', { infer: true }),
      },
    });
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    // Only handle 'send-email' jobs
    if (job.name !== 'send-email') {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    try {
      this.logger.log(`Processing email job ${job.id} to: ${job.data.to}`);

      // If templatePath is provided, we need to process the template ourselves
      let finalHtml = job.data.html;
      if (job.data.templatePath) {
        // Ensure context exists and add app_url to it
        if (!job.data.context) {
          job.data.context = {};
        }

        const backendDomain = this.configService.get<string>(
          'app.backendDomain',
          {
            infer: true,
          },
        );
        if (backendDomain) {
          job.data.context.app_url = backendDomain;
        } else {
          // Fallback value if backendDomain is not configured
          job.data.context.app_url = 'http://localhost';
        }

        const template = await fs.readFile(job.data.templatePath, 'utf-8');
        finalHtml = Handlebars.compile(template, {
          strict: true,
        })(job.data.context);
      }

      // Send the email directly using nodemailer transporter
      await this.transporter.sendMail({
        to: job.data.to,
        subject: job.data.subject,
        html: finalHtml,
        text: job.data.text,
        attachments: job.data.attachments || [],
        from:
          job.data.from ||
          `"${this.configService.get('mail.defaultName', {
            infer: true,
          })}" <${this.configService.get('mail.defaultEmail', {
            infer: true,
          })}>`,
      });

      this.logger.log(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed:`, error);
      // Persist to the error-tracker so the team notices when an email
      // job exhausts its retries (Bull logs to stdout otherwise). The
      // job is then re-thrown so Bull's retry policy can do its job.
      await this.errorTrackerService
        .logError({
          message: `Email job ${job.id} to ${Array.isArray(job.data.to) ? job.data.to.join(',') : job.data.to} failed: ${(error as Error).message}`,
          source: 'EmailProcessor.process',
          stack: (error as Error).stack,
          metadata: {
            jobId: job.id,
            jobName: job.name,
            attemptsMade: job.attemptsMade,
            subject: job.data.subject,
          },
        })
        .catch((err) =>
          this.logger.error(
            'ErrorTracker: failed to persist email failure',
            err,
          ),
        );
      throw error;
    }
  }
}
