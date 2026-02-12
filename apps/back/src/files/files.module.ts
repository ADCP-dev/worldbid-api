import { Module, DynamicModule } from '@nestjs/common';

import { RelationalFilePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesService } from './files.service';
import fileConfig from './config/file.config';
import { FileConfig, FileDriver } from './config/file-config.type';

@Module({})
export class FilesModule {
  static register(): DynamicModule {
    const driver = (fileConfig() as FileConfig).driver;

    // Lazily require uploader module to avoid importing unused drivers at startup
    const uploaderModule =
      driver === FileDriver.LOCAL
        ? require('./infrastructure/uploader/local/files.module')
            .FilesLocalModule
        : driver === FileDriver.S3
          ? require('./infrastructure/uploader/s3/files.module').FilesS3Module
          : driver === FileDriver.S3_PRESIGNED
            ? require('./infrastructure/uploader/s3-presigned/files.module')
                .FilesS3PresignedModule
            : require('./infrastructure/uploader/s3-presigned/files.module')
                .FilesS3PresignedModule; // fallback

    return {
      module: FilesModule,
      imports: [RelationalFilePersistenceModule, uploaderModule],
      providers: [FilesService],
      exports: [FilesService, RelationalFilePersistenceModule, uploaderModule],
    };
  }
}
