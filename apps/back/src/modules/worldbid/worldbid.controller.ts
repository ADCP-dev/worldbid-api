import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { OptionalAuth, JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

import { BidsService } from './bids.service';
import { BidCheckoutService } from './bid-checkout.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { CountryEntity } from './infrastructure/entities/country.entity';

class TopBidsQueryDto {
  @ApiPropertyOptional({ description: 'Max rows (1-50)', default: 10 })
  @IsOptional()
  limit?: number;
}

@ApiTags('WorldBid')
@Controller({ path: 'worldbid', version: '1' })
export class WorldbidController {
  constructor(
    private readonly bidsService: BidsService,
    private readonly bidCheckoutService: BidCheckoutService,
  ) {}

  /** All spots with their active bid — seeds the front globe/panels. */
  @Get('spots')
  @OptionalAuth()
  @ApiOkResponse({ description: 'All spots + active paid bids' })
  async spots(): Promise<{
    spots: Array<{
      iso2: string;
      name: string;
      developer: boolean;
      activeBid: {
        id: string;
        alias: string;
        url: string;
        pitch: string | null;
        amount: number;
        accentColor: string;
      } | null;
    }>;
  }> {
    const [countries, bids] = await Promise.all([
      this.bidsService.allSpots(),
      this.bidsService.allActiveBids(),
    ]);
    const byCountry = new Map(bids.map((b) => [b.countryId, b]));
    return {
      spots: countries.map((c) => {
        const b = byCountry.get(c.iso2);
        return {
          iso2: c.iso2,
          name: c.name,
          developer: c.developer,
          activeBid: b
            ? {
                id: b.id,
                alias: b.alias,
                url: b.url,
                pitch: b.pitch,
                amount: Number(b.amount),
                accentColor: b.accentColor,
              }
            : null,
        };
      }),
    };
  }

  /** Tiered minimum bid for a spot (drives the form's minimum). */
  @Get('spots/:iso2/min-bid')
  @OptionalAuth()
  async minBid(@Param('iso2') iso2: string): Promise<{ min: number }> {
    return { min: await this.bidsService.minBidFor(iso2.toUpperCase()) };
  }

  /**
   * Create a pending bid and its Stripe checkout session.
   * Returns the hosted checkout URL; ownership settles via webhook.
   */
  @Post('bids')
  @JwtAuth()
  @HttpCode(HttpStatus.CREATED)
  async placeBid(
    @UserId() userId: number,
    @Body() dto: PlaceBidDto,
  ): Promise<{ bidId: string; checkoutUrl: string | null; status: string }> {
    const bid = await this.bidsService.createPendingBid({
      countryId: dto.countryId.toUpperCase(),
      userId,
      alias: dto.alias,
      email: dto.email ?? null,
      url: dto.url,
      pitch: dto.pitch ?? null,
      amount: dto.amount,
      accentColor: dto.accentColor,
    });
    let checkoutUrl: string | null = null;
    if (this.bidCheckoutService.isConfigured) {
      const session = await this.bidCheckoutService.createCheckoutForBid(
        bid,
        dto.email ?? null,
      );
      checkoutUrl = session.url ?? null;
    }
    return { bidId: bid.id, checkoutUrl, status: bid.status };
  }

  /** World Order top list (paid bids only, dev slot excluded). */
  @Get('top')
  @OptionalAuth()
  async top(@Query() q: TopBidsQueryDto) {
    const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
    return { rows: await this.bidsService.topBids(limit) };
  }

  /** Header chip stats. */
  @Get('stats')
  @OptionalAuth()
  async stats() {
    return this.bidsService.globalStats();
  }
}