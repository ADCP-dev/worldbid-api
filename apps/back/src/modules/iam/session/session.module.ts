import {
  // common
  Module,
} from '@nestjs/common';

import { SessionPersistenceModule } from '@iam/session/infrastructure/persistence.module';
import { SessionService } from '@iam/session/session.service';

const infrastructurePersistenceModule = SessionPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  providers: [SessionService],
  exports: [SessionService, infrastructurePersistenceModule],
})
export class SessionModule {}
