import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { AffiliateReferralService } from '../services/affiliate-referral.service';
import { CreateReferralDto } from '../dto/create-referral.dto';
import { UpdateReferralDto } from '../dto/update-referral.dto';

@ApiTags('Affiliate')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'affiliate/referrals', version: '1' })
export class AffiliateReferralController {
  constructor(private readonly referralService: AffiliateReferralService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'partnerId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('partnerId') partnerId?: number,
    @Query('status') status?: string,
  ) {
    return this.referralService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      partnerId: partnerId ? Number(partnerId) : undefined,
      status,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReferralDto) {
    return this.referralService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateReferralDto) {
    return this.referralService.update(Number(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.referralService.delete(Number(id));
  }
}
