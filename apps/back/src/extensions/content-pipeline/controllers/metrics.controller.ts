import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { MetricsService } from '@ext/content-pipeline/services/metrics.service';

@ApiTags('Content-Pipeline')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'content-pipeline', version: '1' })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('projects/:projectId/metrics')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'platform', required: false, type: String })
  findAllByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('platform') platform?: string,
  ) {
    return this.metricsService.findAllByProject(
      projectId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
      platform,
    );
  }

  @Get('metrics/dashboard')
  dashboard() {
    return this.metricsService.dashboard();
  }
}
