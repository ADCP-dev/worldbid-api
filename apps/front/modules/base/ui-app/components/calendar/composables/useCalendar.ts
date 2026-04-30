import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { CalendarEvent, MonthDayCell, CalendarView } from '../types';

export function useCalendar() {
  function generateMonthGrid(date: Date, firstDayOfWeek: number = 1): MonthDayCell[] {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as 0|1|2|3|4|5|6 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek as 0|1|2|3|4|5|6 });

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    return days.map(day => ({
      date: day,
      isCurrentMonth: isSameMonth(day, date),
      isToday: isToday(day),
      events: [],
    }));
  }

  function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
    return events.filter(event => isSameDay(event.start, date));
  }

  function formatDate(date: Date, formatStr: string): string {
    return format(date, formatStr, { locale: es });
  }

  function navigateDate(date: Date, direction: 'prev' | 'next' | 'today', view: CalendarView): Date {
    switch (direction) {
      case 'today': return new Date();
      case 'prev':
        if (view === 'month') return subMonths(date, 1);
        if (view === 'week') return subWeeks(date, 1);
        return subDays(date, 1);
      case 'next':
        if (view === 'month') return addMonths(date, 1);
        if (view === 'week') return addWeeks(date, 1);
        return addDays(date, 1);
    }
  }

  function getTitle(date: Date, view: CalendarView): string {
    if (view === 'month') return format(date, 'MMMM yyyy', { locale: es });
    if (view === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(weekStart, 'd')} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
    }
    return format(date, "EEEE d 'de' MMMM", { locale: es });
  }

  function generateWeekGrid(date: Date, firstDayOfWeek: number = 1): Date[] {
    const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek as 0|1|2|3|4|5|6 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }

  function getHours(hourStart: number = 0, hourEnd: number = 24): number[] {
    return Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i);
  }

  function calculateEventStyle(
    event: CalendarEvent,
    hourStart: number,
    timeSlotHeight: number,
  ): { top: string; height: string } {
    const startHour = event.start.getHours() + event.start.getMinutes() / 60;
    const endHour = event.end.getHours() + event.end.getMinutes() / 60;
    const top = (startHour - hourStart) * timeSlotHeight;
    const height = Math.max((endHour - startHour) * timeSlotHeight, timeSlotHeight * 0.5);
    return { top: `${top}px`, height: `${height}px` };
  }

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return {
    generateMonthGrid,
    getEventsForDay,
    formatDate,
    navigateDate,
    getTitle,
    generateWeekGrid,
    getHours,
    calculateEventStyle,
    weekDays,
  };
}
