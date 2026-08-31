import { describe, it, expect, beforeEach } from 'vitest';
import { globalHistory, appendEvent, tickerEvents, makeEvent, hydrateHistory, HISTORY_CAP, TICKER_DISPLAY } from '../history';
import type { HistoryEvent } from '../../lib/types';

beforeEach(() => {
  globalHistory.set([]);
});

describe('history — append + cap + ticker', () => {
  it('appendEvent adds to the tail', () => {
    const e = makeEvent('bid', { userId: 'u', message: 'hi' });
    appendEvent(e);
    expect(globalHistory.get().length).toBe(1);
    expect(globalHistory.get()[0]).toBe(e);
  });

  it('tickerEvents returns the last 20, most recent first', () => {
    for (let i = 0; i < 25; i++) appendEvent(makeEvent('click', { userId: 'u', message: 'm' + i, timestamp: i }));
    const t = tickerEvents.get();
    expect(t.length).toBe(TICKER_DISPLAY);
    expect(t[0].timestamp).toBe(24); // most recent first
    expect(t[19].timestamp).toBe(5);
  });

  it('append 201st event evicts oldest (cap 200)', () => {
    for (let i = 0; i < HISTORY_CAP + 1; i++) appendEvent(makeEvent('click', { userId: 'u', message: 'm', timestamp: i }));
    expect(globalHistory.get().length).toBe(HISTORY_CAP);
    // oldest (timestamp 0) evicted, first is now timestamp 1
    expect(globalHistory.get()[0].timestamp).toBe(1);
    expect(globalHistory.get()[HISTORY_CAP - 1].timestamp).toBe(HISTORY_CAP);
  });

  it('hydrateHistory trims to cap keeping most recent', () => {
    const evs: HistoryEvent[] = Array.from({ length: 250 }, (_, i) => makeEvent('bid', { userId: 'u', message: 'm', timestamp: i }));
    hydrateHistory(evs);
    expect(globalHistory.get().length).toBe(HISTORY_CAP);
    expect(globalHistory.get()[0].timestamp).toBe(50);
  });

  it('makeEvent assigns a fresh id + timestamp when omitted', () => {
    const e = makeEvent('achievement', { userId: 'u', message: 'hi' });
    expect(e.id.length).toBeGreaterThan(0);
    expect(e.timestamp).toBeGreaterThan(0);
  });
});