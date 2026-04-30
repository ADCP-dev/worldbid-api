import { Module } from '@nestjs/common';

import { InfrastructureModule } from '@core/infrastructure.module';
import { FoundationModule } from '@core/foundation.module';

@Module({
  imports: [
    // Infrastructure (DB, Config, i18n, static files, scheduler)
    InfrastructureModule,

    // Base modules
    FoundationModule,
  ],
})
export class AppModule {}
