import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '../mailer/mailer.service';
import { Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';

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
      // The job will be automatically retried based on the queue configuration
      throw error;
    }
  }
}
