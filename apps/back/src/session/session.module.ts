import {
  // common
  Module,
} from '@nestjs/common';

import { SessionPersistenceModule } from './infrastructure/persistence.module';
import { SessionService } from './session.service';

const infrastructurePersistenceModule = SessionPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  providers: [SessionService],
  exports: [SessionService, infrastructurePersistenceModule],
})
export class SessionModule {}
