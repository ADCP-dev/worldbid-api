import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CountryEntity } from '@src/modules/worldbid/infrastructure/entities/country.entity';
import {
  DEVELOPER_SPOT_ID,
  PLANE_SPOT_ID,
} from '@src/modules/worldbid/economy';

/** ISO-3166-1 alpha-2 + display name + continent for every claimable territory. */
const COUNTRY_SPOTS: Array<[string, string, string]> = [
  ['US', 'United States of America', 'NA'], ['GB', 'United Kingdom', 'EU'],
  ['FR', 'France', 'EU'], ['DE', 'Germany', 'EU'], ['IT', 'Italy', 'EU'],
  ['ES', 'Spain', 'EU'], ['PT', 'Portugal', 'EU'], ['JP', 'Japan', 'AS'],
  ['KR', 'South Korea', 'AS'], ['IN', 'India', 'AS'], ['CN', 'China', 'AS'],
  ['AU', 'Australia', 'OC'], ['NZ', 'New Zealand', 'OC'], ['CA', 'Canada', 'NA'],
  ['MX', 'Mexico', 'NA'], ['BR', 'Brazil', 'SA'], ['AR', 'Argentina', 'SA'],
  ['CL', 'Chile', 'SA'], ['CO', 'Colombia', 'SA'], ['PE', 'Peru', 'SA'],
  ['UY', 'Uruguay', 'SA'], ['ZA', 'South Africa', 'AF'], ['NG', 'Nigeria', 'AF'],
  ['EG', 'Egypt', 'AF'], ['KE', 'Kenya', 'AF'], ['MA', 'Morocco', 'AF'],
  ['SE', 'Sweden', 'EU'], ['NO', 'Norway', 'EU'], ['DK', 'Denmark', 'EU'],
  ['FI', 'Finland', 'EU'], ['NL', 'Netherlands', 'EU'], ['BE', 'Belgium', 'EU'],
  ['CH', 'Switzerland', 'EU'], ['AT', 'Austria', 'EU'], ['PL', 'Poland', 'EU'],
  ['IE', 'Ireland', 'EU'], ['GR', 'Greece', 'EU'], ['TR', 'Turkey', 'AS'],
  ['RU', 'Russia', 'EU'], ['UA', 'Ukraine', 'EU'],
];

@Injectable()
export class WorldbidSeedService {
  private readonly logger = new Logger(WorldbidSeedService.name);

  constructor(
    @InjectRepository(CountryEntity)
    private readonly repository: Repository<CountryEntity>,
  ) {}

  async run() {
    // Developer slot — permanent SOM·OS territory, never claimable.
    await this.seedSpot({
      iso2: DEVELOPER_SPOT_ID,
      name: 'Islas Baleares',
      continent: 'EU',
      developer: true,
    });
    // Synthetic global plane-banner spot.
    await this.seedSpot({
      iso2: PLANE_SPOT_ID,
      name: 'Global plane banner',
      continent: null,
      developer: false,
    });
    for (const [iso2, name, continent] of COUNTRY_SPOTS) {
      await this.seedSpot({ iso2, name, continent, developer: false });
    }
  }

  private async seedSpot(spot: {
    iso2: string;
    name: string;
    continent: string | null;
    developer: boolean;
  }) {
    const existing = await this.repository.findOne({
      where: { iso2: spot.iso2 },
    });
    if (existing) return; // never overwrite user-generated state
    await this.repository.save(this.repository.create(spot));
    this.logger.log(`Seeded worldbid spot: ${spot.iso2}`);
  }
}