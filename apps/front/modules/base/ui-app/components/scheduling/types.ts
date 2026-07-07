/**
 * Scheduling component types.
 *
 * Cron fields follow the 5-field POSIX order:
 *   minute hour day-of-month month day-of-week
 *
 * Cron values are emitted as-is, in the timezone selected by the user via
 * the `timezone` prop (display only). No UTC conversion is performed in v1.
 * Consumers (e.g. NestJS `@Cron`) must interpret the string in the server TZ.
 */

export type CronMode = 'every-n-minutes' | 'daily-at' | 'weekly-on' | 'monthly-on';

export interface CronScheduleEditorProps {
  modelValue: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  timezone?: 'user' | 'server';
  allowAdvanced?: boolean;
}

/** Parsed representation of a cron field that fits one of the simple modes. */
export interface ParsedCron {
  mode: CronMode;
  /** minutes interval (every-n-minutes) */
  intervalMinutes?: number;
  /** hour "HH:MM" (daily-at, weekly-on, monthly-on) */
  time?: string;
  /** ISO weekdays 0-6 (weekly-on); 0=Sunday */
  weekdays?: number[];
  /** day-of-month (monthly-on); may be a range like 28-31 */
  dayOfMonth?: string;
}

/**
 * Time window value emitted by TimeWindowPicker.
 * `start` and `end` are "HH:mm" strings. `timezone` is an IANA tz name.
 */
export interface TimeWindow {
  start: string;
  end: string;
  timezone: string;
}