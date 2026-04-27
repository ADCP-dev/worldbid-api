import { Module } from '@nestjs/common';

import { UsersModule } from '@users/users.module';
import { IamModule } from '@iam/iam.module';
import { BillingModule } from '@billing/billing.module';
import { CommsModule } from '@comms/comms.module';
import { StorageModule } from '@storage/storage.module';
import { MailerModule } from '@infra/mailer/mailer.module';
import { ExtensionLoaderModule } from '@core/extension-loader';
import { TranslationsModule } from '@src/modules/translations/translations.module';
import { ErrorTrackerModule } from '@src/modules/error-tracker/error-tracker.module';
import { CmsModule } from '../modules/cms/cms.module';

@Module({
  imports: [
    // Feature Modules
    UsersModule,
    IamModule,
    BillingModule,
    CommsModule,
    StorageModule,
    MailerModule,

    // CMS
    CmsModule,

    // Extensions (auto-discovery)
    ExtensionLoaderModule.register(),

    // Optional modules
    TranslationsModule,
    ErrorTrackerModule,
  ],
})
export class FoundationModule {}
