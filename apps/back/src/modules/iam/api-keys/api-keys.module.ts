import { Module } from '@nestjs/common';
import { ApiKeysService } from '@iam/api-keys/api-keys.service';
import { ApiKeysController } from '@iam/api-keys/api-keys.controller';
import { ApiKeyPersistenceModule } from '@iam/api-keys/infrastructure/persistence.module';

@Module({
  imports: [ApiKeyPersistenceModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
