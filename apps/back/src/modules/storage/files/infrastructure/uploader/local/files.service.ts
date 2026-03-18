import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import * as fs from 'fs';
import * as path from 'path';

import { FileRepository } from '@storage/files/infrastructure/file.repository';
import { AllConfigType } from '@src/config/config.type';
import { FileType } from '@storage/files/domain/file';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';
import { buildStoragePath } from '@storage/files/infrastructure/utils/build-storage-path.util';

@Injectable()
export class FilesLocalService {
  private readonly logger = new Logger(FilesLocalService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileRepository: FileRepository,
    private readonly cleanupErrorRepository: FileCleanupErrorRepository,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

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
        'File buffer is missing. Ensure multer is using memory storage.',
      );
    }

    const optimizationEnabled = this.configService.get(
      'file.imageOptimizationEnabled',
      { infer: true },
    );

    // Determine base filename
    const original = file.originalname || 'upload';
    const ext = original.includes('.')
      ? original.split('.').pop()?.toLowerCase()
      : undefined;
    const rand = randomStringGenerator();
    let filename = ext
      ? `${Date.now()}-${rand}.${ext}`
      : `${Date.now()}-${rand}`;

    // Process buffer through Sharp if it's an image
    let finalBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let finalSize = file.size;
    let finalOriginalName = file.originalname;

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
      filename = this.imageProcessingService.getOptimizedFilename(filename);
      finalOriginalName = this.imageProcessingService.getOptimizedFilename(
        file.originalname,
      );
    }

    // Build structured subfolder: userId/entityName/entityId/context  (or subsets)
    const visibility = body.isPublic === false ? 'private' : 'public';
    const subPath = buildStoragePath(userId, body);
    const finalFolderPath = path.join('./files', visibility, subPath);

    fs.mkdirSync(finalFolderPath, { recursive: true });

    const finalFilePath = path.join(finalFolderPath, filename);
    fs.writeFileSync(finalFilePath, finalBuffer);
    this.logger.log(`File written to ${finalFilePath}`);

    // Build the public API access path
    const relativePath = subPath
      ? `${visibility}/${subPath}/${filename}`
      : `${visibility}/${filename}`;
    const apiPrefix = this.configService.get('app.apiPrefix', { infer: true });
    const accessPath = `/${apiPrefix}/v1/files/${relativePath}`;

    return {
      file: await this.fileRepository.create({
        path: accessPath,
        isPublic: body.isPublic !== false,
        entityName: body.entityName,
        entityId: body.entityId,
        context: body.context,
        userId: userId || undefined,
        type: finalMimeType,
        size: finalSize,
        name: finalOriginalName,
      }),
    };
  }

  async update(
    id: string,
    file: Express.Multer.File,
    isPublic?: boolean,
    destination?: string,
  ): Promise<{ file: FileType }> {
    const existingFile = await this.fileRepository.findById(id);
    if (!existingFile) {
      throw new NotFoundException();
    }

    // Delete old physical file with DLQ fallback
    try {
      this.deletePhysicalFile(existingFile.path);
    } catch (error) {
      await this.cleanupErrorRepository.save({
        fileUri: existingFile.path,
        driver: 'local',
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

    const original = file.originalname || 'upload';
    const ext = original.includes('.')
      ? original.split('.').pop()?.toLowerCase()
      : undefined;
    const rand = randomStringGenerator();
    let filename = ext
      ? `${Date.now()}-${rand}.${ext}`
      : `${Date.now()}-${rand}`;

    let finalBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let finalSize = file.size;

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
      filename = this.imageProcessingService.getOptimizedFilename(filename);
    }

    // Preserve existing entity metadata for path
    const subPath = buildStoragePath(existingFile.userId ?? undefined, {
      entityName: existingFile.entityName ?? undefined,
      entityId: existingFile.entityId ?? undefined,
      context: existingFile.context ?? undefined,
    });

    const visibility = fileIsPublic ? 'public' : 'private';
    const folder = destination
      ? path.join(
          './files',
          visibility,
          subPath,
          destination.replace(/\.\.+/g, '').replace(/^\/+/, ''),
        )
      : path.join('./files', visibility, subPath);

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, filename), finalBuffer);

    const relParts = [visibility, subPath, destination, filename]
      .filter(Boolean)
      .join('/');
    const apiPrefix = this.configService.get('app.apiPrefix', { infer: true });
    const accessPath = `/${apiPrefix}/v1/files/${relParts}`;

    const updatedFile = await this.fileRepository.update(id, {
      path: accessPath,
      isPublic: fileIsPublic,
      type: finalMimeType,
      size: finalSize,
    });

    return { file: updatedFile };
  }

  async delete(id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException(`File with id ${id} not found`);
    }
    await this.fileRepository.delete(id);
  }

  public deletePhysicalFile(fileUri: string): void {
    try {
      this.logger.log(`Starting deletion for file with path: ${fileUri}`);

      let pathToProcess = fileUri;

      if (fileUri.startsWith('http')) {
        pathToProcess = new URL(fileUri).pathname;
      }

      if (pathToProcess.startsWith('/')) {
        pathToProcess = pathToProcess.substring(1);
      }

      const apiPrefix =
        this.configService.get('app.apiPrefix', { infer: true }) || 'api';
      const expectedPrefix = `${apiPrefix}/v1/files/`;

      if (!pathToProcess.startsWith(expectedPrefix)) {
        this.logger.error(
          `Path doesn't start with expected prefix ${expectedPrefix}: ${pathToProcess}`,
        );
        return;
      }

      const relativePath = pathToProcess.substring(expectedPrefix.length);
      const filePath = path.join('./files', relativePath);
      const normalizedFilePath = path.normalize(filePath);

      if (fs.existsSync(normalizedFilePath)) {
        fs.unlinkSync(normalizedFilePath);
        this.logger.log(`Successfully deleted file: ${normalizedFilePath}`);
      } else {
        this.logger.warn(`File not found at path: ${normalizedFilePath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete physical file: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
