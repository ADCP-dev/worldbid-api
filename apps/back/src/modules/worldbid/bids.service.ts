import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { CountryEntity } from './infrastructure/entities/country.entity';
import { BidEntity } from './infrastructure/entities/bid.entity';
import {
  DEVELOPER_SPOT_ID,
  PLANE_SPOT_ID,
  minBidForKind,
} from './economy';

export interface PlaceBidInput {
  countryId: string;
  userId: number;
  alias: string;
  email?: string | null;
  url: string;
  pitch?: string | null;
  amount: number;
  accentColor?: string;
}

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    @InjectRepository(CountryEntity)
    private readonly countriesRepository: Repository<CountryEntity>,
    @InjectRepository(BidEntity)
    private readonly bidsRepository: Repository<BidEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** Active paid bid for a spot, or null (vitalicio ownership resolution). */
  async activeBidFor(countryId: string): Promise<BidEntity | null> {
    const country = await this.countriesRepository.findOne({
      where: { iso2: countryId },
    });
    if (!country?.activeBidId) return null;
    const bid = await this.bidsRepository.findOne({
      where: { id: country.activeBidId, status: 'paid' },
    });
    return bid;
  }

  /** Any bid by id (settlement path). */
  async findBid(bidId: string): Promise<BidEntity | null> {
    return this.bidsRepository.findOne({ where: { id: bidId } });
  }

  /** Every spot row (front seeding). */
  async allSpots(): Promise<CountryEntity[]> {
    return this.countriesRepository.find({ order: { iso2: 'ASC' } });
  }

  /** Every currently-active PAID bid (front seeding). */
  async allActiveBids(): Promise<BidEntity[]> {
    return this.bidsRepository.find({ where: { status: 'paid' } });
  }

  /** Minimum accepted bid for a spot (tiered economy). */
  async minBidFor(countryId: string): Promise<number> {
    const kind = countryId === PLANE_SPOT_ID ? 'plane' : 'country';
    const active = await this.activeBidFor(countryId);
    return minBidForKind(kind, active ? Number(active.amount) : null);
  }

  /**
   * Create a PENDING bid + its Stripe checkout anchor inside one transaction.
   * The row-level lock on the country serializes concurrent outbids; a lost
   * race surfaces as ConflictException with the fresh required minimum.
   *
   * Validation errors are deterministic 4xx; payment happens in Stripe.
   */
  async createPendingBid(input: PlaceBidInput): Promise<BidEntity> {
    const { countryId } = input;

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Bid amount must be a positive number.');
    }

    return this.dataSource.transaction(async (em) => {
      // Lock the spot row: concurrent bidders queue here.
      const country = await em
        .getRepository(CountryEntity)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.iso2 = :iso2', { iso2: countryId })
        .getOne();

      if (!country) {
        throw new NotFoundException('Unknown spot.');
      }
      if (country.developer || countryId === DEVELOPER_SPOT_ID) {
        throw new ForbiddenException('Developer slot — not claimable.');
      }

      const kind = countryId === PLANE_SPOT_ID ? 'plane' : 'country';
      const active = country.activeBidId
        ? await em.getRepository(BidEntity).findOne({
            where: { id: country.activeBidId, status: 'paid' },
          })
        : null;

      const min = minBidForKind(kind, active ? Number(active.amount) : null);
      if (Number(input.amount) < min) {
        throw new ConflictException(
          `Minimum bid is $${min.toFixed(2)}.` +
            (active ? ' Outbid requires the tiered minimum.' : ''),
        );
      }
      // Redundant with the tier check, but explicit: equal amount never
      // outbids (protects against exact-tie races through the multiplier).
      if (active && !(Number(input.amount) > Number(active.amount))) {
        throw new ConflictException(
          'Outbid must be strictly higher than the current bid.',
        );
      }

      const bid = this.bidsRepository.create({
        id: randomUUID(),
        countryId,
        userId: input.userId,
        alias: input.alias,
        email: input.email ?? null,
        url: input.url,
        pitch: input.pitch ?? null,
        amount: input.amount,
        accentColor: input.accentColor ?? '#3B82F6',
        status: 'pending',
      });
      await em.getRepository(BidEntity).insert(bid);
      return bid;
    });
  }

  /**
   * Confirm a pending bid as paid after the Stripe webhook verified the
   * checkout session. Idempotent: re-confirming a paid bid is a no-op.
   *
   * On success the previous active bid (if any) is demoted by repointing the
   * country's activeBidId — the losing bid keeps its payment (vitalicio
   * history), but ownership transfers atomically.
   */
  async confirmBidPaid(bidId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const bid = await em
        .getRepository(BidEntity)
        .findOne({ where: { id: bidId } });
      if (!bid) {
        throw new NotFoundException('Bid not found.');
      }
      if (bid.status === 'paid') return; // idempotent

      // Re-validate the tier at confirm time: the spot may have been outbid
      // while checkout was open. Undercutting pays back via Stripe refund
      // in the webhook service; here we just refuse ownership.
      const country = await em
        .getRepository(CountryEntity)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.iso2 = :iso2', { iso2: bid.countryId })
        .getOne();
      const active = country?.activeBidId
        ? await em.getRepository(BidEntity).findOne({
            where: { id: country.activeBidId, status: 'paid' },
          })
        : null;

      if (active && Number(bid.amount) <= Number(active.amount)) {
        await em
          .getRepository(BidEntity)
          .update(bidId, { status: 'expired' });
        this.logger.warn(
          `bid ${bidId} expired: spot ${bid.countryId} moved to $${active.amount} before payment`,
        );
        return;
      }

      await em.getRepository(BidEntity).update(bidId, { status: 'paid' });
      await em
        .getRepository(CountryEntity)
        .update(
          { iso2: bid.countryId },
          { activeBidId: bidId },
        );
    });
  }

  /** Expire a pending bid whose Stripe checkout was abandoned/failed. */
  async expireBid(bidId: string): Promise<void> {
    await this.bidsRepository.update(
      { id: bidId, status: 'pending' },
      { status: 'expired' },
    );
  }

  /** Top-N paid bids by amount (World Order panel). Excludes the dev slot. */
  async topBids(limit = 10): Promise<
    Array<{
      iso2: string;
      name: string;
      url: string;
      alias: string;
      amount: number;
      accentColor: string;
    }>
  > {
    const [paidBids, countries] = await Promise.all([
      this.bidsRepository.find({ where: { status: 'paid' } }),
      this.countriesRepository.find(),
    ]);
    // Rank by the spot's active paid bid (ownership map, not raw bids).
    const paidById = new Map(paidBids.map((b) => [b.id, b]));
    const rows = countries
      .filter((c) => c.activeBidId && c.iso2 !== DEVELOPER_SPOT_ID)
      .map((c) => ({ country: c, bid: paidById.get(c.activeBidId as string) }))
      .filter((r): r is { country: CountryEntity; bid: BidEntity } => !!r.bid)
      .sort((a, b) => Number(b.bid.amount) - Number(a.bid.amount))
      .slice(0, limit);

    return rows.map(({ country, bid }) => ({
      iso2: country.iso2,
      name: country.name,
      url: bid.url,
      alias: bid.alias,
      amount: Number(bid.amount),
      accentColor: bid.accentColor,
    }));
  }

  /** Global stats for the header chip. PLANE counts toward invested only. */
  async globalStats(): Promise<{
    claimedCount: number;
    totalCountries: number;
    totalInvested: number;
  }> {
    const countries = await this.countriesRepository.find();
    const bidIds = countries
      .filter((c) => c.activeBidId)
      .map((c) => c.activeBidId as string);
    const bids = bidIds.length
      ? await this.bidsRepository.find({ where: bidIds.map((id) => ({ id, status: 'paid' as const })) })
      : [];

    const paidById = new Map(bids.map((b) => [b.id, b]));
    let claimedCount = 0;
    let totalInvested = 0;
    for (const c of countries) {
      if (!c.activeBidId) continue;
      const b = paidById.get(c.activeBidId);
      if (!b) continue;
      // PLANE counts toward invested only; IB is the permanent dev slot.
      if (c.iso2 !== PLANE_SPOT_ID && c.iso2 !== DEVELOPER_SPOT_ID) {
        claimedCount += 1;
      }
      totalInvested += Number(b.amount);
    }
    return { claimedCount, totalInvested, totalCountries: 196 };
  }
}