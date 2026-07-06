import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { CurrentUser, AuthenticatedUser } from '@iam/auth/decorators/current-user.decorator';
import { AffiliatePortalService } from '../services/affiliate-portal.service';
import { PortalCreateReferralDto } from '../dto/portal-create-referral.dto';
import { UpdatePortalProfileDto } from '../dto/update-portal-profile.dto';

@ApiTags('Affiliate Portal')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.affiliate, RoleEnum.admin)
@Controller({ path: 'affiliate/portal', version: '1' })
export class AffiliatePortalController {
  constructor(private readonly portalService: AffiliatePortalService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.getPartnerProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePortalProfileDto,
  ) {
    return this.portalService.updatePartnerProfile(user.id, dto);
  }

  @Get('referrals')
  getReferrals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.portalService.getPartnerReferrals(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Post('referrals')
  @HttpCode(HttpStatus.CREATED)
  createReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PortalCreateReferralDto,
  ) {
    return this.portalService.createPortalReferral(user.id, dto);
  }

  @Get('referrals/:id')
  getReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: number,
  ) {
    return this.portalService.getPartnerReferral(user.id, Number(id));
  }

  @Get('commissions')
  getCommissions(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.getPartnerCommissions(user.id);
  }

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.getPartnerSummary(user.id);
  }
}