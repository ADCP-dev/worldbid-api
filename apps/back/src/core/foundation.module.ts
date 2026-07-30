import { Module } from '@nestjs/common';

import { UsersModule } from '@users/users.module';
import { IamModule } from '@iam/iam.module';
import { BillingModule } from '@billing/billing.module';
import { CommsModule } from '@comms/comms.module';
import { StorageModule } from '@storage/storage.module';
import { MailerModule } from '@infra/mailer/mailer.module';
import { ExtensionLoaderModule } from '@core/extension-loader';
import { SpecEngineModule } from '@core/spec-engine/spec-engine.module';
import { TranslationsModule } from '@src/modules/translations/translations.module';
import { ErrorTrackerModule } from '@src/modules/error-tracker/error-tracker.module';
import { AppSettingsModule } from '@settings/app-settings.module';

@Module({
  imports: [
    // Feature Modules
    UsersModule,
    IamModule,
    BillingModule,
    CommsModule,
    StorageModule,
    MailerModule,

    // Extensions (auto-discovery — traditional .ts modules)
    ExtensionLoaderModule.register(),

    // Spec Engine (auto-discovery — YAML spec → dynamic runtime)
    SpecEngineModule.register(),

    // Optional modules
    TranslationsModule,
    ErrorTrackerModule,
    AppSettingsModule,
  ],
})
export class FoundationModule {}
