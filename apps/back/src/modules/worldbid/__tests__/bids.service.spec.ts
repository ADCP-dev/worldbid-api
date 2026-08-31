import { beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { BidsService } from '../bids.service';
import { CountryEntity } from '../infrastructure/entities/country.entity';
import { BidEntity } from '../infrastructure/entities/bid.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BidsService — transactional vitalicio engine', () => {
  let service: BidsService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BidsService,
        {
          provide: getRepositoryToken(CountryEntity),
          useValue: repoMock(CountryEntity),
        },
        {
          provide: getRepositoryToken(BidEntity),
          useValue: repoMock(BidEntity),
        },
        {
          provide: DataSource,
          useValue: dataSourceMock(),
        },
      ],
    }).compile();
    service = moduleRef.get(BidsService);
    dataSource = moduleRef.get(DataSource);
    await seed();
  });

  // ---- lightweight in-memory fake of TypeORM repos + transaction manager ----
  let countries: Map<string, Partial<CountryEntity>>;
  let bids: Map<string, Partial<BidEntity>>;
  let locked: string | null;

  function repoMock(entity: unknown) {
    const isCountry = entity === CountryEntity;
    return {
      findOne: async ({ where }: any) => {
        if (where.iso2) return countries.get(where.iso2) ?? null;
        const found = bids.get(where.id);
        return found && (!where.status || found.status === where.status)
          ? found
          : null;
      },
      find: async ({ where }: any = {}) =>
        isCountry
          ? [...countries.values()]
          : [...bids.values()].filter(
              (b) => !where?.status || b.status === where.status,
            ),
      create: (v: any) => v,
      insert: async (v: any) => {
        bids.set(v.id, { ...v, status: v.status ?? 'pending' });
      },
      update: async (crit: any, patch: any) => {
        if (crit.iso2) {
          const c = countries.get(crit.iso2);
          if (c) Object.assign(c, patch);
          return;
        }
        const b = bids.get(crit.id);
        if (b && (!crit.status || b.status === crit.status)) {
          Object.assign(b, patch);
        }
      },
      createQueryBuilder: () => qsBuilder(),
    };
  }

  function qsBuilder() {
    return {
      setLock: () => qsBuilder(),
      where: () => qsBuilder(),
      getOne: async () => (locked ? countries.get(locked) ?? null : null),
    };
  }

  function dataSourceMock() {
    return {
      transaction: async (cb: any) => {
        // run against a manager exposing repositories sharing the maps
        const manager = {
          getRepository: (_e: any) => ({
            findOne: async ({ where }: any) => {
              if (where.iso2) return countries.get(where.iso2) ?? null;
              const found = bids.get(where.id);
              return found && (!where.status || found.status === where.status)
                ? found
                : null;
            },
            insert: async (v: any) => {
              bids.set(v.id, { ...v, status: v.status ?? 'pending' });
            },
            update: async (crit: any, patch: any) => {
              if (typeof crit === 'string') {
                const bb = bids.get(crit);
                if (bb) Object.assign(bb, patch);
                return;
              }
              if (crit.iso2) {
                const c = countries.get(crit.iso2);
                if (c) Object.assign(c, patch);
                return;
              }
              const b = bids.get(crit.id);
              if (b && (!crit.status || b.status === crit.status)) {
                Object.assign(b, patch);
              }
            },
            createQueryBuilder: () => ({
              setLock: () => ({
                where: (_k: string, p: any) => {
                  locked = p.iso2;
                  return { getOne: async () => countries.get(p.iso2) ?? null };
                },
              }),
            }),
          }),
        };
        return cb(manager);
      },
    };
  }

  async function seed() {
    locked = null;
    countries = new Map<string, Partial<CountryEntity>>([
      ['US', { iso2: 'US', name: 'United States', developer: false, activeBidId: null, websiteClicks: {}, totalClicks: 0 }],
      ['IB', { iso2: 'IB', name: 'Islas Baleares', developer: true, activeBidId: 'seed-ib', websiteClicks: {}, totalClicks: 0 }],
      ['PLANE', { iso2: 'PLANE', name: 'Global plane banner', developer: false, activeBidId: null, websiteClicks: {}, totalClicks: 0 }],
    ]);
    bids = new Map<string, Partial<BidEntity>>([
      ['seed-ib', { id: 'seed-ib', countryId: 'IB', amount: 100, status: 'paid', alias: 'SOM·OS', url: 'https://som-os.dev' }],
    ]);
    void dataSource;
  }

  const BASE = {
    userId: 1,
    alias: 'Alice',
    url: 'https://alice.dev',
    amount: 2.5,
  };

  it('creates a pending bid on a vacant spot', async () => {
    const bid = await service.createPendingBid({ ...BASE, countryId: 'US' });
    expect(bid.status).toBe('pending');
    expect(Number(bid.amount)).toBe(2.5);
  });

  it('rejects below the tiered minimum', async () => {
    bids.set('b1', { id: 'b1', countryId: 'US', amount: 100, status: 'paid' });
    countries.get('US')!.activeBidId = 'b1';
    await expect(
      service.createPendingBid({ ...BASE, countryId: 'US', amount: 105 }),
    ).rejects.toThrow(/Minimum bid is \$110\.00/); // +10% tier
  });

  it('accepts the tiered minimum', async () => {
    bids.set('b1', { id: 'b1', countryId: 'US', amount: 100, status: 'paid' });
    countries.get('US')!.activeBidId = 'b1';
    const bid = await service.createPendingBid({ ...BASE, countryId: 'US', amount: 110 });
    expect(bid.status).toBe('pending');
  });

  it('locks the developer slot', async () => {
    await expect(
      service.createPendingBid({ ...BASE, countryId: 'IB', amount: 999 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404 on unknown spot', async () => {
    await expect(
      service.createPendingBid({ ...BASE, countryId: 'ZZ', amount: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('confirm sets paid + transfers ownership (vitalicio)', async () => {
    await service.createPendingBid({ ...BASE, countryId: 'US', amount: 5 });
    const pending = [...bids.values()].find((b) => b.status === 'pending')!;
    await service.confirmBidPaid(pending.id!);
    expect(pending.status).toBe('paid');
    expect(countries.get('US')!.activeBidId).toBe(pending.id);
  });

  it('confirm is idempotent', async () => {
    await service.createPendingBid({ ...BASE, countryId: 'US', amount: 5 });
    const pending = [...bids.values()].find((b) => b.status === 'pending')!;
    await service.confirmBidPaid(pending.id!);
    pending.amount = 999; // mutate to prove no second write happens
    await service.confirmBidPaid(pending.id!);
    expect(countries.get('US')!.activeBidId).toBe(pending.id);
  });

  it('confirm after being outbid marks the bid expired (no ownership)', async () => {
    // two pending bids on US: b-old $5, b-new $10 (b-new confirms first)
    bids.set('old', { id: 'old', countryId: 'US', amount: 5, status: 'pending' });
    bids.set('new', { id: 'new', countryId: 'US', amount: 12, status: 'pending' });
    await service.confirmBidPaid('new');
    await service.confirmBidPaid('old'); // late: spot already at $12
    expect((bids.get('old') as any).status).toBe('expired');
    expect(countries.get('US')!.activeBidId).toBe('new');
  });

  it('expireBid only touches pending bids', async () => {
    bids.set('p', { id: 'p', countryId: 'US', amount: 5, status: 'pending' });
    bids.set('paid', { id: 'paid', countryId: 'US', amount: 8, status: 'paid' });
    await service.expireBid('p');
    await service.expireBid('paid');
    expect((bids.get('p') as any).status).toBe('expired');
    expect((bids.get('paid') as any).status).toBe('paid');
  });

  it('topBids ranks paid bids and hides IB', async () => {
    bids.set('x1', { id: 'x1', countryId: 'US', amount: 12, status: 'paid', alias: 'A', url: 'https://a.dev', accentColor: '#111' });
    bids.set('x2', { id: 'x2', countryId: 'ES', amount: 30, status: 'paid', alias: 'B', url: 'https://b.dev', accentColor: '#222' });
    countries.get('US')!.activeBidId = 'x1';
    countries.set('ES', { iso2: 'ES', name: 'Spain', developer: false, activeBidId: 'x2', websiteClicks: {}, totalClicks: 0 } as any);
    const rows = await service.topBids(10);
    expect(rows[0].iso2).toBe('ES');
    expect(rows.find((r) => r.iso2 === 'IB')).toBeUndefined();
  });

  it('globalStats: PLANE counts invested but not claimed; IB counts invested only', async () => {
    bids.set('s1', { id: 's1', countryId: 'US', amount: 10, status: 'paid' });
    bids.set('p1', { id: 'p1', countryId: 'PLANE', amount: 20, status: 'paid' });
    countries.get('US')!.activeBidId = 's1';
    countries.get('PLANE')!.activeBidId = 'p1';
    const stats = await service.globalStats();
    // claimed: US only (IB dev slot excluded, PLANE excluded)
    expect(stats.claimedCount).toBe(1);
    // invested: US $10 + PLANE $20 + IB seed $100
    expect(stats.totalInvested).toBe(130);
  });
});