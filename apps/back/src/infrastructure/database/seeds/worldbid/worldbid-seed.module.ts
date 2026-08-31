import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorldbidSeedService } from './worldbid-seed.service';
import { CountryEntity } from '@src/modules/worldbid/infrastructure/entities/country.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CountryEntity])],
  providers: [WorldbidSeedService],
  exports: [WorldbidSeedService],
})
export class WorldbidSeedModule {}