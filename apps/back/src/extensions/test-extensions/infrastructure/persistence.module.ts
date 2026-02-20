import { Module } from '@nestjs/common';
import { TestExtensionRepository } from './test-extension.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestExtensionEntity } from './entities/test-extension.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TestExtensionEntity])],
  providers: [
    TestExtensionRepository,
  ],
  exports: [TestExtensionRepository],
})
export class TestExtensionPersistenceModule {}
