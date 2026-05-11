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
    columnIndex = 0,
    totalColumns = 1,
  ): { top: string; height: string; left: string; width: string } {
    const startHour = event.start.getHours() + event.start.getMinutes() / 60;
    const endHour = event.end.getHours() + event.end.getMinutes() / 60;
    const top = (startHour - hourStart) * timeSlotHeight;
    const height = Math.max((endHour - startHour) * timeSlotHeight, timeSlotHeight * 0.5);
    const leftPercent = (columnIndex / totalColumns) * 100;
    const widthPercent = 100 / totalColumns;
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${leftPercent}%`,
      width: `calc(${widthPercent}% - 4px)`,
    };
  }

  /**
   * Detect overlapping events and assign each to a column lane.
   * Groups events into overlap sets, then assigns columns per group.
   *
   * Returns a Map of event ids to { columnIndex, totalColumns }.
   */
  function detectOverlaps(
    events: CalendarEvent[],
  ): Map<string, { columnIndex: number; totalColumns: number }> {
    const result = new Map<string, { columnIndex: number; totalColumns: number }>();

    if (!events.length) return result;

    // Sort by start time
    const sorted = [...events].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );

    // Find overlap groups: events that are connected by overlap
    const groups: CalendarEvent[][] = [];
    const visited = new Set<string>();

    for (const event of sorted) {
      if (visited.has(event.id)) continue;

      // BFS/DFS to find all connected overlapping events
      const group: CalendarEvent[] = [];
      const stack = [event];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);
        group.push(current);

        // Find all events that overlap with current
        for (const other of sorted) {
          if (!visited.has(other.id) && overlap(current, other)) {
            stack.push(other);
          }
        }
      }

      groups.push(group);
    }

    // For each group, assign columns greedily (first pass)
    // then update totalColumns after all events in the group are placed
    for (const group of groups) {
      // Sort group by start time
      group.sort((a, b) => a.start.getTime() - b.start.getTime());

      const colEndTimes: number[] = [];
      const assignments: { event: CalendarEvent; col: number }[] = [];

      for (const event of group) {
        let col = 0;
        while (
          col < colEndTimes.length &&
          colEndTimes[col]! > event.start.getTime()
        ) {
          col++;
        }
        if (col < colEndTimes.length) {
          colEndTimes[col] = event.end.getTime();
        } else {
          colEndTimes.push(event.end.getTime());
        }
        assignments.push({ event, col });
      }

      const totalCols = colEndTimes.length;
      for (const { event, col } of assignments) {
        result.set(event.id, {
          columnIndex: col,
          totalColumns: totalCols,
        });
      }
    }

    // Events with no overlaps get full width
    for (const event of sorted) {
      if (!result.has(event.id)) {
        result.set(event.id, { columnIndex: 0, totalColumns: 1 });
      }
    }

    return result;
  }

  /** Check if two events overlap in time */
  function overlap(a: CalendarEvent, b: CalendarEvent): boolean {
    return a.start < b.end && b.start < a.end;
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
    detectOverlaps,
    weekDays,
  };
}
