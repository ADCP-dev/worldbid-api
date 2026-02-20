import { Module, DynamicModule } from '@nestjs/common';

import { FilePersistenceModule } from './infrastructure/persistence.module';
import { FilesService } from './files.service';
import fileConfig from './config/file.config';
import { FileConfig, FileDriver } from './config/file-config.type';
import { FilesLocalModule } from './infrastructure/uploader/local/files.module';
import { FilesS3Module } from './infrastructure/uploader/s3/files.module';
import { FilesS3PresignedModule } from './infrastructure/uploader/s3-presigned/files.module';

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
      imports: [FilePersistenceModule, uploaderModule],
      providers: [FilesService],
      exports: [FilesService, FilePersistenceModule, uploaderModule],
    };
  }
}
