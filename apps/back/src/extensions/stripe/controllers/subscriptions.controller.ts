import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UserId } from '@iam/auth/decorators/current-user.decorator';
import { PlanGuard, RequiredFeature } from '../middleware/plan-guard';

@ApiTags('Stripe')
@Controller({
  path: 'stripe/subscriptions',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiBearerAuth()
  findAll(@UserId() userId: number) {
    return this.subscriptionsService.findByUser(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  findMe(@UserId() userId: number) {
    return this.subscriptionsService.findActiveByUser(userId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  findById(@Param('id') id: string) {
    return this.subscriptionsService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanGuard)
  @RequiredFeature('subscription')
  create(@UserId() userId: number, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(userId, dto);
  }

  @Patch(':id/resume')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @UseGuards(PlanGuard)
  @RequiredFeature('subscription')
  resume(@Param('id') id: string) {
    return this.subscriptionsService.resume(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlanGuard)
  @RequiredFeature('subscription')
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id);
  }
}
