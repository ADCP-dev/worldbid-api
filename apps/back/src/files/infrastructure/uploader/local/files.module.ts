import { Module } from '@nestjs/common';
import { FilesLocalController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { FilesLocalService } from './files.service';
import { RelationalFilePersistenceModule } from '../../persistence/relational/relational-persistence.module';
import { AllConfigType } from '../../../../config/config.type';
import { FilesService } from '../../../files.service';
import * as fs from 'fs';

const infrastructurePersistenceModule = RelationalFilePersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => {
        return {
          fileFilter: (request, file, callback) => {
            //   if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            //     return callback(
            //       new UnprocessableEntityException({
            //         status: HttpStatus.UNPROCESSABLE_ENTITY,
            //         errors: {
            //           file: `cantUploadFileType`,
            //         },
            //       }),
            //       false,
            //     );
            //   }

            callback(null, true);
          },
          storage: diskStorage({
            destination: (req, file, callback) => {
              // We'll use a temporary upload directory first
              const tempUploadDir = './files/temp';
              // Ensure the directory exists and create it if it doesn't
              fs.mkdirSync(tempUploadDir, { recursive: true });

              callback(null, tempUploadDir);
            },
            filename: (request, file, callback) => {
              callback(
                null,
                `${randomStringGenerator()}.${file.originalname
                  .split('.')
                  .pop()
                  ?.toLowerCase()}`,
              );
            },
          }),
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
    {
      provide: 'FILE_UPLOADER_SERVICE',
      useExisting: FilesLocalService,
    },
  ],
  exports: [FilesLocalService, 'FILE_UPLOADER_SERVICE', MulterModule],
})
export class FilesLocalModule {}
