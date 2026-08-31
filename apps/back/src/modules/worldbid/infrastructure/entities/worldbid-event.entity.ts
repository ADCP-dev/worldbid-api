import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * Append-only activity feed (public SSE source).
 *
 * One row per bid-placed / bid-paid / bid-outbid / bid-expired event.
 * Written inside the same transaction as the state change it describes.
 */
@Entity({ name: 'worldbid_event' })
@Index('worldbid_event_created_idx', ['createdAt'])
export class WorldbidEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** bid_placed | bid_paid | bid_outbid | bid_expired */
  @Column({ type: 'varchar' })
  type: string;

  /** Country iso2 or PLANE. */
  @Column({ type: 'varchar', nullable: true })
  countryId: string | null;

  @Column({ type: 'varchar' })
  alias: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  message: string | null;

  @CreateDateColumn()
  createdAt: Date;
}