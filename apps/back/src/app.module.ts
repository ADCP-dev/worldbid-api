import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { InfrastructureModule } from '@core/infrastructure.module';
import { FoundationModule } from '@core/foundation.module';
import { UserOrIpThrottlerGuard } from '@core/user-or-ip-throttler.guard';

@Module({
  imports: [
    // Infrastructure (DB, Config, i18n, static files, scheduler)
    InfrastructureModule,

    // Base modules
    FoundationModule,

    // Global rate limit keyed on user.id (or IP for anonymous traffic).
    // The default of 1000 req/min per user is generous for SPA clients
    // but still stops a runaway script. Sensitive routes (login,
    // register, forgot-password) declare their own tighter @Throttle
    // override on the controller method.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 1000,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserOrIpThrottlerGuard,
    },
  ],
})
export class AppModule {}
