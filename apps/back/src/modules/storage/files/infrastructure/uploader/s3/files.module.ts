import {
  HttpStatus,
  Module,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FilesS3Controller } from '@storage/files/infrastructure/uploader/s3/files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { memoryStorage } from 'multer';
import { FilesS3Service } from '@storage/files/infrastructure/uploader/s3/files.service';
import { FilePersistenceModule } from '@storage/files/infrastructure/persistence.module';
import { AllConfigType } from '@src/config/config.type';
import { FilesService } from '@storage/files/files.service';
import { FileS3Subscriber } from '@storage/files/infrastructure/subscribers/file-s3.subscriber';
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
            // Allow all file types; filtering happens at service level
            callback(null, true);
          },
          // Use memory storage so we can intercept the buffer for optimization
          storage: memoryStorage(),
          limits: {
            fileSize: configService.get('file.maxFileSize', { infer: true }),
          },
        };
      },
    }),
  ],
  controllers: [FilesS3Controller],
  providers: [
    FilesS3Service,
    FilesService,
    FileS3Subscriber,
    ImageProcessingService,
    {
      provide: 'FILE_UPLOADER_SERVICE',
      useExisting: FilesS3Service,
    },
  ],
  exports: [FilesS3Service, 'FILE_UPLOADER_SERVICE', MulterModule],
})
export class FilesS3Module {}
