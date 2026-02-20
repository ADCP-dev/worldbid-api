import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { TestExtensionsService } from './test-extensions.service';
import { TestExtensionsController } from './test-extensions.controller';
import { TestExtensionPersistenceModule } from './infrastructure/persistence.module';

@Module({
  imports: [
    // do not remove this comment
    TestExtensionPersistenceModule,
  ],
  controllers: [TestExtensionsController],
  providers: [TestExtensionsService],
  exports: [TestExtensionsService, TestExtensionPersistenceModule],
})
export class TestExtensionsExtensionModule {}
