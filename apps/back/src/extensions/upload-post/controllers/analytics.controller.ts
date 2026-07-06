import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { AnalyticsService } from '@ext/upload-post/services/analytics.service';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── Static routes FIRST (before :profileUsername wildcard) ──────────

  @Get('platform-metrics')
  getPlatformMetrics() {
    return this.analyticsService.getPlatformMetrics();
  }

  @Get('total-impressions/:profileUsername')
  getTotalImpressions(@Param('profileUsername') profileUsername: string) {
    return this.analyticsService.getTotalImpressions(profileUsername);
  }

  @Get('post/:requestId')
  getPostAnalytics(@Param('requestId') requestId: string) {
    return this.analyticsService.getPostAnalytics(requestId);
  }

  // ─── Dynamic route LAST ───────────────────────────────────────────────

  @Get(':profileUsername')
  getAnalytics(
    @Param('profileUsername') profileUsername: string,
    @Query('platforms') platforms?: string,
  ) {
    return this.analyticsService.getAnalytics(
      profileUsername,
      platforms ? platforms.split(',') : undefined,
    );
  }
}
