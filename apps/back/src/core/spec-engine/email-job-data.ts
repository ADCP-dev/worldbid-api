/**
 * EmailJobDataLike — a local copy of the EmailJobData interface from
 * modules/communications/email-queue/email.processor.ts
 *
 * We re-declare it here as a type alias to avoid a circular import
 * dependency (the spec-engine module should not import from communications).
 * The actual QueuedMailerService.sendMail() accepts the same shape.
 */

export interface EmailJobDataLike {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templatePath?: string;
  context?: Record<string, unknown>;
  attachments?: unknown[];
  from?: string;
}
