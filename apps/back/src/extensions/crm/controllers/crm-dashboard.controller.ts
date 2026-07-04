import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { CrmDashboardService } from '../services/crm-dashboard.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'crm/dashboard', version: '1' })
export class CrmDashboardController {
  constructor(private readonly dashboardService: CrmDashboardService) {}

  @Get()
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}