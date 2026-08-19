/**
 * cronToHuman — parse a 5-field cron expression and return a Spanish
 * human-readable description.
 *
 * Supports the simple modes used by CronScheduleEditor:
 *   - every-n-minutes  → [star]/N [star] [star] [star] [star]
 *   - daily-at         → M HH [star] [star] [star]
 *   - weekly-on        → M HH [star] [star] 0,1,...
 *   - monthly-on       → M HH D [star] [star]  (D may be a range like 28-31)
 *
 * Any other expression returns the raw cron string (advanced mode).
 * Invalid cron (wrong field count / non-numeric) → "Expresión cron inválida".
 *
 * NFR-003: results are memoized in an LRU cache of 100 entries.
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CronMode, ParsedCron } from '../types';

// Day names from the active date-fns locale (NFR-021). ISO index 0=Sunday.
// 2024-01-07 is a Sunday; format each subsequent day with the wide weekday name.
const WEEKDAYS_ES: string[] = (() => {
  const names: string[] = [];
  const base = new Date(2024, 0, 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    names.push(format(d, 'EEEE', { locale: es }).toLowerCase());
  }
  return names;
})();

/** Minimal LRU cache keyed by the raw cron string. */
class LruCache<K, V> {
  private readonly max: number;
  private readonly map = new Map<K, V>();

  constructor(max: number) {
    this.max = max;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // refresh recency
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

const cache = new LruCache<string, string>(100);

const CRON_FIELDS = 5;
const INVALID = 'Expresión cron inválida';

/** Validate that `s` is a 5-field cron string. Returns fields or null. */
function splitCron(cron: string): string[] | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== CRON_FIELDS) return null;
  return parts;
}

/** Parse [star]/N → N, else null. */
function parseStep(field: string): number | null {
  const match = /^(\*|\d+)\/(\d+)$/.exec(field);
  if (!match) return null;
  return Number(match[2]);
}

/** Parse a single number or "*" → number | null (null means wildcard). */
function parseSingle(field: string): number | null {
  if (field === '*') return null;
  const n = Number(field);
  return Number.isFinite(n) ? n : null;
}

/** Parse "HH:MM" from hour and minute fields. Returns "HH:MM" or null. */
function parseTime(hour: string, minute: string): string | null {
  const h = parseSingle(hour);
  const m = parseSingle(minute);
  if (h === null || m === null) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Detect which simple mode (if any) a cron fits. */
export function parseCron(cron: string): ParsedCron | null {
  const fields = splitCron(cron);
  if (!fields) return null;
  const [minute, hour, dom, month, dow] = fields;

  // every-n-minutes: */N * * * *
  if (month === '*' && dow === '*' && dom === '*' && hour === '*') {
    const n = parseStep(minute);
    if (n !== null && minute.startsWith('*/')) {
      return { mode: 'every-n-minutes', intervalMinutes: n };
    }
  }

  // daily-at: M HH * * *
  if (month === '*' && dow === '*' && dom === '*') {
    const time = parseTime(hour, minute);
    if (time !== null) return { mode: 'daily-at', time };
  }

  // weekly-on: M HH * * 0,1,...
  if (month === '*' && dom === '*') {
    const time = parseTime(hour, minute);
    if (time !== null && dow !== '*') {
      const weekdays = dow.split(',').map(Number).filter(Number.isFinite);
      if (weekdays.length > 0) return { mode: 'weekly-on', time, weekdays };
    }
  }

  // monthly-on: M HH D * *
  if (month === '*' && dow === '*') {
    const time = parseTime(hour, minute);
    if (time !== null && dom !== '*') {
      return { mode: 'monthly-on', time, dayOfMonth: dom };
    }
  }

  return null;
}

function joinWeekdays(weekdays: number[]): string {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return WEEKDAYS_ES[sorted[0]] ?? '';
  const last = sorted[sorted.length - 1];
  const rest = sorted.slice(0, -1).map((d) => WEEKDAYS_ES[d]).filter(Boolean);
  return `${rest.join(', ')} y ${WEEKDAYS_ES[last]}`;
}

function describe(parsed: ParsedCron): string {
  switch (parsed.mode) {
    case 'every-n-minutes':
      return `Cada ${parsed.intervalMinutes} minutos`;
    case 'daily-at':
      return `Diariamente a las ${parsed.time}`;
    case 'weekly-on':
      return `Cada ${joinWeekdays(parsed.weekdays ?? [])} a las ${parsed.time}`;
    case 'monthly-on': {
      const dom = parsed.dayOfMonth ?? '*';
      const suffix = dom.includes('-') ? `días ${dom}` : `día ${dom} de cada mes`;
      return `El ${suffix} a las ${parsed.time}`;
    }
    default:
      return '';
  }
}

/** Convert a 5-field cron string to a Spanish human-readable description. */
export function cronToHuman(cron: string): string {
  const cached = cache.get(cron);
  if (cached !== undefined) return cached;

  const fields = splitCron(cron);
  if (!fields) {
    cache.set(cron, INVALID);
    return INVALID;
  }

  const parsed = parseCron(cron);
  const text = parsed ? describe(parsed) : cron;
  cache.set(cron, text);
  return text;
}