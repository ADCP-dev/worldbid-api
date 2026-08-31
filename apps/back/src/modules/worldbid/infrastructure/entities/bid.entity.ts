import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * A bid on a country spot or on the global plane banner spot.
 *
 * Vitalicio model: the highest paid bid owns the spot until outbid.
 * A bid is only ACTIVE after its Stripe checkout confirms (paidAt set);
 * pending bids expire and are ignored by ownership resolution.
 */
@Entity({ name: 'worldbid_bid' })
@Index('worldbid_bid_country_idx', ['countryId'])
@Index('worldbid_bid_status_idx', ['status'])
export class BidEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  id: string;

  /** Country iso2 or 'PLANE' for the global banner spot. */
  @Column()
  countryId: string;

  /** Owning user (users.id). Null while the bid is anonymous/locked. */
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar' })
  alias: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  pitch: string | null;

  /** USD amount, 2 decimal places. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: '#3B82F6' })
  accentColor: string;

  /** pending | paid | expired. Only 'paid' bids confer ownership. */
  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'paid' | 'expired';

  /** Stripe Checkout session id while pending (idempotency anchor). */
  @Column({ type: 'varchar', nullable: true })
  stripeSessionId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}