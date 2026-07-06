import { Module, DynamicModule } from '@nestjs/common';

import { FilePersistenceModule } from '@storage/files/infrastructure/persistence.module';
import { FilesService } from '@storage/files/files.service';
import fileConfig from '@storage/files/config/file.config';
import { FileConfig, FileDriver } from '@storage/files/config/file-config.type';
import { FilesLocalModule } from '@storage/files/infrastructure/uploader/local/files.module';
import { FilesS3Module } from '@storage/files/infrastructure/uploader/s3/files.module';
import { FilesS3PresignedModule } from '@storage/files/infrastructure/uploader/s3-presigned/files.module';
import { FileCleanupCronService } from '@storage/files/infrastructure/cron/file-cleanup.cron';
import { IsEntityTableConstraint } from '@infra/utils/validators/is-entity-table.validator';
import { ErrorTrackerModule } from '@src/modules/error-tracker/error-tracker.module';

@Module({})
export class FilesModule {
  static register(): DynamicModule {
    const driver = (fileConfig() as FileConfig).driver;

    const uploaderModule =
      driver === FileDriver.LOCAL
        ? FilesLocalModule
        : driver === FileDriver.S3
          ? FilesS3Module
          : FilesS3PresignedModule;

    return {
      module: FilesModule,
      imports: [FilePersistenceModule, uploaderModule, ErrorTrackerModule],
      providers: [
        FilesService,
        FileCleanupCronService,
        IsEntityTableConstraint,
      ],
      exports: [FilesService, FilePersistenceModule, uploaderModule],
    };
  }
}
