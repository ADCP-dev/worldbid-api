import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';

@Injectable()
@EventSubscriber()
export class GlobalFileCleanupSubscriber
  implements EntitySubscriberInterface<any>
{
  private readonly logger = new Logger(GlobalFileCleanupSubscriber.name);

  constructor(private readonly dataSource: DataSource) {
    this.dataSource.subscribers.push(this);
  }

  async beforeRemove(event: RemoveEvent<any>) {
    // 1. Avoid infinite loop: ignore if the entity being deleted is FileEntity
    if (!event.metadata || event.metadata.targetName === 'FileEntity') {
      return;
    }

    const entityName = event.metadata.tableName;

    // 2. Extract the entity ID dynamically
    if (
      !event.metadata.primaryColumns ||
      event.metadata.primaryColumns.length === 0
    ) {
      return;
    }

    const primaryColumn = event.metadata.primaryColumns[0];
    const entityId = event.entity
      ? event.entity[primaryColumn.propertyName]
      : event.entityId;

    if (!entityId) return;

    // 3. Find associated files
    const fileRepository = event.manager.getRepository(FileEntity);
    const relatedFiles = await fileRepository.find({
      where: {
        entityName: entityName,
        entityId: String(entityId),
      },
    });

    // 4. IMPORTANT: Use .remove() and not .delete() to trigger cascades like FileS3Subscriber
    if (relatedFiles.length > 0) {
      this.logger.log(
        `Found ${relatedFiles.length} files associated with ${entityName} (ID: ${entityId}). Removing them...`,
      );
      await fileRepository.remove(relatedFiles);
    }
  }
}
