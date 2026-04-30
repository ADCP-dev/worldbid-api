export interface CalendarTag {
  id: string;
  label: string;
  color?: string;
}

export interface CalendarAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: Date;
  byWeekDay?: number[];
  byMonthDay?: number[];
  exceptions?: Date[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;
  textColor?: string;
  tags?: CalendarTag[];
  assignees?: CalendarAssignee[];
  location?: string;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  recurrenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface MonthDayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export type CalendarView = 'month' | 'week' | 'day';
