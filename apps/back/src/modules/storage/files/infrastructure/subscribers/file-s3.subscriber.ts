import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { FilesS3Service } from '@storage/files/infrastructure/uploader/s3/files.service';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';

@Injectable()
@EventSubscriber()
export class FileS3Subscriber implements EntitySubscriberInterface<FileEntity> {
  private readonly logger = new Logger(FileS3Subscriber.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly filesS3Service: FilesS3Service,
    private readonly fileCleanupErrorRepository: FileCleanupErrorRepository,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return FileEntity;
  }

  async afterRemove(event: RemoveEvent<FileEntity>) {
    const file = event.entity;

    // We only need to delete from S3 if the driver is S3,
    // which is implicitly true because we're injecting FilesS3Service.
    if (file && file.path) {
      try {
        await this.filesS3Service.deletePhysicalFile(file.path);
        this.logger.log(`File ${file.path} deleted from S3 successfully.`);
      } catch (error) {
        this.logger.error(
          `Error deleting file ${file.path} from S3, queuing for retry:`,
          error.stack,
        );

        await this.fileCleanupErrorRepository.save({
          fileUri: file.path,
          driver: 's3',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
