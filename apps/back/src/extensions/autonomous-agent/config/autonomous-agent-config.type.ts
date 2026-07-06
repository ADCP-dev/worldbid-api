export type AutonomousAgentConfig = {
  /** Prefix used for BullMQ queue/worker names so multiple instances can coexist. */
  queuePrefix: string;
  /** Default cron expression for the research phase (daily 09:00). */
  defaultResearchCron: string;
  /** Default cron expression for the generate phase (daily 10:00). */
  defaultGenerateCron: string;
  /** Default cron expression for the publish phase (daily 18:00). */
  defaultPublishCron: string;
  /** Default cron expression for the metrics phase (Mondays 09:00). */
  defaultMetricsCron: string;
  /** Optional notification email override; falls back to app.notificationEmail. */
  notificationEmail?: string;
};