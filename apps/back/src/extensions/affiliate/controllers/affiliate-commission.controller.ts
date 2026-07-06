import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { AffiliateCommissionService } from '../services/affiliate-commission.service';
import { CreateCommissionDto } from '../dto/create-commission.dto';
import { UpdateCommissionDto } from '../dto/update-commission.dto';

@ApiTags('Affiliate')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'affiliate/commissions', version: '1' })
export class AffiliateCommissionController {
  constructor(private readonly commissionService: AffiliateCommissionService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'partnerId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('partnerId') partnerId?: number,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.commissionService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      partnerId: partnerId ? Number(partnerId) : undefined,
      status,
      dateFrom,
      dateTo,
    });
  }

  @Get('summary')
  summary() {
    return this.commissionService.getSummary();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCommissionDto) {
    return this.commissionService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateCommissionDto) {
    return this.commissionService.update(Number(id), dto);
  }
}
