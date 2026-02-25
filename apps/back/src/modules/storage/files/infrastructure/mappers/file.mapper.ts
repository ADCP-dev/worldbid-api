import { FileType } from '@storage/files/domain/file';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';

export class FileMapper {
  static toDomain(raw: FileEntity): FileType {
    const domainEntity = new FileType();
    domainEntity.id = raw.id;
    domainEntity.path = raw.path;
    domainEntity.name = raw.name;
    domainEntity.isPublic = raw.isPublic;
    domainEntity.entity = raw.entity;
    domainEntity.entityId = raw.entityId;
    domainEntity.userId = raw.userId;
    domainEntity.type = raw.type;
    domainEntity.size = raw.size;
    return domainEntity;
  }

  static toPersistence(domainEntity: FileType): FileEntity {
    const persistenceEntity = new FileEntity();
    persistenceEntity.id = domainEntity.id;
    persistenceEntity.path = domainEntity.path;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.isPublic = domainEntity.isPublic;
    persistenceEntity.entity = domainEntity.entity;
    persistenceEntity.entityId = domainEntity.entityId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.type = domainEntity.type;
    persistenceEntity.size = domainEntity.size;
    return persistenceEntity;
  }
}
