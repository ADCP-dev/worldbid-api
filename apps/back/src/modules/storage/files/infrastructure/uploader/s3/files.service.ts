import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { AllConfigType } from '@src/config/config.type';
import { FileRepository } from '@storage/files/infrastructure/file.repository';
import { FileType } from '@storage/files/domain/file';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';
import { buildStoragePath } from '@storage/files/infrastructure/utils/build-storage-path.util';

@Injectable()
export class FilesS3Service {
  private readonly s3: S3Client;
  private readonly logger = new Logger(FilesS3Service.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly cleanupErrorRepository: FileCleanupErrorRepository,
    private readonly imageProcessingService: ImageProcessingService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get('file.awsS3Region', { infer: true }),
      endpoint: this.configService.get('file.awsS3Endpoint', { infer: true }),
      credentials: {
        accessKeyId: this.configService.getOrThrow('file.accessKeyId', {
          infer: true,
        }),
        secretAccessKey: this.configService.getOrThrow('file.secretAccessKey', {
          infer: true,
        }),
      },
    });
  }

  async create(
    file: Express.Multer.File,
    body: FileUploadDto,
    userId?: number,
  ): Promise<{ file: FileType }> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'selectFile' },
      });
    }

    if (!file.buffer) {
      throw new InternalServerErrorException(
        'File buffer is missing. Ensure multer is configured with memory storage.',
      );
    }

    const optimizationEnabled = this.configService.get(
      'file.imageOptimizationEnabled',
      { infer: true },
    );

    let finalBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let finalSize = file.size;
    let originalName = file.originalname;

    if (
      optimizationEnabled &&
      this.imageProcessingService.isImage(file.mimetype)
    ) {
      const processed = await this.imageProcessingService.processImage(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      finalBuffer = processed.buffer;
      finalMimeType = processed.mimeType;
      finalSize = processed.size;
      originalName = this.imageProcessingService.getOptimizedFilename(
        file.originalname,
      );
    }

    // Build S3 key with structured path: userId/entityName/entityId/context/filename
    const subPath = buildStoragePath(userId, body);
    const ext = originalName.includes('.')
      ? originalName.split('.').pop()?.toLowerCase()
      : undefined;
    const filename = ext
      ? `${randomStringGenerator()}.${ext}`
      : randomStringGenerator();

    const key = subPath ? `${subPath}/${filename}` : filename;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
          infer: true,
        }),
        Key: key,
        Body: finalBuffer,
        ContentType: finalMimeType,
        ACL: body.isPublic !== false ? 'public-read' : 'private',
      }),
    );

    this.logger.log(
      `Uploaded to S3: ${key} (${finalSize} bytes, ${finalMimeType})`,
    );

    return {
      file: await this.fileRepository.create({
        path: key,
        isPublic: body.isPublic !== false,
        entityName: body.entityName,
        entityId: body.entityId,
        context: body.context,
        userId,
        type: finalMimeType,
        size: finalSize,
        name: originalName,
      }),
    };
  }

  async update(
    id: string,
    file: Express.Multer.File,
    isPublic?: boolean,
  ): Promise<{ file: FileType }> {
    const existingFile = await this.fileRepository.findById(id);
    if (!existingFile) {
      throw new NotFoundException();
    }

    try {
      await this.deletePhysicalFile(existingFile.path);
    } catch (error) {
      await this.cleanupErrorRepository.save({
        fileUri: existingFile.path,
        driver: 's3',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (!file.buffer) {
      throw new InternalServerErrorException('File buffer is missing.');
    }

    const optimizationEnabled = this.configService.get(
      'file.imageOptimizationEnabled',
      { infer: true },
    );

    const fileIsPublic =
      isPublic !== undefined
        ? isPublic === true
        : existingFile.isPublic === true;

    let finalBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let finalSize = file.size;
    let originalName = file.originalname;

    if (
      optimizationEnabled &&
      this.imageProcessingService.isImage(file.mimetype)
    ) {
      const processed = await this.imageProcessingService.processImage(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      finalBuffer = processed.buffer;
      finalMimeType = processed.mimeType;
      finalSize = processed.size;
      originalName = this.imageProcessingService.getOptimizedFilename(
        file.originalname,
      );
    }

    // Preserve existing metadata for path structure
    const subPath = buildStoragePath(existingFile.userId ?? undefined, {
      entityName: existingFile.entityName ?? undefined,
      entityId: existingFile.entityId ?? undefined,
      context: existingFile.context ?? undefined,
    });
    const ext = originalName.includes('.')
      ? originalName.split('.').pop()?.toLowerCase()
      : undefined;
    const filename = ext
      ? `${randomStringGenerator()}.${ext}`
      : randomStringGenerator();
    const key = subPath ? `${subPath}/${filename}` : filename;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
          infer: true,
        }),
        Key: key,
        Body: finalBuffer,
        ContentType: finalMimeType,
        ACL: fileIsPublic ? 'public-read' : 'private',
      }),
    );

    const updatedFile = await this.fileRepository.update(id, {
      path: key,
      isPublic: fileIsPublic,
      type: finalMimeType,
      size: finalSize,
      name: originalName,
    });

    return { file: updatedFile };
  }

  async delete(id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException();
    }
    await this.fileRepository.delete(id);
  }

  async deletePhysicalFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
            infer: true,
          }),
          Key: key,
        }),
      );
    } catch (error) {
      console.error('Error deleting S3 object:', error);
      throw error;
    }
  }

  async getPublicUrl(filePath: string): Promise<string> {
    return this.getPresignedUrl(filePath);
  }

  async getPresignedUrl(filePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
        infer: true,
      }),
      Key: filePath,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}
