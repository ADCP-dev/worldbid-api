import { Module } from '@nestjs/common';
import { ApiKeyRepository } from '@iam/api-keys/infrastructure/api-key.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from '@iam/api-keys/infrastructure/entities/api-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity])],
  providers: [ApiKeyRepository],
  exports: [ApiKeyRepository],
})
export class ApiKeyPersistenceModule {}
