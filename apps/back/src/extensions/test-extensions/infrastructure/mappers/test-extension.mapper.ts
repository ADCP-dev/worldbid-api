import { TestExtension } from '../../domain/test-extension';
import { TestExtensionEntity } from '../entities/test-extension.entity';

export class TestExtensionMapper {
  static toDomain(raw: TestExtensionEntity): TestExtension {
    const domainEntity = new TestExtension();
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: TestExtension): TestExtensionEntity {
    const persistenceEntity = new TestExtensionEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
