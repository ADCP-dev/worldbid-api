import { Module } from '@nestjs/common';
import { AppSettingRepository } from '@settings/infrastructure/app-setting.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingEntity } from '@settings/infrastructure/entities/app-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSettingEntity])],
  providers: [AppSettingRepository],
  exports: [AppSettingRepository],
})
export class AppSettingPersistenceModule {}
