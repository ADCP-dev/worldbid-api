import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusSeedService } from '@infra/database/seeds/status/status-seed.service';
import { StatusEntity } from '@users/statuses/infrastructure/entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StatusEntity])],
  providers: [StatusSeedService],
  exports: [StatusSeedService],
})
export class StatusSeedModule {}
