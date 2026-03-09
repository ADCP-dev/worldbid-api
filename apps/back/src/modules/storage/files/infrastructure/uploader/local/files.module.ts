import { Module } from '@nestjs/common';
import { FilesLocalController } from '@storage/files/infrastructure/uploader/local/files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { FilesLocalService } from '@storage/files/infrastructure/uploader/local/files.service';
import { FilePersistenceModule } from '@storage/files/infrastructure/persistence.module';
import { AllConfigType } from '@src/config/config.type';
import { FilesService } from '@storage/files/files.service';
import { FileLocalSubscriber } from '@storage/files/infrastructure/subscribers/file-local.subscriber';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';

const infrastructurePersistenceModule = FilePersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        return {
          fileFilter: (request, file, callback) => {
            // Accept all types; image optimization is handled in the service
            callback(null, true);
          },
          // Use memory storage so we can read the buffer and optimize before writing
          storage: memoryStorage(),
          limits: {
            fileSize: configService.get('file.maxFileSize', { infer: true }),
          },
        };
      },
    }),
  ],
  controllers: [FilesLocalController],
  providers: [
    ConfigModule,
    ConfigService,
    FilesLocalService,
    FilesService,
    FileLocalSubscriber,
    ImageProcessingService,
    {
      provide: 'FILE_UPLOADER_SERVICE',
      useExisting: FilesLocalService,
    },
  ],
  exports: [
    FilesLocalService,
    'FILE_UPLOADER_SERVICE',
    MulterModule,
    ImageProcessingService,
  ],
})
export class FilesLocalModule {}
