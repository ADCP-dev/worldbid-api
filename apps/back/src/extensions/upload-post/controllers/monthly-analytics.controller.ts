import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { MonthlyAnalyticsService } from '@ext/upload-post/services/monthly-analytics.service';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/monthly-analytics', version: '1' })
export class MonthlyAnalyticsController {
  constructor(private readonly monthlyService: MonthlyAnalyticsService) {}

  /**
   * Get detailed summary for a specific month (YYYY-MM).
   */
  @Get('summary/:month')
  getMonthlySummary(@Param('month') month: string) {
    return this.monthlyService.getMonthlySummary(month);
  }

  /**
   * Get 12-month historical overview.
   */
  @Get('history')
  getMonthlyHistory(@Query('months') months?: string) {
    return this.monthlyService.getMonthlyHistory(months ? Number(months) : 12);
  }

  /**
   * Get top performing posts (all time).
   */
  @Get('top-posts')
  getTopPosts(@Query('limit') limit?: string) {
    return this.monthlyService.getTopPosts(limit ? Number(limit) : 20);
  }

  /**
   * Get top performing posts for a specific month.
   */
  @Get('top-posts/:month')
  getTopPostsByMonth(
    @Param('month') month: string,
    @Query('limit') limit?: string,
  ) {
    return this.monthlyService.getTopPostsByMonth(month, limit ? Number(limit) : 20);
  }
}