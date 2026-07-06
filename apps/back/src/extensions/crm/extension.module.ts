import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CrmStatusEntity } from '@ext/crm/infrastructure/persistence/entities/crm-status.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmContactEntity } from '@ext/crm/infrastructure/persistence/entities/crm-contact.entity';
import { CrmInteractionEntity } from '@ext/crm/infrastructure/persistence/entities/crm-interaction.entity';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';

import { CrmClientService } from '@ext/crm/services/crm-client.service';
import { CrmContactService } from '@ext/crm/services/crm-contact.service';
import { CrmInteractionService } from '@ext/crm/services/crm-interaction.service';
import { CrmProjectService } from '@ext/crm/services/crm-project.service';
import { CrmStatusService } from '@ext/crm/services/crm-status.service';
import { CrmOriginService } from '@ext/crm/services/crm-origin.service';
import { CrmDashboardService } from '@ext/crm/services/crm-dashboard.service';
import { CrmSeedService } from '@ext/crm/seeds/crm-seed.service';

import { CrmClientController } from '@ext/crm/controllers/crm-client.controller';
import { CrmContactController } from '@ext/crm/controllers/crm-contact.controller';
import { CrmInteractionController } from '@ext/crm/controllers/crm-interaction.controller';
import { CrmProjectController } from '@ext/crm/controllers/crm-project.controller';
import { CrmStatusController } from '@ext/crm/controllers/crm-status.controller';
import { CrmOriginController } from '@ext/crm/controllers/crm-origin.controller';
import { CrmDashboardController } from '@ext/crm/controllers/crm-dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmStatusEntity,
      CrmOriginEntity,
      CrmClientEntity,
      CrmContactEntity,
      CrmInteractionEntity,
      CrmProjectEntity,
    ]),
  ],
  controllers: [
    CrmClientController,
    CrmContactController,
    CrmInteractionController,
    CrmProjectController,
    CrmStatusController,
    CrmOriginController,
    CrmDashboardController,
  ],
  providers: [
    CrmClientService,
    CrmContactService,
    CrmInteractionService,
    CrmProjectService,
    CrmStatusService,
    CrmOriginService,
    CrmDashboardService,
    CrmSeedService,
  ],
  exports: [
    CrmClientService,
    CrmContactService,
    CrmInteractionService,
    CrmProjectService,
    CrmStatusService,
    CrmOriginService,
    CrmDashboardService,
    CrmSeedService,
  ],
})
export class CrmExtensionModule {}