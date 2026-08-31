import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * A staked territory (country) or the synthetic global plane spot.
 *
 * The PK is the ISO-3166-1 alpha-2 code for countries, or the literal
 * 'PLANE' for the global banner spot. IB is a special developer-owned
 * territory: it exists but is never claimable (developer column).
 */
@Entity({ name: 'worldbid_country' })
@Index('worldbid_country_active_bid_idx', ['activeBidId'])
export class CountryEntity extends EntityRelationalHelper {
  /** ISO-3166-1 alpha-2 code, or 'PLANE' for the global banner spot. */
  @PrimaryColumn()
  iso2: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  continent: string | null;

  /** True for the IB developer slot — never claimable. */
  @Column({ default: false })
  developer: boolean;

  /** Active (winning) bid id, null = vacant. */
  @Column({ type: 'varchar', nullable: true })
  activeBidId: string | null;

  @Column({ type: 'int', default: 0 })
  totalClicks: number;

  @Column({ type: 'simple-json', default: {} })
  websiteClicks: Record<string, number>;
}