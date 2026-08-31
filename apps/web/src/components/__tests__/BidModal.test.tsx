// Integration test: BidModal ultra-minimal form (email + URL + amount only).
//
// Mounts BidModal with a seeded store and exercises:
//   - occupied at $10 -> tiered minimum $12.00 (+20% under $50)
//   - occupied shows "Current king: Alice ($10.00)"
//   - min amount = $2.50 for vacant countries
//   - developer slot disables bidding

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BidModal from '../BidModal';
import { countries, bids, hydrateBidsCountries, writeBid } from '../../stores/bids';
import { setSession } from '../../stores/session';
import { selectedIso2, modalOpen, setModalOpen } from '../../stores/ui';
import { seedCountries } from '../../lib/seed';
import { loadAll } from '../../lib/persistence';
import type { User } from '../../lib/types';

const u: User = {
  id: 'u1', alias: 'Alice', email: 'a@x', accentColor: '#3B82F6',
  ownedCountries: [], achievements: [], totalClicks: 0, totalInvested: 0, createdAt: 1,
};

beforeEach(() => {
  hydrateBidsCountries(seedCountries());
  setSession(u);
});

afterEach(() => {
  cleanup();
  setModalOpen(false);
  selectedIso2.set(null);
});

describe('BidModal — occupied country', () => {
  it('shows "Current king" with alias + amount', () => {
    const us = countries.get()['US'];
    countries.set({ ...countries.get(), US: { ...us, activeBidId: null, bidHistory: [] } });
    writeBid({ id: 'b-us-10', countryId: 'US', userId: 'alice', alias: 'Alice', email: 'a@x', url: 'https://x', logoUrl: '', pitch: 'hi', amount: 10, accentColor: '#3B82F6', placedAt: 1 }, null);
    selectedIso2.set('US');
    setModalOpen(true);
    render(<BidModal />);
    expect(screen.getByTestId('current-king')).toHaveTextContent(/Current king: Alice/);
    expect(screen.getByTestId('current-king')).toHaveTextContent(/\$10\.00/);
  }, 10000);

  it('min amount = tiered minimum over current (+20% under $50); submit disabled below min', () => {
    const us = countries.get()['US'];
    countries.set({ ...countries.get(), US: { ...us, activeBidId: null, bidHistory: [] } });
    writeBid({ id: 'b-us-10', countryId: 'US', userId: 'alice', alias: 'Alice', email: 'a@x', url: '', logoUrl: '', pitch: '', amount: 10, accentColor: '#000', placedAt: 1 }, null);
    selectedIso2.set('US');
    setModalOpen(true);
    render(<BidModal />);
    // $10 current -> +20% -> $12.00 tiered minimum
    const amountInput = screen.getByPlaceholderText('12') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '10.25' } });
    expect(screen.getByTestId('bid-submit')).toBeDisabled();
  });

  it('accepts the tiered minimum (submit enabled)', () => {
    const us = countries.get()['US'];
    countries.set({ ...countries.get(), US: { ...us, activeBidId: null, bidHistory: [] } });
    writeBid({ id: 'b-us-10', countryId: 'US', userId: 'alice', alias: 'Alice', email: 'a@x', url: '', logoUrl: '', pitch: '', amount: 10, accentColor: '#000', placedAt: 1 }, null);
    selectedIso2.set('US');
    setModalOpen(true);
    render(<BidModal />);
    const amountInput = screen.getByPlaceholderText('12') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '12' } });
    // Fill required email + URL so validate() passes
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'b@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('https://yoursite.com'), { target: { value: 'https://bob.io' } });
    expect(screen.getByTestId('bid-submit')).not.toBeDisabled();
  });
});

describe('BidModal — vacant country', () => {
  it('min amount = $2.50 (vacant)', () => {
    const ar = countries.get()['AR'];
    countries.set({ ...countries.get(), AR: { ...ar, activeBidId: null, bidHistory: [] } });
    selectedIso2.set('AR');
    setModalOpen(true);
    render(<BidModal />);
    const amountInput = screen.getByPlaceholderText('2.5') as HTMLInputElement;
    expect(amountInput).toBeInTheDocument();
  });
});

describe('BidModal — developer slot', () => {
  it('developer slot (IB): modal never opens — nothing is claimable', () => {
    selectedIso2.set('IB');
    setModalOpen(true);
    render(<BidModal />);
    expect(screen.queryByText(/developer slot/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('bid-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bid-submit')).not.toBeInTheDocument();
  });
});
describe('BidModal — IB developer slot exception', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    loadAll();
  });
  afterEach(() => { cleanup(); });

  it('does NOT open the modal for IB (developer slot, never claimable)', () => {
    selectedIso2.set('IB');
    setModalOpen(true);
    render(<BidModal />);
    expect(screen.queryByTestId('bid-modal')).toBeNull();
  });
});
