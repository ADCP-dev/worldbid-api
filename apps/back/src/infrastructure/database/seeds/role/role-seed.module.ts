import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleSeedService } from '@infra/database/seeds/role/role-seed.service';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity])],
  providers: [RoleSeedService],
  exports: [RoleSeedService],
})
export class RoleSeedModule {}
