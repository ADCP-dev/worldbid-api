import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

import databaseConfig from '@infra/database/config/database.config';
import authConfig from '@iam/auth/config/auth.config';
import appConfig from '@src/config/app.config';
import mailConfig from '@comms/mail/config/mail.config';
import fileConfig from '@storage/files/config/file.config';
import facebookConfig from '@iam/auth-facebook/config/facebook.config';
import googleConfig from '@iam/auth-google/config/google.config';
import appleConfig from '@iam/auth-apple/config/apple.config';
import stripeConfig from '@billing/stripe/config/stripe.config';
import workerConfig from '@src/config/worker.config';
import { TypeOrmConfigService } from '@infra/database/typeorm-config.service';
import { discoverExtensionConfigs } from '@core/config-loader';
import { AllConfigType } from '@src/config/config.type';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    // Scheduler
    ScheduleModule.forRoot(),

    // Static files
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'public'),
    }),

    // Configuration — global, loads all domain configs
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        appleConfig,
        stripeConfig,
        workerConfig,
        ...discoverExtensionConfigs(),
      ],
      envFilePath: ['.env'],
    }),

    // Database
    infrastructureDatabaseModule,

    // i18n
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '..', 'i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
  ],
})
export class InfrastructureModule {}
