import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AffiliatePartnerEntity } from '@ext/affiliate/infrastructure/persistence/entities/affiliate-partner.entity';
import { AffiliateReferralEntity } from '@ext/affiliate/infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '@ext/affiliate/infrastructure/persistence/entities/affiliate-commission.entity';

// CRM entities (dependency)
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';

// IAM / Users entities (for invite() — creating portal users)
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';

import { AffiliatePartnerService } from '@ext/affiliate/services/affiliate-partner.service';
import { AffiliateReferralService } from '@ext/affiliate/services/affiliate-referral.service';
import { AffiliateCommissionService } from '@ext/affiliate/services/affiliate-commission.service';
import { AffiliateDashboardService } from '@ext/affiliate/services/affiliate-dashboard.service';
import { AffiliatePortalService } from '@ext/affiliate/services/affiliate-portal.service';
import { AffiliateReportService } from '@ext/affiliate/services/affiliate-report.service';

import { AffiliatePartnerController } from '@ext/affiliate/controllers/affiliate-partner.controller';
import { AffiliateReferralController } from '@ext/affiliate/controllers/affiliate-referral.controller';
import { AffiliateCommissionController } from '@ext/affiliate/controllers/affiliate-commission.controller';
import { AffiliateDashboardController } from '@ext/affiliate/controllers/affiliate-dashboard.controller';
import { AffiliatePortalController } from '@ext/affiliate/controllers/affiliate-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Affiliate entities
      AffiliatePartnerEntity,
      AffiliateReferralEntity,
      AffiliateCommissionEntity,
      // CRM entities (dependency)
      CrmClientEntity,
      CrmProjectEntity,
      CrmOriginEntity,
      // IAM / Users entities (for invite)
      UserEntity,
      RoleEntity,
    ]),
  ],
  controllers: [
    AffiliatePartnerController,
    AffiliateReferralController,
    AffiliateCommissionController,
    AffiliateDashboardController,
    AffiliatePortalController,
  ],
  providers: [
    AffiliatePartnerService,
    AffiliateReferralService,
    AffiliateCommissionService,
    AffiliateDashboardService,
    AffiliatePortalService,
    AffiliateReportService,
  ],
  exports: [
    AffiliatePartnerService,
    AffiliateReferralService,
    AffiliateCommissionService,
    AffiliateDashboardService,
    AffiliatePortalService,
    AffiliateReportService,
  ],
})
export class AffiliateExtensionModule {}