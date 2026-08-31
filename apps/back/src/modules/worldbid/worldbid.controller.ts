import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { OptionalAuth, JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

import { BidsService } from './bids.service';
import { BidCheckoutService } from './bid-checkout.service';
import { WorldbidEventEntity } from './infrastructure/entities/worldbid-event.entity';
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
  private readonly logger = new Logger(WorldbidController.name);

  constructor(
    private readonly bidsService: BidsService,
    private readonly bidCheckoutService: BidCheckoutService,
  ) {}

  /**
   * Public activity feed (SSE). Emits the current recent list on connect,
   * then re-emits every 5s (cheap poll-based push; swappable for a
   * postgres LISTEN/NOTIFY gateway later without changing clients).
   */
  /**
   * Manual SSE — bypasses the interceptor stack (the global
   * ResolvePromisesInterceptor + ClassSerializerInterceptor mangle the
   * MessageEvent stream: data arrives falsy to SseStream, so only the
   * auto-injected `id:` frames reach clients).
   */
  @Get('activity-stream')
  activityStream(@Res() res: any): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    let closed = false;
    res.on('close', () => {
      closed = true;
    });
    const push = async () => {
      if (closed) return;
      try {
        const rows = await this.bidsService.recentActivity(20);
        res.write(`data: ${JSON.stringify(rows)}\n\n`);
      } catch {
        res.write(`data: []\n\n`);
      }
    };
    void push();
    const timer = setInterval(() => void push(), 5000);
    res.on('close', () => clearInterval(timer));
  }

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