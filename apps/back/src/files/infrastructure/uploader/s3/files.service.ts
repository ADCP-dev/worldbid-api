import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AllConfigType } from '../../../../config/config.type';
import { FileRepository } from '../../persistence/file.repository';
import { FileType } from '../../../domain/file';
import { FileUploadDto } from '../../../dto/file-upload.dto';

@Injectable()
export class FilesS3Service {
  private readonly s3: S3Client;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService<AllConfigType>,
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
    file: Express.MulterS3.File,
    body: FileUploadDto,
    userId?: number,
  ): Promise<{ file: FileType }> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'selectFile',
        },
      });
    }

    return {
      file: await this.fileRepository.create({
        path: file.key,
        isPublic: body.isPublic || true,
        entity: body.entity,
        entityId: body.entityId,
        userId,
        type: file.mimetype,
        size: file.size,
        name: file.originalname,
      }),
    };
  }

  async update(
    id: string,
    file: Express.MulterS3.File,
    isPublic?: boolean,
  ): Promise<{ file: FileType }> {
    const existingFile = await this.fileRepository.findById(id);
    if (!existingFile) {
      throw new NotFoundException();
    }

    // Delete old file from S3
    await this.deleteS3Object(existingFile.path);

    const fileIsPublic =
      isPublic !== undefined ? isPublic == true : existingFile.isPublic == true;

    const updatedFile = await this.fileRepository.update(id, {
      path: file.key,
      isPublic: fileIsPublic,
      type: file.mimetype,
      size: file.size,
      name: file.originalname,
    });

    return { file: updatedFile };
  }

  async delete(id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException();
    }

    await this.deleteS3Object(file.path);
    await this.fileRepository.delete(id);
  }

  private async deleteS3Object(key: string): Promise<void> {
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
    }
  }

  async getPublicUrl(path: string): Promise<string> {
    return this.getPresignedUrl(path);
  }

  async getPresignedUrl(path: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
        infer: true,
      }),
      Key: path,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
}
