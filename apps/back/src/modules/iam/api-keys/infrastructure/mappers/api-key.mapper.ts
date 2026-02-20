import { ApiKey } from '@iam/api-keys/domain/api-key';
import { ApiKeyEntity } from '@iam/api-keys/infrastructure/entities/api-key.entity';
import { UserMapper } from '@users/infrastructure/mappers/user.mapper';

export class ApiKeyMapper {
  static toDomain(raw: ApiKeyEntity): ApiKey {
    const domainEntity = new ApiKey();
    domainEntity.id = raw.id;
    domainEntity.key = raw.key;
    domainEntity.userId = raw.userId;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    if (raw.user) {
      domainEntity.user = UserMapper.toDomain(raw.user);
    }

    return domainEntity;
  }

  static toPersistence(domainEntity: ApiKey): ApiKeyEntity {
    const persistenceEntity = new ApiKeyEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.key = domainEntity.key;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
