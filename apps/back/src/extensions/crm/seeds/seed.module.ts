import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmStatusEntity } from '../infrastructure/persistence/entities/crm-status.entity';
import { CrmOriginEntity } from '../infrastructure/persistence/entities/crm-origin.entity';
import { CrmSeedService } from './crm-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrmStatusEntity, CrmOriginEntity])],
  providers: [CrmSeedService],
  exports: [CrmSeedService],
})
export class CrmSeedModule {}
