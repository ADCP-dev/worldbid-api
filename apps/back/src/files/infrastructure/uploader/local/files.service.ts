import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

import { FileRepository } from '../../file.repository';
import { AllConfigType } from '../../../../config/config.type';
import { FileType } from '../../../domain/file';
import { FileUploadDto } from '../../../dto/file-upload.dto';

@Injectable()
export class FilesLocalService {
  private readonly logger = new Logger(FilesLocalService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileRepository: FileRepository,
  ) {}

  async create(
    file: Express.Multer.File,
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

    // Determine filename and temp path depending on storage type (disk or memory)
    let filename: string;
    const tempFilePath: string | undefined = (file as any).path;

    if (tempFilePath && typeof tempFilePath === 'string') {
      // Disk storage provides a temporary file path
      const normalizedPath = tempFilePath.replace(/\\/g, '/');
      filename = normalizedPath.split('/').pop() || tempFilePath;
    } else {
      // Memory storage: generate a safe filename using the original extension
      const original = file.originalname || 'upload';
      const ext = original.includes('.')
        ? original.split('.').pop()?.toLowerCase()
        : undefined;
      const rand = Math.random().toString(36).slice(2);
      filename = ext ? `${Date.now()}-${rand}.${ext}` : `${Date.now()}-${rand}`;
    }

    // Determine the final storage location
    const baseFolder = './files';
    const visibilityFolder = body.isPublic == true ? 'public' : 'private';

    // Build the destination folder path
    const finalFolderPath = `${baseFolder}/${visibilityFolder}`;

    // Create directory if it doesn't exist
    fs.mkdirSync(finalFolderPath, { recursive: true });

    // Define the final file path
    const finalFilePath = path.join(finalFolderPath, filename);

    // Move the file from temp to final location (disk) or write from buffer (memory)
    try {
      if (tempFilePath && typeof tempFilePath === 'string') {
        fs.renameSync(tempFilePath, finalFilePath);
        this.logger.log(`File moved from ${tempFilePath} to ${finalFilePath}`);
      } else if ((file as any).buffer) {
        fs.writeFileSync(finalFilePath, (file as any).buffer);
        this.logger.log(`File written to ${finalFilePath} from memory buffer`);
      } else {
        throw new InternalServerErrorException(
          'Failed to save file: no temp path or buffer provided',
        );
      }
    } catch (error) {
      this.logger.error(`Failed to move/write file: ${error.message}`);
      throw new InternalServerErrorException('Failed to save file');
    }

    // Build the API path for accessing the file
    const relativePath = `${visibilityFolder}/${filename}`;

    const accessPath = `/${this.configService.get('app.apiPrefix', { infer: true })}/v1/files/${relativePath}`;

    return {
      file: await this.fileRepository.create({
        path: accessPath,
        isPublic: body.isPublic || true,
        entity: body.entity,
        entityId: body.entityId,
        userId: userId || undefined,
        type: file.mimetype,
        size: file.size,
        name: file.originalname,
      }),
    };
  }

  async update(
    id: string,
    file: Express.Multer.File,
    isPublic?: boolean,
    destination?: string,
  ): Promise<{ file: FileType }> {
    // Find the existing file
    const existingFile = await this.fileRepository.findById(id);
    if (!existingFile) {
      throw new NotFoundException();
    }

    // Delete the old physical file
    await this.deletePhysicalFile(existingFile);

    // Determine if the file should be public or private (use existing setting if not specified)
    const fileIsPublic =
      isPublic !== undefined ? isPublic == true : existingFile.isPublic == true;

    // Extract the filename from the temp path or generate if using memory storage
    let filename: string;
    const tempFilePath: string | undefined = (file as any).path;
    if (tempFilePath && typeof tempFilePath === 'string') {
      const normalizedPath = tempFilePath.replace(/\\/g, '/');
      filename = normalizedPath.split('/').pop() || tempFilePath;
    } else {
      const original = file.originalname || 'upload';
      const ext = original.includes('.')
        ? original.split('.').pop()?.toLowerCase()
        : undefined;
      const rand = Math.random().toString(36).slice(2);
      filename = ext ? `${Date.now()}-${rand}.${ext}` : `${Date.now()}-${rand}`;
    }

    // Determine the final storage location
    const baseFolder = './files';
    const visibilityFolder = fileIsPublic == true ? 'public' : 'private';

    // Build the destination folder path
    let finalFolderPath = `${baseFolder}/${visibilityFolder}`;
    if (destination) {
      // Sanitize destination to prevent directory traversal
      const sanitizedDestination = destination
        .replace(/\.\.*/g, '')
        .replace(/^\/+/, '');
      finalFolderPath = `${finalFolderPath}/${sanitizedDestination}`;
    }

    // Create directory if it doesn't exist
    fs.mkdirSync(finalFolderPath, { recursive: true });

    // Define the final file path
    const finalFilePath = path.join(finalFolderPath, filename);

    // Move the file from temp to final location or write buffer
    try {
      if (tempFilePath && typeof tempFilePath === 'string') {
        fs.renameSync(tempFilePath, finalFilePath);
        this.logger.log(`File moved from ${tempFilePath} to ${finalFilePath}`);
      } else if ((file as any).buffer) {
        fs.writeFileSync(finalFilePath, (file as any).buffer);
        this.logger.log(`File written to ${finalFilePath} from memory buffer`);
      } else {
        throw new InternalServerErrorException(
          'Failed to save file: no temp path or buffer provided',
        );
      }
    } catch (error) {
      this.logger.error(`Failed to move/write file: ${error.message}`);
      throw new InternalServerErrorException('Failed to save file');
    }

    // Build the API path for accessing the file
    const relativePath = destination
      ? `${visibilityFolder}/${destination}/${filename}`
      : `${visibilityFolder}/${filename}`;

    const accessPath = `/${this.configService.get('app.apiPrefix', {
      infer: true,
    })}/v1/files/${relativePath}`;

    // Update the file record
    const updatedFile = await this.fileRepository.update(id, {
      path: accessPath,
      isPublic: fileIsPublic,
      type: file.mimetype,
      size: file.size,
    });

    return { file: updatedFile };
  }

  async delete(id: string): Promise<void> {
    // Find the file to delete
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw new NotFoundException(`File with id ${id} not found`);
    }

    // Delete the physical file
    await this.deletePhysicalFile(file);

    // Delete from database
    await this.fileRepository.delete(id);
  }

  private deletePhysicalFile(file: FileType): void {
    try {
      this.logger.log(`Starting deletion for file with path: ${file.path}`);

      // Handle both full URLs and relative paths
      let pathToProcess = file.path;

      // If it's a full URL, extract the pathname
      if (file.path.startsWith('http')) {
        pathToProcess = new URL(file.path).pathname;
      }

      // Remove leading slash if present
      if (pathToProcess.startsWith('/')) {
        pathToProcess = pathToProcess.substring(1);
      }

      this.logger.log(`Processing path: ${pathToProcess}`);

      // The format should be: api/v1/files/public|private/filename
      // or: api/v1/files/public|private/subfolder/filename
      const apiPrefix =
        this.configService.get('app.apiPrefix', { infer: true }) || 'api';
      const expectedPrefix = `${apiPrefix}/v1/files/`;

      if (!pathToProcess.startsWith(expectedPrefix)) {
        this.logger.error(
          `Path doesn't start with expected prefix ${expectedPrefix}: ${pathToProcess}`,
        );
        return;
      }

      // Extract the relative path after the API prefix
      const relativePath = pathToProcess.substring(expectedPrefix.length);
      this.logger.log(`Relative path: ${relativePath}`);

      // The base path is './files'
      const basePath = './files';

      // Create the full path to the physical file
      const filePath = path.join(basePath, relativePath);
      const normalizedFilePath = path.normalize(filePath);

      this.logger.log(`Attempting to delete file at: ${normalizedFilePath}`);

      // Check if file exists and delete it
      if (fs.existsSync(normalizedFilePath)) {
        fs.unlinkSync(normalizedFilePath);
        this.logger.log(`Successfully deleted file: ${normalizedFilePath}`);
      } else {
        this.logger.warn(`File not found at path: ${normalizedFilePath}`);

        // Log directory contents for debugging
        const dirPath = path.dirname(normalizedFilePath);
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          this.logger.log(`Directory ${dirPath} contains: ${files.join(', ')}`);
        } else {
          this.logger.warn(`Directory doesn't exist: ${dirPath}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete physical file: ${error.message}`,
        error.stack,
      );
      // Don't throw, so database operations can still continue
    }
  }
}
