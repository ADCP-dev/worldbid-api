import {
  // common
  Module,
} from '@nestjs/common';

import { UsersController } from '@users/users.controller';

import { UsersService } from '@users/users.service';
import { UserPersistenceModule } from '@users/infrastructure/persistence.module';
import { FilesModule } from '@storage/files/files.module';

const infrastructurePersistenceModule = UserPersistenceModule;

@Module({
  imports: [
    // import modules, etc.
    infrastructurePersistenceModule,
    FilesModule.register(),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, infrastructurePersistenceModule],
})
export class UsersModule {}
