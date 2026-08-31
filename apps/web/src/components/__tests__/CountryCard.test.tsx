// Integration test: CountryCard renders the worldmap.lol-style "seats"
// leaderboard + visit/bid CTA + dev-slot handling.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CountryCard from '../CountryCard';
import { countries, hydrateBidsCountries, writeBid } from '../../stores/bids';
import { setSession } from '../../stores/session';
import { countryFeatures } from '../../stores/globe';
import { selectedIso2, setModalOpen } from '../../stores/ui';
import { seedCountries } from '../../lib/seed';
import type { User } from '../../lib/types';

const u: User = {
  id: 'u1', alias: 'Alice', email: 'a@x', accentColor: '#3B82F6',
  ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1,
};

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  setSession(u);
  countryFeatures.set([
    { type: 'Feature', properties: { ADMIN: 'Argentina', ISO_A2: 'AR' }, geometry: null, __iso2: 'AR' },
    { type: 'Feature', properties: { ADMIN: 'United States of America', ISO_A2: 'US' }, geometry: null, __iso2: 'US' },
    { type: 'Feature', properties: { ADMIN: 'Islas Baleares', ISO_A2: 'IB' }, geometry: null, __iso2: 'IB' },
  ] as any);
});

afterEach(() => {
  cleanup();
  setModalOpen(false);
  selectedIso2.set(null);
  document.body.classList.remove('has-selection');
});

describe('CountryCard — seats list (worldmap.lol pattern)', () => {
  it('renders the seat for an occupied country', () => {
    selectedIso2.set('US');
    render(<CountryCard />);
    expect(screen.getByTestId('country-card')).toHaveAttribute('data-iso2', 'US');
    // The active king (Nimbus Labs, $120) becomes the top seat
    expect(screen.getByTestId('seat-US-0')).toBeInTheDocument();
    expect(screen.getByText(/Nimbus Labs|nimbuslabs\.io/i)).toBeInTheDocument();
  });

  it('renders the "Claim a spot" CTA for a claimable country', () => {
    selectedIso2.set('US');
    render(<CountryCard />);
    const cta = screen.getByTestId('pn-cta');
    expect(cta).toBeInTheDocument();
    expect(cta.textContent).toMatch(/Claim a spot/);
  });

  it('hides the CTA for the IB developer slot and shows dev label', () => {
    selectedIso2.set('IB');
    render(<CountryCard />);
    expect(screen.getByText(/developer slot/i)).toBeInTheDocument();
    expect(screen.queryByTestId('pn-cta')).not.toBeInTheDocument();
  });

  it('renders multiple seats when more bids exist', () => {
    const us = countries.get()['US'];
    countries.set({ ...countries.get(), US: { ...us, activeBidId: null, bidHistory: [] } });
    writeBid({ id: 'b1', countryId: 'US', userId: 'a', alias: 'Alice', email: '', url: 'https://alice.io', logoUrl: '', pitch: 'hi', amount: 10, accentColor: '#000', placedAt: 1 }, null);
    writeBid({ id: 'b2', countryId: 'US', userId: 'b', alias: 'Bob', email: '', url: 'https://bob.io', logoUrl: '', pitch: 'yo', amount: 20, accentColor: '#000', placedAt: 2 }, 'b1');
    writeBid({ id: 'b3', countryId: 'US', userId: 'c', alias: 'Carol', email: '', url: 'https://carol.io', logoUrl: '', pitch: 'hey', amount: 30, accentColor: '#000', placedAt: 3 }, 'b2');
    selectedIso2.set('US');
    render(<CountryCard />);
    expect(screen.getByTestId('seat-US-0')).toBeInTheDocument();
    expect(screen.getByTestId('seat-US-1')).toBeInTheDocument();
    expect(screen.getByTestId('seat-US-2')).toBeInTheDocument();
  });

  it('renders a vacant state when the country has no bid', () => {
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    selectedIso2.set('AR');
    render(<CountryCard />);
    const cta = screen.getByTestId('pn-cta');
    expect(cta.textContent).toMatch(/Claim this territory/);
  });
});
