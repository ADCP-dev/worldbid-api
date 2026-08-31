import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CountryEntity } from './infrastructure/entities/country.entity';
import { BidEntity } from './infrastructure/entities/bid.entity';
import { WorldbidEventEntity } from './infrastructure/entities/worldbid-event.entity';
import { BidsService } from './bids.service';
import { BidCheckoutService } from './bid-checkout.service';
import { BidSettlementService } from './bid-settlement.service';
import { WorldbidController } from './worldbid.controller';
import { stripeProvider, STRIPE_PROVIDER } from '@ext/stripe/stripe.provider';

/**
 * WorldBid module — vitalicio territorial bidding API.
 *
 * Shares the stripe extension's Stripe SDK provider (single API client) and
 * contributes the settlement listener to STRIPE_EVENT_LISTENERS, which the
 * extension's WebhooksService invokes after every verified webhook event.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CountryEntity, BidEntity, WorldbidEventEntity]),
  ],
  controllers: [WorldbidController],
  providers: [
    BidsService,
    BidCheckoutService,
    BidSettlementService,
    {
      // BidSettlementService receives verified Stripe events via the
      // extension's WebhooksService (see STRIPE_EVENT_LISTENERS contract).
      provide: 'STRIPE_EVENT_LISTENERS',
      useFactory: (settlement: BidSettlementService) => [settlement],
      inject: [BidSettlementService],
    },
    stripeProvider,
  ],
  exports: [BidsService],
})
export class WorldbidModule {}