import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { AaRunEntity } from '@ext/autonomous-agent/infrastructure/persistence/entities/aa-run.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly queuedMailerService: QueuedMailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolve the notification email using the standard chain:
   *   autonomous-agent.notificationEmail → app.notificationEmail
   * Returns undefined if neither is set.
   */
  private resolveEmail(): string | undefined {
    return (
      this.configService.get('autonomous-agent', { infer: true })
        ?.notificationEmail ||
      this.configService.get('app', { infer: true })?.notificationEmail
    );
  }

  /**
   * Notify that a pipeline run has completed (or failed).
   * Only sends when notifyEmail is enabled on the config (handled by the
   * caller) and a notification email is resolvable.
   */
  async notifyRunComplete(
    run: AaRunEntity,
    opts?: { enabled?: boolean },
  ): Promise<void> {
    if (opts?.enabled === false) {
      this.logger.debug(
        `notifyRunComplete: email notifications disabled for run ${run.id}`,
      );
      return;
    }

    const email = this.resolveEmail();
    if (!email) {
      this.logger.warn(
        'notifyRunComplete: no notificationEmail configured — skipping',
      );
      return;
    }

    const statusLabel = run.status.toUpperCase();
    const subject = `[Autonomous-Agent] Run ${statusLabel} — ${run.runType} (${run.projectId})`;
    const lines: string[] = [];
    lines.push(`Autonomous-Agent run ${statusLabel}`);
    lines.push('');
    lines.push(`Run ID:     ${run.id}`);
    lines.push(`Project:    ${run.projectId}`);
    lines.push(`Type:       ${run.runType}`);
    lines.push(`Status:     ${run.status}`);
    if (run.startedAt) lines.push(`Started:    ${run.startedAt.toISOString()}`);
    if (run.completedAt)
      lines.push(`Completed:  ${run.completedAt.toISOString()}`);
    if (run.duration != null) lines.push(`Duration:   ${run.duration}ms`);
    if (run.errorMessage) lines.push(`Error:      ${run.errorMessage}`);
    if (run.output && Object.keys(run.output).length > 0) {
      lines.push(`Output:     ${JSON.stringify(run.output)}`);
    }
    const text = lines.join('\n');

    try {
      await this.queuedMailerService.sendMail({ to: email, subject, text });
      this.logger.log(`notifyRunComplete: sent to ${email} (run ${run.id})`);
    } catch (err: unknown) {
      this.logger.error(
        `notifyRunComplete: failed to send email: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Send a weekly metrics report for a project.
   */
  async notifyWeeklyReport(
    projectId: string,
    metrics: Record<string, unknown>,
  ): Promise<void> {
    const email = this.resolveEmail();
    if (!email) {
      this.logger.warn(
        'notifyWeeklyReport: no notificationEmail configured — skipping',
      );
      return;
    }

    const period = `${new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}`;
    const subject = `[Autonomous-Agent] Weekly report — ${projectId}`;
    const lines: string[] = [];
    lines.push(`Autonomous-Agent weekly report`);
    lines.push(`Project: ${projectId}`);
    lines.push(`Period:  ${period}`);
    lines.push('');
    lines.push('Metrics:');
    for (const [k, v] of Object.entries(metrics)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
    const text = lines.join('\n');

    try {
      await this.queuedMailerService.sendMail({ to: email, subject, text });
      this.logger.log(
        `notifyWeeklyReport: sent to ${email} (project ${projectId})`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `notifyWeeklyReport: failed to send email: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}