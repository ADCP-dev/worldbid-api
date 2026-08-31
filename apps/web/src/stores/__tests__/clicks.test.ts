import { describe, it, expect, beforeEach } from 'vitest';
import { clickEvents, countryTotalClicks, hydrateClicks, snapshotCountryClicks, CLICK_DEBOUNCE_MS } from '../clicks';
import type { ClickEvent } from '../../lib/types';

function mkClick(id: string, iso2: string, ts: number): ClickEvent {
  return { id, countryId: iso2, url: 'https://x', origin: { country: 'Unknown', region: 'Global' }, userId: 'u', timestamp: ts };
}

beforeEach(() => {
  clickEvents.set([]);
});

describe('clicks — countryTotalClicks aggregation', () => {
  it('aggregates totals per country from clickEvents', () => {
    clickEvents.set([mkClick('c1', 'AR', 1), mkClick('c2', 'AR', 2), mkClick('c3', 'BR', 3)]);
    const totals = countryTotalClicks.get();
    expect(totals['AR']).toBe(2);
    expect(totals['BR']).toBe(1);
  });

  it('hydrateClicks restores from a totals map', () => {
    hydrateClicks({ AR: 3, BR: 1 });
    expect(countryTotalClicks.get()['AR']).toBe(3);
    expect(countryTotalClicks.get()['BR']).toBe(1);
  });

  it('snapshotCountryClicks returns the live totals', () => {
    clickEvents.set([mkClick('c1', 'AR', 1), mkClick('c2', 'AR', 2)]);
    expect(snapshotCountryClicks()['AR']).toBe(2);
  });

  it('CLICK_DEBOUNCE_MS is 3000', () => {
    expect(CLICK_DEBOUNCE_MS).toBe(3000);
  });
});