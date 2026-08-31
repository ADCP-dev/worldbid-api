import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '@infra/database/typeorm-config.service';
import { RoleSeedModule } from '@infra/database/seeds/role/role-seed.module';
import { StatusSeedModule } from '@infra/database/seeds/status/status-seed.module';
import { UserSeedModule } from '@infra/database/seeds/user/user-seed.module';
import { WorldbidSeedModule } from '@infra/database/seeds/worldbid/worldbid-seed.module';
import databaseConfig from '@infra/database/config/database.config';
import appConfig from '@src/config/app.config';
import { ExtensionSeedLoaderModule } from '@src/core/seed-loader';
import { TranslationsModule } from '../../../modules/translations/translations.module';

@Module({
  imports: [
    TranslationsModule,
    RoleSeedModule,
    StatusSeedModule,
    UserSeedModule,
    WorldbidSeedModule,
    ExtensionSeedLoaderModule.register(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options?: DataSourceOptions) => {
        if (!options) throw new Error('DataSourceOptions is required');
        return new DataSource(options).initialize();
      },
    }),
  ],
})
export class SeedModule {}
