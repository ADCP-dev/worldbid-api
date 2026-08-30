import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/** Local weekday names indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Zero-pad a number to two digits (deterministic local formatting). */
const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * get_current_datetime — read the server clock.
 *
 * The DeepAgent otherwise has no way to know "today" and guesses or asks
 * the user before dating notes/scheduled content. Factory: no dependencies —
 * pure clock read. All fields (local date, time, weekday, ISO, epoch) are
 * derived from the SAME `new Date()` snapshot so the payload is internally
 * consistent. Returns a JSON string like the other tools.
 */
export function createCurrentDatetimeTool() {
  return tool(
    () => {
      const d = new Date();
      return JSON.stringify({
        iso: d.toISOString(),
        utc: d.toUTCString(),
        date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
        weekday: WEEKDAY_NAMES[d.getDay()],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        epochMs: d.getTime(),
      });
    },
    {
      name: 'get_current_datetime',
      description:
        'Returns the current date and time from the server clock, including ISO timestamp, UTC and local representations, weekday, and the server timezone. Use whenever the user asks for the current date/time, or before writing dates into notes or scheduled content.',
      schema: z.object({}),
    },
  );
}
