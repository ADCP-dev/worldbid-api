import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { ErrorTrackerService } from '@src/modules/error-tracker/error-tracker.service';
import { TemplateRenderer } from '@comms/mail/services/template-renderer.service';
import { EmailDiscoveryService } from '@comms/mail/services/email-discovery.service';

/**
 * Email job data shape (T-019).
 *
 * Changed from { templatePath, context } to { templateName, config } where
 * templateName is resolved by EmailDiscoveryService and config is the
 * Maizzle render config (accessed via useConfig() in the SFC).
 *
 * `html` is a pre-rendered fallback (when no templateName is provided).
 * `attachments`, `from`, `to`, `subject` are transport-level fields.
 */
export interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateName?: string;
  config?: Record<string, unknown>;
  attachments?: unknown[];
  from?: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly mailerService: { sendMail: (data: Record<string, unknown>) => Promise<void> },
    private readonly configService: ConfigService,
    private readonly errorTrackerService: ErrorTrackerService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly emailDiscoveryService: EmailDiscoveryService,
  ) {
    super();
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
    if (job.name !== 'send-email') {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    try {
      this.logger.log(`Processing email job ${job.id} to: ${job.data.to}`);

      let finalHtml = job.data.html;
      let finalText = job.data.text;

      // Render via TemplateRenderer when a templateName is provided.
      if (job.data.templateName) {
        const templatePath = await this.emailDiscoveryService.resolveByName(
          job.data.templateName,
        );
        if (!templatePath) {
          throw new Error(
            `Template not found: ${job.data.templateName}`,
          );
        }
        const result = await this.templateRenderer.render(
          templatePath,
          job.data.config ?? {},
        );
        finalHtml = result.html;
        if (!finalText && result.plaintext) {
          finalText = result.plaintext;
        }
      }

      await this.transporter.sendMail({
        to: job.data.to,
        subject: job.data.subject,
        html: finalHtml,
        text: finalText,
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