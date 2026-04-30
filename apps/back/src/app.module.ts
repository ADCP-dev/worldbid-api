import { Module } from '@nestjs/common';

import { InfrastructureModule } from '@core/infrastructure.module';
import { FoundationModule } from '@core/foundation.module';

import { TestProductsModule } from './test-products/test-products.module';

import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ProductsModule,
    TestProductsModule,
    // Infrastructure (DB, Config, i18n, static files, scheduler)
    InfrastructureModule,

    // Base modules
    FoundationModule,
  ],
})
export class AppModule {}
