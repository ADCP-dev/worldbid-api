import { Module } from '@nestjs/common';
import { UsersModule } from '@users/users.module';
import { FilesModule } from '@storage/files/files.module';
import { AuthModule } from '@iam/auth/auth.module';
import databaseConfig from '@infra/database/config/database.config';
import authConfig from '@iam/auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from '@comms/mail/config/mail.config';
import fileConfig from '@storage/files/config/file.config';
import facebookConfig from '@iam/auth-facebook/config/facebook.config';
import googleConfig from '@iam/auth-google/config/google.config';
import appleConfig from '@iam/auth-apple/config/apple.config';
import path, { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthAppleModule } from '@iam/auth-apple/auth-apple.module';
import { AuthFacebookModule } from '@iam/auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from '@iam/auth-google/auth-google.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from '@infra/database/typeorm-config.service';
import { MailModule } from '@comms/mail/mail.module';
import { HomeModule } from '@comms/home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from '@iam/session/session.module';
import { MailerModule } from '@infra/mailer/mailer.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ApiKeysModule } from '@iam/api-keys/api-keys.module';
import { StripeModule } from '@billing/stripe/stripe.module';
import stripeConfig from '@billing/stripe/config/stripe.config';
import workerConfig from './config/worker.config';
import { EmailQueueModule } from '@comms/email-queue/email-queue.module';
import { ExtensionLoaderModule } from './core/extension-loader';
import { TranslationsModule } from './modules/translations/translations.module';
import { discoverExtensionConfigs } from './core/config-loader';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
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
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
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
    UsersModule,
    FilesModule,
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    ApiKeysModule,
    StripeModule,
    HomeModule,
    EmailQueueModule.register(),
    ExtensionLoaderModule.register(),
    TranslationsModule,
  ],
})
export class AppModule {}
